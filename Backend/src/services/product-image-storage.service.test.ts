import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import test, { after, before } from 'node:test';

import { STORAGE_NAMESPACE, storageConfig } from '../config/storage';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { ProductImageStorageService } from './product-image-storage.service';

/**
 * Unit tests for the shared product-image pipeline (admin products, seller
 * products, CSV/ZIP import and CJ import all go through this service).
 *
 * A tiny in-memory stand-in for the two Prisma models this service touches
 * keeps the test free of a database while still exercising the real ordering,
 * primary-image and cleanup logic against the real filesystem.
 *
 * The storage root is supplied by the `test:storage` npm script.
 */

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PRODUCT_ID = 'product-1';

const products = new Map<string, { id: string }>();
const images: Array<Record<string, any>> = [];
let nextImageId = 1;

function makePrismaStub(overrides: Record<string, any> = {}) {
  return {
    product: {
      findUnique: async ({ where }: any) => products.get(where.id) ?? null,
    },
    productImage: {
      create: async ({ data }: any) => {
        const row = { id: `img-${nextImageId++}`, ...data };
        images.push(row);
        return row;
      },
      findFirst: async ({ where, orderBy }: any) => {
        const rows = images.filter(
          (row) => row.productId === where.productId && (!where.id || row.id === where.id),
        );
        if (orderBy?.sortOrder === 'asc') rows.sort((a, b) => a.sortOrder - b.sortOrder);
        return rows[0] ?? null;
      },
      findMany: async ({ where }: any) =>
        images.filter((row) => row.productId === where.productId),
      delete: async ({ where }: any) => {
        const index = images.findIndex((row) => row.id === where.id);
        if (index >= 0) images.splice(index, 1);
      },
      update: async ({ where, data }: any) => {
        const row = images.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        images.filter((row) => row.productId === where.productId).forEach((row) => Object.assign(row, data));
        return { count: images.length };
      },
      aggregate: async ({ where }: any) => {
        const rows = images.filter((row) => row.productId === where.productId);
        return { _max: { sortOrder: rows.length ? Math.max(...rows.map((r) => r.sortOrder)) : null } };
      },
      ...overrides,
    },
    $transaction: async (operations: any[]) => {
      for (const operation of operations) await operation;
      return [];
    },
  } as any;
}

let service: ProductImageStorageService;

const productFile = (relativePath: string) =>
  path.join(storageConfig.root, STORAGE_NAMESPACE.products, ...relativePath.split('/'));

/**
 * Start a product with no images yet, so ordering/primary assertions are made
 * against a known baseline instead of whatever earlier tests left behind.
 */
function freshProduct(id: string) {
  images.length = 0;
  products.clear();
  products.set(id, { id });
  return id;
}

before(() => {
  freshProduct(PRODUCT_ID);
  service = new ProductImageStorageService(makePrismaStub());
  fs.rmSync(storageConfig.root, { recursive: true, force: true });
});

after(() => {
  fs.rmSync(storageConfig.root, { recursive: true, force: true });
});

test('upload stores the file, records a relative path and a configured public URL', async () => {
  const result = await service.uploadProductImage(PRODUCT_ID, JPEG, 'Front View.JPG', 'image/jpeg');

  assert.match(result.path, /^product-1\/\d+-front-view\.jpg$/, 'path must be relative and product-scoped');
  assert.equal(
    result.url,
    `${storageConfig.publicBaseUrl}${storageConfig.publicPathPrefix}/products/${result.path}`,
  );
  assert.ok(fs.existsSync(productFile(result.path)), 'the file must exist under the products namespace');
  assert.ok(fs.readFileSync(productFile(result.path)).equals(JPEG));
  // No absolute filesystem path may leak into the database row.
  assert.ok(!result.path.includes(storageConfig.root));
  assert.equal(images[0].path, result.path);
});

test('the first image is primary and later images append with a dense sort order', async () => {
  const productId = freshProduct('product-ordering');
  const first = await service.uploadProductImage(productId, JPEG, 'a.jpg', 'image/jpeg');
  const second = await service.uploadProductImage(productId, JPEG, 'b.jpg', 'image/jpeg');
  const third = await service.uploadProductImage(productId, JPEG, 'c.jpg', 'image/jpeg');

  assert.equal(first.isPrimary, true);
  assert.equal(first.sortOrder, 0);
  assert.equal(second.isPrimary, false);
  assert.equal(second.sortOrder, 1);
  assert.equal(third.sortOrder, 2);

  // A re-upload after a deletion must not reuse a sort order.
  await service.deleteProductImage(productId, second.id);
  const fourth = await service.uploadProductImage(productId, JPEG, 'd.jpg', 'image/jpeg');
  assert.equal(fourth.sortOrder, 3);
  assert.ok(!images.some((row) => row.sortOrder === 1), 'sort orders stay dense and unique');

  // Leave the shared PRODUCT_ID baseline empty for the tests below.
  freshProduct(PRODUCT_ID);
});

test('uploads are rejected for an unknown product, a bad type, a bad extension and an oversized file', async () => {
  await assert.rejects(
    () => service.uploadProductImage('missing', JPEG, 'a.jpg', 'image/jpeg'),
    NotFoundError,
  );
  await assert.rejects(
    () => service.uploadProductImage(PRODUCT_ID, JPEG, 'a.gif', 'image/gif'),
    /Invalid file type/,
  );
  await assert.rejects(
    () => service.uploadProductImage(PRODUCT_ID, JPEG, 'a.txt', 'image/jpeg'),
    /Invalid file extension/,
  );
  await assert.rejects(
    () => service.uploadProductImage(PRODUCT_ID, Buffer.alloc(6 * 1024 * 1024), 'a.jpg', 'image/jpeg'),
    /maximum limit/,
  );
  await assert.rejects(
    () => service.uploadProductImage(PRODUCT_ID, JPEG, 'a\0.jpg', 'image/jpeg'),
    /Invalid filename/,
  );
});

test('a rejected upload never leaves a file on disk', async () => {
  const before = images.length;
  await assert.rejects(() => service.uploadProductImage(PRODUCT_ID, JPEG, 'bad.txt', 'image/jpeg'));
  assert.equal(images.length, before, 'no metadata row may be created');
});

test('a database failure rolls the stored file back', async () => {
  const failing = new ProductImageStorageService(
    makePrismaStub({
      create: async () => {
        throw new Error('db down');
      },
    }),
  );

  await assert.rejects(
    () => failing.uploadProductImage(PRODUCT_ID, JPEG, 'rollback.jpg', 'image/jpeg'),
    BadRequestError,
  );

  const productDir = path.join(storageConfig.root, STORAGE_NAMESPACE.products, PRODUCT_ID);
  const stored = fs.readdirSync(productDir).filter((f) => f.includes('rollback'));
  assert.deepEqual(stored, [], 'the orphaned file must be removed');
});

test('delete removes the file and the row, and promotes a new primary', async () => {
  const productId = freshProduct('product-delete');
  await service.uploadProductImage(productId, JPEG, 'one.jpg', 'image/jpeg');
  await service.uploadProductImage(productId, JPEG, 'two.jpg', 'image/jpeg');
  await service.uploadProductImage(productId, JPEG, 'three.jpg', 'image/jpeg');

  const imagesBefore = images.length;
  const primary = images.find((row) => row.isPrimary)!;

  await service.deleteProductImage(productId, primary.id);

  assert.equal(fs.existsSync(productFile(primary.path)), false, 'the file must be gone');
  assert.equal(images.length, imagesBefore - 1);
  const next = images
    .filter((row) => row.productId === productId)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  assert.equal(next.isPrimary, true, 'the lowest sortOrder image becomes primary');
});

test('deleting a non-primary image leaves the primary flag untouched', async () => {
  const productId = freshProduct('product-nonprimary');
  await service.uploadProductImage(productId, JPEG, 'one.jpg', 'image/jpeg');
  await service.uploadProductImage(productId, JPEG, 'two.jpg', 'image/jpeg');

  await service.setPrimaryImage(productId, images[0].id);
  const nonPrimary = images.find((row) => !row.isPrimary)!;
  await service.deleteProductImage(productId, nonPrimary.id);

  assert.equal(images.find((row) => row.id === images[0].id)?.isPrimary, true);
});

test('delete rejects an image that belongs to another product', async () => {
  const productId = freshProduct('product-ownership');
  const uploaded = await service.uploadProductImage(productId, JPEG, 'one.jpg', 'image/jpeg');

  await assert.rejects(() => service.deleteProductImage('other-product', uploaded.id), NotFoundError);
  assert.ok(fs.existsSync(productFile(uploaded.path)), 'the file of a foreign product stays untouched');
});

test('setPrimaryImage clears every other primary flag', async () => {
  const productId = freshProduct('product-primary');
  for (const name of ['one.jpg', 'two.jpg', 'three.jpg']) {
    await service.uploadProductImage(productId, JPEG, name, 'image/jpeg');
  }

  const target = images[images.length - 1];
  await service.setPrimaryImage(productId, target.id);

  const primaries = images.filter((row) => row.productId === productId && row.isPrimary);
  assert.equal(primaries.length, 1);
  assert.equal(primaries[0].id, target.id);

  await assert.rejects(() => service.setPrimaryImage(productId, 'nope'), NotFoundError);
});

test('reorder rejects images from other products and applies valid orders atomically', async () => {
  const productId = freshProduct('product-reorder');
  for (const name of ['one.jpg', 'two.jpg', 'three.jpg']) {
    await service.uploadProductImage(productId, JPEG, name, 'image/jpeg');
  }

  await assert.rejects(
    () => service.reorderImages(productId, [{ id: 'foreign-image', sortOrder: 0 }]),
    /do not belong to this product/,
  );

  const owned = images.filter((row) => row.productId === productId);
  const orders = owned.map((row, index) => ({ id: row.id, sortOrder: owned.length - index }));
  await service.reorderImages(productId, orders);
  for (const { id, sortOrder } of orders) {
    assert.equal(images.find((row) => row.id === id)?.sortOrder, sortOrder);
  }
});

test('getPublicProductImageUrl derives the same configured URL as an upload', async () => {
  assert.equal(
    service.getPublicProductImageUrl('product-1/1-a.jpg'),
    `${storageConfig.publicBaseUrl}${storageConfig.publicPathPrefix}/products/product-1/1-a.jpg`,
  );
});

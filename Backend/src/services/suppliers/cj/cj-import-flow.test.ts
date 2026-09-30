import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../../../config/database';
import cjClient from './cj-client';
import cjMapperService from './cj-mapper';
import cjCategoryImportService from './cj-category-import.service';
import productService from '../../product.service';
import productImageStorageService from '../../product-image-storage.service';

const LIST_ID = '1405403151636500480';
const EMART_CATEGORY_ID = '11111111-2222-3333-4444-555555555555';

const detailResponse = {
  code: 200,
  message: 'Success',
  data: {
    id: LIST_ID,
    name: '小众设计小香手表',
    nameen: 'Student Korean Version Of Simple Ladies Small Exquisite Temperament Fashion Watch',
    sku: 'CJCY1178129',
    bigimg: 'https://cf.cjdropshipping.com/1623908807537.jpg',
    img: 'https://cf.cjdropshipping.com/1623908807537.jpg,https://cf.cjdropshipping.com/1623908807843.jpg',
    newImgList: [
      'https://cf.cjdropshipping.com/1623908807537.jpg',
      'https://cf.cjdropshipping.com/1623908807843.jpg',
    ],
    sellprice: '2.63',
    currency: null,
    description: '<p>Product information</p>',
    category: 'Jewelry & Watches > Womens Watches > Creative Watches',
    categoryid: 'DAE17D16-A15F-445D-AE34-B698F3290E56',
    stanProducts: [
      { id: '1405403153129672704', sku: 'CJCY117812901AZ', sellprice: '2.63', variantkey: '1 Style' },
    ],
    variantInventory: [
      { vid: '1405403153129672704', inventory: [{ countryCode: 'CN', totalInventory: 31756 }] },
    ],
    thirdVideoList: null,
  },
};

interface Harness {
  detailCalls: any[];
  createCalls: any[];
  imageCalls: string[][];
  restore: () => void;
}

function installHarness(existing: { id: string } | null = null): Harness {
  const detailCalls: any[] = [];
  const createCalls: any[] = [];
  const imageCalls: string[][] = [];

  const originalFindUnique = prisma.product.findUnique;
  const originalCreate = productService.createProduct;
  const originalImportImages = cjMapperService.importImages;

  cjClient.setTransportHooks({
    headers: async () => ({}),
    sleep: async () => undefined,
    fetch: async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (url.includes('/product/productDetail/query')) detailCalls.push(body);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => detailResponse,
        headers: { get: () => null },
      } as unknown as Response;
    },
  });

  (prisma.product as any).findUnique = async () => existing;

  (productService as any).createProduct = async (data: any) => {
    createCalls.push(data);
    return { id: `emart-${createCalls.length}`, ...data };
  };

  (cjMapperService as any).importImages = async (_productId: string, urls: string[]) => {
    imageCalls.push(urls);
    return urls.length;
  };

  return {
    detailCalls,
    createCalls,
    imageCalls,
    restore: () => {
      cjClient.resetTransportHooks();
      (prisma.product as any).findUnique = originalFindUnique;
      (productService as any).createProduct = originalCreate;
      (cjMapperService as any).importImages = originalImportImages;
    },
  };
}

test('successful CJ product reaches productService.createProduct()', async () => {
  const harness = installHarness(null);
  try {
    const product = await cjMapperService.importProduct(LIST_ID, {
      categoryId: EMART_CATEGORY_ID,
      priceMarkupPercent: 30,
    });

    assert.equal(harness.createCalls.length, 1, 'createProduct must be called exactly once');

    const data = harness.createCalls[0];
    assert.equal(data.externalProductId, LIST_ID, 'externalProductId must be the original CJ id');
    assert.equal(data.sourceType, 'CJ');
    assert.equal(data.categoryId, EMART_CATEGORY_ID);
    assert.equal(data.sku, `CJ-${LIST_ID}`.toUpperCase());
    assert.equal(data.seller, 'CJdropshipping');
    assert.equal(data.stock, 31756);
    assert.ok(data.supplierData, 'supplierData must be populated');
    assert.equal(data.supplierData.cjProductId, LIST_ID);
    assert.equal(data.supplierData.cjCategoryId, 'DAE17D16-A15F-445D-AE34-B698F3290E56');
    assert.equal(data.supplierData.supplierPrice, 2.63);
    assert.equal(data.supplierData.variants.length, 1);
    assert.equal(data.supplierData.variants[0].vid, '1405403153129672704');
    assert.equal(data.price, Math.round(2.63 * 1.3 * 100) / 100);

    assert.equal(product.id, 'emart-1');
    assert.equal(harness.imageCalls.length, 1, 'images must be imported');
    assert.equal(harness.imageCalls[0].length, 2);
    assert.match(harness.imageCalls[0][0], /^https:\/\/cf\.cjdropshipping\.com\//);

    assert.equal(harness.detailCalls.length, 1, 'a single CJ detail call is enough');
    assert.deepEqual(harness.detailCalls[0], { id: LIST_ID });
  } finally {
    harness.restore();
  }
});

test('single-product import sends { id } and keeps the CJ identifier', async () => {
  const harness = installHarness(null);
  try {
    await cjMapperService.importProduct(LIST_ID, { categoryId: EMART_CATEGORY_ID });

    assert.deepEqual(harness.detailCalls[0], { id: LIST_ID });
    assert.equal(harness.createCalls[0].externalProductId, LIST_ID);
  } finally {
    harness.restore();
  }
});

test('duplicate externalProductId remains protected for single-product import', async () => {
  const harness = installHarness({ id: 'existing-emart-product' });
  try {
    await assert.rejects(
      () => cjMapperService.importProduct(LIST_ID, { categoryId: EMART_CATEGORY_ID }),
      (error: any) => {
        assert.match(error.message, /already imported/);
        assert.match(error.message, /existing-emart-product/);
        return true;
      }
    );
    assert.equal(harness.createCalls.length, 0, 'duplicate must not create a product');
  } finally {
    harness.restore();
  }
});

test('duplicate externalProductId remains protected for category import', async () => {
  const harness = installHarness({ id: 'existing-emart-product' });
  try {
    const row = await (cjCategoryImportService as any).processSingleProduct(
      LIST_ID,
      'A watch',
      { emartCategoryId: EMART_CATEGORY_ID }
    );

    assert.equal(row.status, 'SKIPPED_DUPLICATE');
    assert.equal(row.emartProductId, 'existing-emart-product');
    assert.equal(harness.createCalls.length, 0, 'duplicate must not create a product');
    assert.equal(harness.detailCalls.length, 0, 'duplicate must not call CJ detail');
  } finally {
    harness.restore();
  }
});

test('CJ image content types are normalised so the storage service accepts them', async () => {
  const normalize = (cjMapperService as any).normalizeImageContentType.bind(cjMapperService);

  assert.equal(normalize('image/jpg', Buffer.alloc(0)), 'image/jpeg');
  assert.equal(normalize('image/jpeg', Buffer.alloc(0)), 'image/jpeg');
  assert.equal(normalize('image/png', Buffer.alloc(0)), 'image/png');
  assert.equal(normalize('image/webp; charset=binary', Buffer.alloc(0)), 'image/webp');
  assert.equal(normalize('', Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(normalize('', Buffer.from([0x89, 0x50, 0x4e, 0x47])), 'image/png');
  assert.equal(
    normalize('', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])),
    'image/webp'
  );
  assert.equal(normalize('application/octet-stream', Buffer.from('not-an-image')), 'image/jpeg');
});

test('category import uses the corrected shared CJ import logic', async () => {
  const harness = installHarness(null);
  try {
    const row = await (cjCategoryImportService as any).processSingleProduct(
      LIST_ID,
      'Student Korean Version Watch',
      { emartCategoryId: EMART_CATEGORY_ID, priceMarkupPercent: 30 }
    );

    assert.equal(row.status, 'SUCCESS');
    assert.equal(row.cjProductId, LIST_ID);
    assert.equal(row.emartProductId, 'emart-1');

    assert.equal(harness.detailCalls.length, 1);
    assert.deepEqual(harness.detailCalls[0], { id: LIST_ID }, 'category import must send { id }');

    const data = harness.createCalls[0];
    assert.equal(data.externalProductId, LIST_ID);
    assert.equal(data.sourceType, 'CJ');
    assert.equal(data.categoryId, EMART_CATEGORY_ID);
    assert.ok(data.supplierData);
    assert.equal(data.supplierData.cjProductId, LIST_ID);
    assert.equal(data.supplierData.cjCategoryPath, 'Jewelry & Watches > Womens Watches > Creative Watches');
    assert.equal(data.stock, 31756);
    assert.equal(harness.imageCalls[0].length, 2);
  } finally {
    harness.restore();
  }
});

test('image import is bounded but parallel so a product does not stall the run', async () => {
  const originalFetch = globalThis.fetch;
  const originalUpload = productImageStorageService.uploadProductImage;

  let inFlight = 0;
  let maxInFlight = 0;
  let uploads = 0;

  (globalThis as any).fetch = async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(resolve => setTimeout(resolve, 10));
    inFlight--;
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'image/jpg' },
      arrayBuffer: async () => new ArrayBuffer(8),
    } as unknown as Response;
  };

  (productImageStorageService as any).uploadProductImage = async () => {
    uploads++;
    return { id: 'img', path: 'p', url: 'u' };
  };

  try {
    const urls = Array.from({ length: 10 }, (_, i) => `https://cf.cjdropshipping.com/${i}.jpg`);
    const uploaded = await cjMapperService.importImages('product-1', urls);

    assert.equal(uploaded, 10, 'every image must be uploaded');
    assert.equal(uploads, 10);
    assert.ok(maxInFlight > 1, 'images must not be imported strictly one-by-one');
    assert.ok(maxInFlight <= 4, `concurrency must stay bounded, saw ${maxInFlight}`);
  } finally {
    (globalThis as any).fetch = originalFetch;
    (productImageStorageService as any).uploadProductImage = originalUpload;
  }
});

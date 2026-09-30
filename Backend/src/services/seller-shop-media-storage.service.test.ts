import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import test, { after, before } from 'node:test';

import { STORAGE_NAMESPACE, storageConfig } from '../config/storage';
import { SellerShopMediaStorageService } from './seller-shop-media-storage.service';

/**
 * Unit tests for seller storefront media (logo + banner). The path layout
 * `logo/<userId>/…` / `banner/<userId>/…`, the public URL contract and the
 * replacement/delete cleanup are all part of the storefront behaviour the
 * frontend depends on, so they are pinned here.
 *
 * The storage root is supplied by the `test:storage` npm script.
 */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const USER_ID = 'user-1';

let service: SellerShopMediaStorageService;

const mediaFile = (relativePath: string) =>
  path.join(storageConfig.root, STORAGE_NAMESPACE.shopMedia, ...relativePath.split('/'));

before(() => {
  service = new SellerShopMediaStorageService();
  fs.rmSync(storageConfig.root, { recursive: true, force: true });
});

after(() => {
  fs.rmSync(storageConfig.root, { recursive: true, force: true });
});

test('a logo keeps the logo/<userId>/ layout and returns a configured public URL', async () => {
  const media = await service.uploadShopMedia('logo', USER_ID, PNG, 'My Logo.png', 'image/png');

  assert.match(media.path, new RegExp(`^logo/${USER_ID}/\\d+-my-logo\\.png$`));
  assert.equal(
    media.url,
    `${storageConfig.publicBaseUrl}${storageConfig.publicPathPrefix}/shop-media/${media.path}`,
  );
  assert.ok(fs.readFileSync(mediaFile(media.path)).equals(PNG));
});

test('a banner keeps the banner/<userId>/ layout', async () => {
  const media = await service.uploadShopMedia('banner', USER_ID, PNG, 'wide.jpg', 'image/jpeg');
  assert.match(media.path, new RegExp(`^banner/${USER_ID}/\\d+-wide\\.jpg$`));
});

test('two uploads of the same file never collide', async () => {
  const first = await service.uploadShopMedia('logo', USER_ID, PNG, 'same.png', 'image/png');
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await service.uploadShopMedia('logo', USER_ID, PNG, 'same.png', 'image/png');

  assert.notEqual(first.path, second.path);
  assert.ok(fs.existsSync(mediaFile(first.path)), 'the replaced file survives until cleanup');
  assert.ok(fs.existsSync(mediaFile(second.path)));
});

test('a filename that tries to traverse directories is neutralized', async () => {
  const media = await service.uploadShopMedia('banner', USER_ID, PNG, '../../../etc/pwn.png', 'image/png');
  assert.equal(media.path.split('/').length, 3, 'path must stay banner/<userId>/<file>');
  assert.ok(!media.path.includes('..'), 'no traversal segment may survive');
  // The resolved file is provably inside the shop-media namespace.
  const resolved = mediaFile(media.path);
  assert.ok(
    resolved.startsWith(path.join(storageConfig.root, STORAGE_NAMESPACE.shopMedia) + path.sep),
    `${resolved} must live under the shop-media namespace`,
  );
});

test('validation rejects empty, oversized, mistyped and wrongly named uploads', async () => {
  await assert.rejects(() => service.uploadShopMedia('logo', USER_ID, Buffer.alloc(0), 'a.png', 'image/png'), /empty/);
  await assert.rejects(
    () => service.uploadShopMedia('logo', USER_ID, Buffer.alloc(6 * 1024 * 1024), 'a.png', 'image/png'),
    /maximum size/,
  );
  await assert.rejects(
    () => service.uploadShopMedia('logo', USER_ID, PNG, 'a.gif', 'image/gif'),
    /Invalid image type/,
  );
  await assert.rejects(
    () => service.uploadShopMedia('logo', USER_ID, PNG, 'a.txt', 'image/png'),
    /Invalid image extension/,
  );
});

test('deleteShopMedia removes the file and tolerates repeats and nulls', async () => {
  const media = await service.uploadShopMedia('logo', USER_ID, PNG, 'gone.png', 'image/png');

  await service.deleteShopMedia(media.path);
  assert.equal(fs.existsSync(mediaFile(media.path)), false);

  await service.deleteShopMedia(media.path);
  await service.deleteShopMedia(null);
});

test('deleteShopMedia never throws on a legacy or hostile stored path', async () => {
  await service.deleteShopMedia('../../products/product-1/1-photo.jpg');
  await service.deleteShopMedia('logo/../../escape.png');
});

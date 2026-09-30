import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import test, { after, before } from 'node:test';

import { STORAGE_NAMESPACE, resolveStoragePath, storageConfig } from '../config/storage';
import localFileStorage, { StorageError } from './local-file-storage.service';

/**
 * Unit tests for the local filesystem storage layer. These run entirely on a
 * temporary STORAGE_ROOT supplied by the `test:storage` npm script — no
 * database, no network, no Supabase.
 */

const IMAGE = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

function listFilesRecursively(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? listFilesRecursively(full) : [full];
  });
}

before(async () => {
  fs.rmSync(storageConfig.root, { recursive: true, force: true });
  await localFileStorage.ensureReady();
});

after(() => {
  fs.rmSync(storageConfig.root, { recursive: true, force: true });
});

test('ensureReady creates every namespace with the expected modes', async () => {
  for (const namespace of [STORAGE_NAMESPACE.products, STORAGE_NAMESPACE.shopMedia]) {
    const dir = path.join(storageConfig.root, namespace);
    assert.ok(fs.existsSync(dir), `${namespace} directory must exist`);
    assert.equal(fs.statSync(dir).mode & 0o777, 0o755);
  }
  const privateDir = path.join(storageConfig.root, STORAGE_NAMESPACE.sellerDocuments);
  assert.ok(fs.existsSync(privateDir));
  assert.equal(fs.statSync(privateDir).mode & 0o777, 0o700);
});

test('write/read round-trips the exact bytes and leaves no temp files', async () => {
  const relativePath = 'product-1/1700000000000-photo.jpg';
  await localFileStorage.write(STORAGE_NAMESPACE.products, relativePath, IMAGE);

  const written = await localFileStorage.read(STORAGE_NAMESPACE.products, relativePath);
  assert.ok(written.equals(IMAGE), 'the stored bytes must be identical to the upload');

  const leftovers = listFilesRecursively(path.join(storageConfig.root, STORAGE_NAMESPACE.products))
    .filter((file) => file.includes('.tmp'));
  assert.deepEqual(leftovers, [], 'an atomic write must not leave temp files behind');
});

test('public files are world-readable, private files are owner-only', async () => {
  await localFileStorage.write(STORAGE_NAMESPACE.products, 'p/public.jpg', IMAGE);
  await localFileStorage.write(STORAGE_NAMESPACE.sellerDocuments, 'u-1/private.pdf', IMAGE);

  const publicMode = fs.statSync(
    resolveStoragePath(STORAGE_NAMESPACE.products, 'p/public.jpg'),
  ).mode & 0o777;
  const privateMode = fs.statSync(
    resolveStoragePath(STORAGE_NAMESPACE.sellerDocuments, 'u-1/private.pdf'),
  ).mode & 0o777;

  assert.equal(publicMode, 0o644);
  assert.equal(privateMode, 0o600);
});

test('nested directories inherit the namespace mode', async () => {
  await localFileStorage.write(STORAGE_NAMESPACE.sellerDocuments, 'u-2/nested/deep/id.jpg', IMAGE);
  const nested = path.join(
    storageConfig.root,
    STORAGE_NAMESPACE.sellerDocuments,
    'u-2',
    'nested',
    'deep',
  );
  assert.equal(fs.statSync(nested).mode & 0o777, 0o700);
});

test('write replaces an existing file in place without leaving a backup', async () => {
  const relativePath = 'p/replace.jpg';
  await localFileStorage.write(STORAGE_NAMESPACE.products, relativePath, Buffer.from('first'));
  await localFileStorage.write(STORAGE_NAMESPACE.products, relativePath, Buffer.from('second'));

  const content = await localFileStorage.read(STORAGE_NAMESPACE.products, relativePath);
  assert.equal(content.toString(), 'second');

  const files = listFilesRecursively(path.join(storageConfig.root, STORAGE_NAMESPACE.products))
    .filter((file) => file.includes('replace.jpg'));
  assert.equal(files.length, 1, 'no stale temp copies may survive a replacement');
});

test('stat reports the size of a stored file and null for a missing one', async () => {
  await localFileStorage.write(STORAGE_NAMESPACE.products, 'p/sized.jpg', IMAGE);
  const stats = await localFileStorage.stat(STORAGE_NAMESPACE.products, 'p/sized.jpg');
  assert.equal(stats?.size, IMAGE.length);
  assert.ok((stats?.modifiedAt ?? 0) > 0);

  assert.equal(await localFileStorage.stat(STORAGE_NAMESPACE.products, 'p/missing.jpg'), null);
});

test('remove deletes the file and is idempotent', async () => {
  const relativePath = 'p/removable.jpg';
  await localFileStorage.write(STORAGE_NAMESPACE.products, relativePath, IMAGE);

  assert.equal(await localFileStorage.remove(STORAGE_NAMESPACE.products, relativePath), true);
  assert.equal(await localFileStorage.remove(STORAGE_NAMESPACE.products, relativePath), false);
});

test('read of a missing file raises a StorageError, not a raw errno', async () => {
  await assert.rejects(
    () => localFileStorage.read(STORAGE_NAMESPACE.products, 'p/nope.jpg'),
    (error: unknown) => error instanceof StorageError && /not found/.test((error as Error).message),
  );
});

test('traversal paths are rejected by every operation', async () => {
  const attempts = ['../escape.jpg', 'p/../../escape.jpg', '/etc/passwd', 'p/\0.jpg'];
  for (const attempt of attempts) {
    await assert.rejects(() => localFileStorage.stat(STORAGE_NAMESPACE.products, attempt));
    await assert.rejects(() => localFileStorage.read(STORAGE_NAMESPACE.products, attempt));
    await assert.rejects(() => localFileStorage.remove(STORAGE_NAMESPACE.products, attempt));
  }
  // Nothing escaped the storage root.
  assert.equal(fs.existsSync(path.join(path.dirname(storageConfig.root), 'escape.jpg')), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'path';

import {
  PRIVATE_STORAGE_NAMESPACES,
  PUBLIC_STORAGE_NAMESPACES,
  STORAGE_NAMESPACE,
  apiUrl,
  dirModeFor,
  fileModeFor,
  isPrivateNamespace,
  namespaceDir,
  normalizeStoragePath,
  publicFileUrl,
  resolveStoragePath,
  storageConfig,
} from './storage';

/**
 * Unit tests for the local storage configuration. These guard the two
 * invariants the whole storage layer rests on: relative paths in the database,
 * and no public URL for anything private.
 *
 * The storage root is supplied by the `test:storage` npm script.
 */

test('every namespace resolves to its own directory under the storage root', () => {
  assert.equal(namespaceDir(STORAGE_NAMESPACE.products), path.join(storageConfig.root, 'products'));
  assert.equal(namespaceDir(STORAGE_NAMESPACE.shopMedia), path.join(storageConfig.root, 'shop-media'));
  assert.equal(
    namespaceDir(STORAGE_NAMESPACE.sellerDocuments),
    path.join(storageConfig.root, 'seller-documents'),
  );
});

test('only products and shop-media are public; seller documents are private', () => {
  assert.deepEqual([...PUBLIC_STORAGE_NAMESPACES].sort(), ['products', 'shop-media']);
  assert.deepEqual([...PRIVATE_STORAGE_NAMESPACES], ['seller-documents']);
  assert.equal(isPrivateNamespace(STORAGE_NAMESPACE.sellerDocuments), true);
  assert.equal(isPrivateNamespace(STORAGE_NAMESPACE.products), false);
  assert.equal(isPrivateNamespace(STORAGE_NAMESPACE.shopMedia), false);
});

test('private namespaces get owner-only modes, public ones stay world-readable', () => {
  assert.equal(fileModeFor(STORAGE_NAMESPACE.sellerDocuments) & 0o077, 0);
  assert.equal(dirModeFor(STORAGE_NAMESPACE.sellerDocuments) & 0o077, 0);
  assert.ok(fileModeFor(STORAGE_NAMESPACE.products) & 0o044);
  assert.ok(dirModeFor(STORAGE_NAMESPACE.shopMedia) & 0o044);
});

test('normalizeStoragePath canonicalises redundant separators', () => {
  assert.equal(normalizeStoragePath('abc/123-photo.jpg'), 'abc/123-photo.jpg');
  assert.equal(normalizeStoragePath('abc/./123-photo.jpg'), 'abc/123-photo.jpg');
  assert.equal(normalizeStoragePath('abc//123-photo.jpg'), 'abc/123-photo.jpg');
  assert.equal(normalizeStoragePath('abc\\123-photo.jpg'), 'abc/123-photo.jpg');
});

test('normalizeStoragePath rejects traversal, absolute paths, NUL bytes and empties', () => {
  assert.throws(() => normalizeStoragePath('../escape.jpg'), /must not traverse/);
  assert.throws(() => normalizeStoragePath('abc/../../escape.jpg'), /must not traverse/);
  assert.throws(() => normalizeStoragePath('/etc/passwd'), /must be relative/);
  assert.throws(() => normalizeStoragePath('C:\\Windows\\system32'), /must be relative/);
  assert.throws(() => normalizeStoragePath('abc/\0.jpg'), /NUL/);
  assert.throws(() => normalizeStoragePath(''), /non-empty/);
  assert.throws(() => normalizeStoragePath('.'), /at least one segment/);
});

test('resolveStoragePath can never address a file outside its namespace', () => {
  const productsDir = namespaceDir(STORAGE_NAMESPACE.products);
  assert.equal(
    resolveStoragePath(STORAGE_NAMESPACE.products, 'p1/1-photo.jpg'),
    path.join(productsDir, 'p1', '1-photo.jpg'),
  );
  // A namespace name can never be used as a hop into a sibling namespace.
  assert.throws(
    () => resolveStoragePath(STORAGE_NAMESPACE.products, '../seller-documents/user-1/id.pdf'),
    /must not traverse/,
  );
  // The resolved path is always inside the namespace directory.
  const resolved = resolveStoragePath(STORAGE_NAMESPACE.shopMedia, 'logo/user-1/1-logo.png');
  assert.ok(
    resolved.startsWith(namespaceDir(STORAGE_NAMESPACE.shopMedia) + path.sep),
    `${resolved} must live under the shop-media namespace`,
  );
});

test('public URLs are built from configuration, not hardcoded', () => {
  const base = storageConfig.publicBaseUrl;
  const url = publicFileUrl(STORAGE_NAMESPACE.products, 'p1/1712345-photo one.jpg');

  assert.ok(url.startsWith(`${base}${storageConfig.publicPathPrefix}/products/`));
  // Path structure is preserved; only the filename is percent-encoded.
  assert.ok(url.endsWith('/products/p1/1712345-photo%20one.jpg'));
});

test('a private namespace can never produce a public URL', () => {
  assert.throws(
    () => publicFileUrl(STORAGE_NAMESPACE.sellerDocuments, 'user-1/1-id.jpg'),
    /private/,
  );
});

test('apiUrl builds a versioned backend route from configuration', () => {
  assert.ok(apiUrl('/seller-documents/download').endsWith('/api/v1/seller-documents/download'));
  assert.ok(apiUrl('seller-documents/download').includes('/api/v1/seller-documents/download'));
});

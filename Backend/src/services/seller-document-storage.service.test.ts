import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import test, { after, before } from 'node:test';

import { STORAGE_NAMESPACE, storageConfig } from '../config/storage';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { SellerDocumentStorageService } from './seller-document-storage.service';

/**
 * Unit tests for private seller identity-document storage. The security
 * properties under test are that a document is never reachable through a
 * public URL and that download links cannot be forged, reused after expiry,
 * or pointed at a different file.
 *
 * The storage root is supplied by the `test:storage` npm script.
 */

const PDF = Buffer.from('%PDF-1.4\n%emart test document\n');
const USER_ID = 'user-1';
const TTL_SECONDS = storageConfig.documentUrlTtlSeconds;

let service: SellerDocumentStorageService;
let storedPath: string;

/** Absolute on-disk location of a stored document. */
const documentFile = (relativePath: string) =>
  path.join(storageConfig.root, STORAGE_NAMESPACE.sellerDocuments, ...relativePath.split('/'));

before(async () => {
  service = new SellerDocumentStorageService();
  const uploaded = await service.uploadSellerDocument(USER_ID, PDF, 'my id.pdf', 'application/pdf');
  storedPath = uploaded.path;
});

after(() => {
  fs.rmSync(storageConfig.root, { recursive: true, force: true });
});

test('upload stores the file under the seller namespace and returns no URL', async () => {
  assert.equal(storedPath, `${USER_ID}/${storedPath.split('/')[1]}`);
  assert.ok(fs.existsSync(documentFile(storedPath)));

  const second = await service.uploadSellerDocument(USER_ID, PDF, 'my id.pdf', 'application/pdf');
  // The result carries only a path and a MIME type — never anything public.
  assert.deepEqual(Object.keys(second).sort(), ['mimetype', 'path']);
});

test('uploaded documents are owner-only on disk', () => {
  assert.equal(fs.statSync(documentFile(storedPath)).mode & 0o777, 0o600);
});

test('the filename is sanitized before it reaches the filesystem', async () => {
  const uploaded = await service.uploadSellerDocument(USER_ID, PDF, '../../Evil Name!.pdf', 'application/pdf');
  assert.equal(uploaded.path.split('/').length, 2, 'the path must not gain extra segments');
  assert.ok(!uploaded.path.includes('..'));
  assert.ok(uploaded.path.endsWith('-evil-name-.pdf') || uploaded.path.endsWith('-evil-name.pdf'));
});

test('validation rejects the wrong type, the wrong extension and oversized files', async () => {
  await assert.rejects(
    () => service.uploadSellerDocument(USER_ID, PDF, 'id.txt', 'text/plain'),
    BadRequestError,
  );
  await assert.rejects(
    () => service.uploadSellerDocument(USER_ID, PDF, 'id.exe', 'application/pdf'),
    /extension/i,
  );
  await assert.rejects(
    () => service.uploadSellerDocument(USER_ID, Buffer.alloc(0), 'id.pdf', 'application/pdf'),
    /empty/i,
  );
  await assert.rejects(
    () =>
      service.uploadSellerDocument(
        USER_ID,
        Buffer.alloc(9 * 1024 * 1024),
        'id.pdf',
        'application/pdf',
      ),
    /maximum size/i,
  );
});

test('createSignedDocumentUrl points at the guarded backend download route', async () => {
  const url = await service.createSignedDocumentUrl(storedPath);
  assert.ok(url.includes('/api/v1/seller-documents/download?token='));
  assert.ok(!url.includes(encodeURIComponent(storedPath)), 'the storage path must never be in the URL');
  assert.ok(!url.includes('/uploads/'), 'a document must never be served from the public prefix');
});

test('a minted token round-trips back to the stored path', () => {
  const url = (service as any).sign(storedPath, Date.now() + 60_000) as string;
  assert.equal(service.verifyDocumentToken(url).path, storedPath);
});

test('a tampered payload or signature is rejected', () => {
  const token = (service as any).sign(storedPath, Date.now() + 60_000) as string;
  const [payload, signature] = token.split('.');

  // Payload swapped for someone else's document.
  const forgedPayload = Buffer.from(
    JSON.stringify({ p: 'user-2/1-id.jpg', e: Date.now() + 60_000 }),
    'utf8',
  ).toString('base64url');
  assert.throws(() => service.verifyDocumentToken(`${forgedPayload}.${signature}`), BadRequestError);

  // Signature stripped or replaced.
  assert.throws(() => service.verifyDocumentToken(payload), BadRequestError);
  assert.throws(
    () => service.verifyDocumentToken(`${payload}.${'A'.repeat(signature.length)}`),
    BadRequestError,
  );
  // Wholly malformed input.
  assert.throws(() => service.verifyDocumentToken(''), BadRequestError);
  assert.throws(() => service.verifyDocumentToken('not-a-token'), BadRequestError);
  assert.throws(() => service.verifyDocumentToken('...'), BadRequestError);
});

test('an expired token is rejected', () => {
  const token = (service as any).sign(storedPath, Date.now() - 1) as string;
  assert.throws(() => service.verifyDocumentToken(token), /invalid or has expired/);
});

test('openSellerDocument streams the file with its stored MIME type', async () => {
  const document = await service.openSellerDocument(storedPath, 'application/pdf');
  assert.equal(document.mimetype, 'application/pdf');
  assert.equal(document.size, PDF.length);
  assert.equal(document.filename, storedPath.split('/').pop());

  const chunks: Buffer[] = [];
  for await (const chunk of document.stream) chunks.push(chunk as Buffer);
  assert.ok(Buffer.concat(chunks).equals(PDF));
});

test('an unknown MIME type falls back instead of echoing attacker-controlled input', async () => {
  const document = await service.openSellerDocument(storedPath, 'text/html');
  assert.equal(document.mimetype, 'application/pdf');
});

test('openSellerDocument 404s for a path that is not stored', async () => {
  await assert.rejects(
    () => service.openSellerDocument('user-1/does-not-exist.pdf'),
    NotFoundError,
  );
  await assert.rejects(() => service.openSellerDocument(''), NotFoundError);
});

test('a traversal path stored by a forged token still cannot escape the namespace', async () => {
  await assert.rejects(
    () => service.openSellerDocument('../../products/p1/1-photo.jpg'),
    /escape|must not traverse/,
  );
});

test('createSignedDocumentUrl 404s when there is no document on file', async () => {
  await assert.rejects(() => service.createSignedDocumentUrl(''), NotFoundError);
});

test('deleteSellerDocument removes the file and tolerates a missing one', async () => {
  const uploaded = await service.uploadSellerDocument(USER_ID, PDF, 'gone.pdf', 'application/pdf');
  await service.deleteSellerDocument(uploaded.path);
  assert.equal(fs.existsSync(documentFile(uploaded.path)), false);
  await service.deleteSellerDocument(uploaded.path);
  await service.deleteSellerDocument('');
});

test('the advertised TTL matches the configured one', () => {
  assert.equal(service.signedUrlTtlSeconds, TTL_SECONDS);
  assert.ok(TTL_SECONDS > 0);
});

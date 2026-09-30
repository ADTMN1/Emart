import { createHmac, timingSafeEqual } from 'crypto';
import { STORAGE_NAMESPACE, apiUrl, storageConfig } from '../config/storage';
import localFileStorage, { StorageError } from './local-file-storage.service';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { ReadStream } from 'fs';
import path from 'path';
import config from '../config/env';

/**
 * Seller identity-document storage.
 *
 * Identity documents (ID cards, passports, driver's licences) are sensitive
 * personal data, so they live in the private `seller-documents` namespace:
 * owner-only permissions on disk, never mounted by the static file handler,
 * never aliased by Nginx, and never given a public URL.
 *
 * The only way to read a document is the backend stream endpoint. It can be
 * reached two ways, both of which resolve to the same guarded stream:
 *
 *  1. Authenticated — an ADMIN calls the application document route with a
 *     normal `Authorization: Bearer <token>` header and the file is streamed.
 *  2. Signed link — an ADMIN asks the application document route for a
 *     short-lived, HMAC-signed URL. The token *is* the credential, which keeps
 *     the existing `{ url, expiresIn }` response contract (and the admin UI's
 *     "open in a new tab" flow) working without ever exposing the storage path
 *     or the file over a public directory.
 */

const NAMESPACE = STORAGE_NAMESPACE.sellerDocuments;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

export interface SellerDocumentUpload {
  path: string;
  mimetype: string;
}

export interface VerifiedDocumentToken {
  path: string;
  /** Epoch milliseconds at which the token stops being valid. */
  expiresAt: number;
}

export interface SellerDocumentStream {
  stream: ReadStream;
  size: number;
  mimetype: string;
  /** Sanitized filename suggested to the browser on download. */
  filename: string;
}

/** Route that streams a document given a signed token. */
const DOCUMENT_DOWNLOAD_ROUTE = '/seller-documents/download';

export class SellerDocumentStorageService {
  /**
   * Signing key for document download tokens. Derived from JWT_SECRET with a
   * purpose-specific suffix so the key can never be reused across contexts,
   * and so rotating the JWT secret also invalidates outstanding document
   * links.
   */
  private readonly signingKey = createHmac('sha256', config.jwt.secret)
    .update('emart:seller-document-download:v1')
    .digest();

  private sanitizeFilename(filename: string): string {
    const sanitized = filename
      .replace(/[^a-zA-Z0-9.-]/g, '-')
      .replace(/\.{2,}/g, '.')
      .replace(/-{2,}/g, '-')
      .toLowerCase();
    return sanitized.replace(/^[.-]+/, '') || 'document';
  }

  /** Validate file size, MIME type and extension before touching storage. */
  private validateFile(file: Buffer, mimetype: string, originalFilename: string): void {
    if (!file || file.length === 0) {
      throw new BadRequestError('The uploaded identity document is empty.');
    }
    if (file.length > MAX_FILE_SIZE) {
      throw new BadRequestError(
        `Identity document exceeds the maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
      );
    }
    if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
      throw new BadRequestError(
        `Invalid identity document type. Allowed types: JPG, PNG, WEBP, PDF.`,
      );
    }
    const ext = path.extname(originalFilename || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestError(
        `Invalid identity document extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`,
      );
    }
    if ((originalFilename || '').includes('\0')) {
      throw new BadRequestError('Invalid identity document filename.');
    }
  }

  /**
   * Upload a seller identity document for a user. Returns the private storage
   * path (persisted on the application) — never a public URL.
   */
  async uploadSellerDocument(
    userId: string,
    file: Buffer,
    filename: string,
    mimetype: string,
  ): Promise<SellerDocumentUpload> {
    this.validateFile(file, mimetype, filename);

    const storagePath = `${userId}/${Date.now()}-${this.sanitizeFilename(filename)}`;

    try {
      await localFileStorage.write(NAMESPACE, storagePath, file);
    } catch (error) {
      console.error('Seller document upload error:', error);
      if (error instanceof StorageError) {
        throw new BadRequestError('Failed to upload identity document. Please try again.');
      }
      throw error;
    }

    return { path: storagePath, mimetype };
  }

  /**
   * Mint a short-lived signed download URL for a stored document.
   *
   * The URL points at this backend's own download route and carries an
   * HMAC-SHA256 signature over the storage path and an expiry. It is not a
   * public file URL: it is only accepted by the guarded stream handler, and it
   * stops working once it expires.
   */
  async createSignedDocumentUrl(storagePath: string): Promise<string> {
    if (!storagePath) {
      throw new NotFoundError('This application has no identity document on file.');
    }

    const expiresAt = Date.now() + storageConfig.documentUrlTtlSeconds * 1000;
    const token = this.sign(storagePath, expiresAt);

    return `${apiUrl(DOCUMENT_DOWNLOAD_ROUTE)}?token=${encodeURIComponent(token)}`;
  }

  /** Lifetime of a minted document URL, in seconds. */
  get signedUrlTtlSeconds(): number {
    return storageConfig.documentUrlTtlSeconds;
  }

  /**
   * Verify a download token and return the storage path it authorizes.
   * Throws `BadRequestError` for a malformed, forged or expired token — the
   * three cases are deliberately indistinguishable to the caller so the
   * endpoint cannot be used as a signature oracle.
   */
  verifyDocumentToken(token: string): VerifiedDocumentToken {
    const invalid = () => new BadRequestError('This document link is invalid or has expired.');

    if (typeof token !== 'string' || token.length === 0) {
      throw invalid();
    }

    const separator = token.indexOf('.');
    if (separator <= 0 || separator === token.length - 1) {
      throw invalid();
    }

    const payload = token.slice(0, separator);
    const signature = token.slice(separator + 1);

    let expected: string;
    let expiresAt: number;
    let storagePath: string;
    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      storagePath = decoded?.p;
      expiresAt = decoded?.e;
    } catch {
      throw invalid();
    }

    if (typeof storagePath !== 'string' || !Number.isFinite(expiresAt)) {
      throw invalid();
    }

    const provided = Buffer.from(signature, 'base64url');
    const computed = Buffer.from(this.computeSignature(payload), 'base64url');
    if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
      throw invalid();
    }

    if (Date.now() >= expiresAt) {
      throw invalid();
    }

    return { path: storagePath, expiresAt };
  }

  /**
   * Open a stored document for streaming. Only ever called from the
   * authenticated/signed download handler — the caller must have established
   * authorization first.
   */
  async openSellerDocument(storagePath: string, mimetype?: string): Promise<SellerDocumentStream> {
    if (!storagePath) {
      throw new NotFoundError('This application has no identity document on file.');
    }

    const stats = await localFileStorage.stat(NAMESPACE, storagePath);
    if (!stats) {
      console.error('Seller document is missing from storage:', storagePath);
      throw new NotFoundError('Identity document could not be found in storage.');
    }

    const extension = path.extname(storagePath).toLowerCase();
    const resolvedMimeType =
      (mimetype && ALLOWED_MIME_TYPES.includes(mimetype) ? mimetype : undefined) ||
      (extension === '.pdf' ? 'application/pdf' : 'application/octet-stream');

    return {
      stream: localFileStorage.createReadStream(NAMESPACE, storagePath),
      size: stats.size,
      mimetype: resolvedMimeType,
      filename: path.basename(storagePath),
    };
  }

  /** Best-effort removal of a stored document (e.g. after a failed submit). */
  async deleteSellerDocument(storagePath: string): Promise<void> {
    if (!storagePath) return;
    await localFileStorage.remove(NAMESPACE, storagePath);
  }

  /** Build the signed token: base64url(payload).base64url(HMAC). */
  private sign(storagePath: string, expiresAt: number): string {
    const payload = Buffer.from(
      JSON.stringify({ p: storagePath, e: expiresAt }),
      'utf8',
    ).toString('base64url');
    return `${payload}.${this.computeSignature(payload)}`;
  }

  /** HMAC-SHA256 over the encoded payload, base64url encoded. */
  private computeSignature(payload: string): string {
    return createHmac('sha256', this.signingKey).update(payload).digest('base64url');
  }
}

export default new SellerDocumentStorageService();

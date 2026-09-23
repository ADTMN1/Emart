import supabase from '../config/supabase';
import { BadRequestError, NotFoundError } from '../utils/errors';
import path from 'path';

/**
 * Seller identity-document storage.
 *
 * Identity documents (ID cards, passports, driver's licences) are sensitive
 * personal data, so they live in a dedicated **private** Supabase Storage
 * bucket. Objects are never given a public URL: the only way to read one is
 * `createSignedDocumentUrl`, which mints a short-lived signed URL and is only
 * called from the admin-only review endpoint.
 */

const BUCKET_NAME = 'seller-documents';
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
/** Signed document URLs are valid for 5 minutes. */
const SIGNED_URL_TTL_SECONDS = 300;

export interface SellerDocumentUpload {
  path: string;
  mimetype: string;
}

export class SellerDocumentStorageService {
  /** Lazily create the private bucket once per process. */
  private bucketReady: Promise<void> | null = null;

  private ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      this.bucketReady = (async () => {
        const { data, error } = await supabase.storage.getBucket(BUCKET_NAME);
        if (!error && data) return;
        const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: MAX_FILE_SIZE,
          allowedMimeTypes: ALLOWED_MIME_TYPES,
        });
        // A concurrent creator winning the race returns a duplicate error;
        // the bucket exists either way, so only surface other failures.
        if (createError && !/already exists/i.test(createError.message)) {
          throw new BadRequestError(
            `Could not prepare the seller-document storage bucket: ${createError.message}`,
          );
        }
      })().catch((err) => {
        // Reset so a later request can retry after a transient failure.
        this.bucketReady = null;
        throw err;
      });
    }
    return this.bucketReady;
  }

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
    await this.ensureBucket();
    this.validateFile(file, mimetype, filename);

    const storagePath = `${userId}/${Date.now()}-${this.sanitizeFilename(filename)}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, file, { contentType: mimetype, upsert: false });

    if (error) {
      console.error('Seller document upload error:', error);
      throw new BadRequestError(`Failed to upload identity document: ${error.message}`);
    }

    return { path: storagePath, mimetype };
  }

  /** Mint a short-lived signed URL for an admin to view a stored document. */
  async createSignedDocumentUrl(storagePath: string): Promise<string> {
    if (!storagePath) {
      throw new NotFoundError('This application has no identity document on file.');
    }
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      console.error('Seller document signed URL error:', error);
      throw new NotFoundError('Identity document could not be found in storage.');
    }
    return data.signedUrl;
  }

  /** Best-effort removal of a stored document (e.g. after a failed submit). */
  async deleteSellerDocument(storagePath: string): Promise<void> {
    if (!storagePath) return;
    try {
      await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    } catch (error) {
      console.error('Failed to remove seller document:', error);
    }
  }
}

export default new SellerDocumentStorageService();
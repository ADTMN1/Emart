import supabase from '../config/supabase';
import { BadRequestError } from '../utils/errors';
import path from 'path';

/**
 * Seller storefront media (logo + banner) storage.
 *
 * Storefront images are public by design — they are rendered on the public
 * storefront — so they live in a **public** Supabase Storage bucket and are
 * exposed to the client as public URLs. The storage path stays private and is
 * persisted alongside the URL so a replacement/removal can delete the old
 * object (public URLs alone can't be used to delete).
 */

const BUCKET_NAME = 'shop-media';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB — matches multer's uploadSingle cap
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

export type ShopMediaKind = 'logo' | 'banner';

export interface ShopMediaUpload {
  path: string;
  url: string;
}

export class SellerShopMediaStorageService {
  /** Lazily create the public bucket once per process. */
  private bucketReady: Promise<void> | null = null;

  private ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      this.bucketReady = (async () => {
        const { data, error } = await supabase.storage.getBucket(BUCKET_NAME);
        if (!error && data) return;
        const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: MAX_FILE_SIZE,
          allowedMimeTypes: ALLOWED_MIME_TYPES,
        });
        // A concurrent creator winning the race returns a duplicate error;
        // the bucket exists either way, so only surface other failures.
        if (createError && !/already exists/i.test(createError.message)) {
          throw new BadRequestError(
            `Could not prepare the shop-media storage bucket: ${createError.message}`,
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
    return sanitized.replace(/^[.-]+/, '') || 'image';
  }

  /** Validate file size, MIME type and extension before touching storage. */
  private validateFile(file: Buffer, mimetype: string, originalFilename: string): void {
    if (!file || file.length === 0) {
      throw new BadRequestError('The uploaded image is empty.');
    }
    if (file.length > MAX_FILE_SIZE) {
      throw new BadRequestError(
        `Image exceeds the maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
      );
    }
    if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
      throw new BadRequestError(
        `Invalid image type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}.`,
      );
    }
    const ext = path.extname(originalFilename || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestError(
        `Invalid image extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`,
      );
    }
    if ((originalFilename || '').includes('\0')) {
      throw new BadRequestError('Invalid image filename.');
    }
  }

  /**
   * Upload a storefront image for a seller. Returns the private storage path
   * (persisted on the profile for later cleanup) plus the public URL that
   * frontends render.
   */
  async uploadShopMedia(
    kind: ShopMediaKind,
    userId: string,
    file: Buffer,
    filename: string,
    mimetype: string,
  ): Promise<ShopMediaUpload> {
    await this.ensureBucket();
    this.validateFile(file, mimetype, filename);

    const storagePath = `${kind}/${userId}/${Date.now()}-${this.sanitizeFilename(filename)}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, file, { contentType: mimetype, upsert: false });

    if (error) {
      console.error(`Shop ${kind} upload error:`, error);
      throw new BadRequestError(`Failed to upload ${kind}: ${error.message}`);
    }

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

    return { path: storagePath, url: urlData.publicUrl };
  }

  /** Best-effort removal of a stored image (e.g. on replacement or removal). */
  async deleteShopMedia(storagePath: string | null): Promise<void> {
    if (!storagePath) return;
    try {
      await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    } catch (error) {
      console.error(`Failed to remove shop media "${storagePath}":`, error);
    }
  }
}

export default new SellerShopMediaStorageService();
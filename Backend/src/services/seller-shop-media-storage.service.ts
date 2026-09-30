import { STORAGE_NAMESPACE, publicFileUrl } from '../config/storage';
import localFileStorage, { StorageError } from './local-file-storage.service';
import { BadRequestError } from '../utils/errors';
import path from 'path';

/**
 * Seller storefront media (logo + banner) storage.
 *
 * Storefront images are public by design — they are rendered on the public
 * storefront — so they live in the public `shop-media` namespace and are
 * exposed to the client as public URLs served from the local storage root. The
 * storage path stays private and is persisted alongside the URL so a
 * replacement/removal can delete the old file (public URLs alone can't be used
 * to delete).
 */

const NAMESPACE = STORAGE_NAMESPACE.shopMedia;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB — matches multer's uploadSingle cap
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

export type ShopMediaKind = 'logo' | 'banner';

export interface ShopMediaUpload {
  path: string;
  url: string;
}

export class SellerShopMediaStorageService {
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
    this.validateFile(file, mimetype, filename);

    const storagePath = `${kind}/${userId}/${Date.now()}-${this.sanitizeFilename(filename)}`;

    try {
      await localFileStorage.write(NAMESPACE, storagePath, file);
    } catch (error) {
      console.error(`Shop ${kind} upload error:`, error);
      if (error instanceof StorageError) {
        throw new BadRequestError(`Failed to upload ${kind}. Please try again.`);
      }
      throw error;
    }

    return { path: storagePath, url: publicFileUrl(NAMESPACE, storagePath) };
  }

  /** Best-effort removal of a stored image (e.g. on replacement or removal). */
  async deleteShopMedia(storagePath: string | null): Promise<void> {
    if (!storagePath) return;
    try {
      await localFileStorage.remove(NAMESPACE, storagePath);
    } catch (error) {
      // Never let a bad legacy path break a successful replacement/removal.
      console.error(
        `Failed to remove shop media "${storagePath}":`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export default new SellerShopMediaStorageService();

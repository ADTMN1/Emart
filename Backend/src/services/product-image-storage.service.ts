import prisma from '../config/database';
import { STORAGE_NAMESPACE, publicFileUrl } from '../config/storage';
import localFileStorage, { StorageError } from './local-file-storage.service';
import { BadRequestError, NotFoundError } from '../utils/errors';
import path from 'path';

const NAMESPACE = STORAGE_NAMESPACE.products;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

interface UploadResult {
  id: string;
  path: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

/**
 * Product image storage on the local filesystem.
 *
 * The database keeps the *relative* storage path (`<productId>/<ts>-<name>.jpg`)
 * plus the public URL derived from configuration, so moving the storage root
 * never requires a data migration. Both admin and seller products share this
 * single pipeline.
 */
export class ProductImageStorageService {
  /**
   * @param prismaClient Injectable for tests; defaults to the shared client.
   */
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  /**
   * Sanitize filename to prevent path traversal attacks
   */
  private sanitizeFilename(filename: string): string {
    // Remove any path separators and special characters
    const sanitized = filename
      .replace(/[^a-zA-Z0-9.-]/g, '-')
      .replace(/\.{2,}/g, '.')
      .replace(/-{2,}/g, '-')
      .toLowerCase();

    // Ensure filename doesn't start with a dot or dash
    return sanitized.replace(/^[.-]+/, '');
  }

  /**
   * Validate file before upload
   */
  private validateFile(file: Buffer, mimetype: string, originalFilename: string): void {
    // Check file size
    if (file.length > MAX_FILE_SIZE) {
      throw new BadRequestError(
        `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024} MB`
      );
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
      throw new BadRequestError(
        `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
      );
    }

    // Check file extension
    const ext = path.extname(originalFilename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestError(
        `Invalid file extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`
      );
    }

    // Basic file validation (check for null bytes, etc.)
    if (originalFilename.includes('\0')) {
      throw new BadRequestError('Invalid filename');
    }
  }

  /**
   * Generate unique storage path for product image
   */
  private generateStoragePath(productId: string, filename: string): string {
    const timestamp = Date.now();
    const sanitized = this.sanitizeFilename(filename);
    return `${productId}/${timestamp}-${sanitized}`;
  }

  /**
   * Upload product image to local storage and save metadata to database
   */
  async uploadProductImage(
    productId: string,
    file: Buffer,
    filename: string,
    mimetype: string
  ): Promise<UploadResult> {
    // Validate product exists
    const product = await this.prismaClient.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Validate file
    this.validateFile(file, mimetype, filename);

    // Generate storage path
    const storagePath = this.generateStoragePath(productId, filename);

    // Write to local storage. The file is only visible under its final name
    // once the write has completed, so a failed upload can never be served.
    try {
      await localFileStorage.write(NAMESPACE, storagePath, file);
    } catch (error) {
      console.error('Product image storage error:', error);
      if (error instanceof StorageError) {
        throw new BadRequestError('Failed to store the image. Please try again.');
      }
      throw error;
    }

    // Public URL is derived from configuration, never hardcoded
    const publicUrl = publicFileUrl(NAMESPACE, storagePath);

    try {
      // Place the new image after the current last one. Using max(sortOrder)+1
      // (instead of the row count) keeps sequences dense and collision-free
      // even after images have been deleted or reordered.
      const last = await this.prismaClient.productImage.aggregate({
        where: { productId },
        _max: { sortOrder: true },
      });
      const nextSortOrder = (last._max.sortOrder ?? -1) + 1;

      // Save metadata to database
      const productImage = await this.prismaClient.productImage.create({
        data: {
          productId,
          path: storagePath,
          url: publicUrl,
          isPrimary: nextSortOrder === 0, // First image is primary by default
          sortOrder: nextSortOrder,
        },
      });

      return {
        id: productImage.id,
        path: productImage.path,
        url: productImage.url!,
        isPrimary: productImage.isPrimary,
        sortOrder: productImage.sortOrder,
      };
    } catch (dbError) {
      // If database save fails, clean up the stored file so the disk does not
      // accumulate images that no product references.
      console.error('Database save error:', dbError);

      await localFileStorage.remove(NAMESPACE, storagePath);

      throw new BadRequestError('Failed to save image metadata');
    }
  }

  /**
   * Delete product image from local storage and database
   */
  async deleteProductImage(productId: string, imageId: string): Promise<void> {
    // Find the image
    const image = await this.prismaClient.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
    });

    if (!image) {
      throw new NotFoundError('Image not found');
    }

    // Remove the file first. A failure here is logged by the storage layer and
    // must not block the DB deletion, otherwise a single unremovable file
    // would make the image undeletable forever.
    await localFileStorage.remove(NAMESPACE, image.path);

    // Delete from database
    await this.prismaClient.productImage.delete({
      where: { id: imageId },
    });

    // If deleted image was primary, set another image as primary
    if (image.isPrimary) {
      const nextImage = await this.prismaClient.productImage.findFirst({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
      });

      if (nextImage) {
        await this.prismaClient.productImage.update({
          where: { id: nextImage.id },
          data: { isPrimary: true },
        });
      }
    }
  }

  /**
   * Get public URL for a product image
   */
  getPublicProductImageUrl(path: string): string {
    return publicFileUrl(NAMESPACE, path);
  }

  /**
   * Get all images for a product
   */
  async getProductImages(productId: string) {
    return await this.prismaClient.productImage.findMany({
      where: { productId },
      orderBy: [
        { isPrimary: 'desc' },
        { sortOrder: 'asc' },
      ],
    });
  }

  /**
   * Set image as primary
   */
  async setPrimaryImage(productId: string, imageId: string): Promise<void> {
    // Verify image belongs to product
    const image = await this.prismaClient.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
    });

    if (!image) {
      throw new NotFoundError('Image not found');
    }

    // Remove primary flag from all product images
    await this.prismaClient.productImage.updateMany({
      where: { productId },
      data: { isPrimary: false },
    });

    // Set the new primary image
    await this.prismaClient.productImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    });
  }

  /**
   * Reorder product images
   */
  async reorderImages(productId: string, imageOrders: { id: string; sortOrder: number }[]): Promise<void> {
    // Verify all images belong to the product
    const images = await this.prismaClient.productImage.findMany({
      where: {
        productId,
        id: { in: imageOrders.map(io => io.id) },
      },
    });

    if (images.length !== imageOrders.length) {
      throw new BadRequestError('Some images do not belong to this product');
    }

    // Update sort orders atomically so a partial failure cannot leave a
    // half-reordered sequence behind.
    await this.prismaClient.$transaction(
      imageOrders.map(({ id, sortOrder }) =>
        this.prismaClient.productImage.update({
          where: { id },
          data: { sortOrder },
        })
      )
    );
  }
}

export default new ProductImageStorageService();

import supabase from '../config/supabase';
import prisma from '../config/database';
import { BadRequestError, NotFoundError } from '../utils/errors';
import path from 'path';

const BUCKET_NAME = 'products';
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

export class ProductImageStorageService {
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
   * Retry helper with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break;
        }

        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        console.log(`Storage upload attempt ${attempt} failed, retrying in ${delay}ms...`);
        console.error('Error:', error.message || error);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Upload product image to Supabase Storage and save metadata to database
   */
  async uploadProductImage(
    productId: string,
    file: Buffer,
    filename: string,
    mimetype: string
  ): Promise<UploadResult> {
    // Validate product exists
    const product = await prisma.product.findUnique({
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

    // Upload to Supabase Storage with retry logic
    await this.retryWithBackoff(async () => {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file, {
          contentType: mimetype,
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      return true;
    }, 3, 2000); // 3 retries, starting with 2s delay

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    try {
      // Place the new image after the current last one. Using max(sortOrder)+1
      // (instead of the row count) keeps sequences dense and collision-free
      // even after images have been deleted or reordered.
      const last = await prisma.productImage.aggregate({
        where: { productId },
        _max: { sortOrder: true },
      });
      const nextSortOrder = (last._max.sortOrder ?? -1) + 1;

      // Save metadata to database
      const productImage = await prisma.productImage.create({
        data: {
          productId,
          path: storagePath,
          url: urlData.publicUrl,
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
      // If database save fails, clean up uploaded file
      console.error('Database save error:', dbError);
      
      try {
        await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded file:', cleanupError);
      }

      throw new BadRequestError('Failed to save image metadata');
    }
  }

  /**
   * Delete product image from Storage and database
   */
  async deleteProductImage(productId: string, imageId: string): Promise<void> {
    // Find the image
    const image = await prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
    });

    if (!image) {
      throw new NotFoundError('Image not found');
    }

    // Delete from Storage first
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([image.path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with DB deletion even if Storage deletion fails
    }

    // Delete from database
    await prisma.productImage.delete({
      where: { id: imageId },
    });

    // If deleted image was primary, set another image as primary
    if (image.isPrimary) {
      const nextImage = await prisma.productImage.findFirst({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
      });

      if (nextImage) {
        await prisma.productImage.update({
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
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * Get all images for a product
   */
  async getProductImages(productId: string) {
    return await prisma.productImage.findMany({
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
    const image = await prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
    });

    if (!image) {
      throw new NotFoundError('Image not found');
    }

    // Remove primary flag from all product images
    await prisma.productImage.updateMany({
      where: { productId },
      data: { isPrimary: false },
    });

    // Set the new primary image
    await prisma.productImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    });
  }

  /**
   * Reorder product images
   */
  async reorderImages(productId: string, imageOrders: { id: string; sortOrder: number }[]): Promise<void> {
    // Verify all images belong to the product
    const images = await prisma.productImage.findMany({
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
    await prisma.$transaction(
      imageOrders.map(({ id, sortOrder }) =>
        prisma.productImage.update({
          where: { id },
          data: { sortOrder },
        })
      )
    );
  }
}

export default new ProductImageStorageService();

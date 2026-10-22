import prisma from '../../../config/database';
import { BadRequestError, ConflictError } from '../../../utils/errors';
import productService from '../../product.service';
import productImageStorageService from '../../product-image-storage.service';
import cjProductsService from './cj-products';
import categoryService from '../../category.service';

interface CJProductDetail {
  id: string;
  name: string;
  description: string;
  image: string;
  images: string[];
  price: number;
  currency: string;
  categoryId: number;
  categoryName: string;
  categoryPath: string;
  warehouse: string;
  shippingTime: string;
  stock: number;
  videoUrl?: string;
  attributes: any[];
  variants: Array<{
    vid: string;
    sku: string;
    name: string;
    price: number;
    stock: number;
    attrs: any[];
  }>;
}

interface ImportOptions {
  categoryId?: string;
  priceMarkupPercent?: number;
}

class CJMapperService {
  private async findOrCreateCategory(cjCategoryName: string, cjCategoryId: string | number): Promise<string> {
    // Try exact name match first
    let category = await prisma.category.findFirst({
      where: { name: { equals: cjCategoryName, mode: 'insensitive' } },
    });

    if (category) return category.id;

    // Try partial match
    category = await prisma.category.findFirst({
      where: { name: { contains: cjCategoryName, mode: 'insensitive' } },
    });

    if (category) return category.id;

    // Try path-based match (CJ category path like "Electronics > Audio > Headphones")
    const pathParts = cjCategoryName.split('>').map(s => s.trim()).filter(Boolean);
    for (const part of pathParts) {
      category = await prisma.category.findFirst({
        where: { name: { equals: part, mode: 'insensitive' } },
      });
      if (category) return category.id;
    }

    // Default to first category if no match
    const defaultCategory = await prisma.category.findFirst({
      orderBy: { name: 'asc' },
    });

    if (!defaultCategory) {
      throw new BadRequestError('No categories exist in Marcari23. Please create at least one category first.');
    }

    return defaultCategory.id;
  }

  private calculateSellingPrice(supplierPrice: number, markupPercent: number = 30): number {
    // Apply markup percentage to supplier cost
    return Math.round(supplierPrice * (1 + markupPercent / 100) * 100) / 100;
  }

  private calculateServiceFee(price: number): number {
    // EMART uses 7% service fee (from product-field-rules.ts)
    return Math.round(price * 0.07);
  }

  private determineStock(cjProduct: CJProductDetail): number {
    // Use total stock across all variants, or main product stock
    const variantStock = cjProduct.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    return Math.max(variantStock, cjProduct.stock || 0);
  }

  async mapToEMARTProduct(cjProduct: CJProductDetail, options: ImportOptions = {}): Promise<any> {
    const { categoryId, priceMarkupPercent = 30 } = options;

    // Resolve category
    const resolvedCategoryId = categoryId || await this.findOrCreateCategory(cjProduct.categoryName, cjProduct.categoryId);

    // Calculate pricing: supplier cost → customer selling price
    const supplierPrice = cjProduct.price;
    const sellingPrice = this.calculateSellingPrice(supplierPrice, priceMarkupPercent);
    const serviceFee = this.calculateServiceFee(sellingPrice);
    const estimatedPriceUsd = sellingPrice; // Already in USD

    // Determine stock
    const stock = this.determineStock(cjProduct);

    // Prepare supplier data for storage
    const supplierData = {
      cjProductId: cjProduct.id,
      cjCategoryId: cjProduct.categoryId,
      cjCategoryName: cjProduct.categoryName,
      cjCategoryPath: cjProduct.categoryPath,
      cjWarehouse: cjProduct.warehouse,
      cjShippingTime: cjProduct.shippingTime,
      supplierPrice: supplierPrice,
      currency: cjProduct.currency,
      markupPercent: priceMarkupPercent,
      attributes: cjProduct.attributes,
      variants: cjProduct.variants.map(v => ({
        vid: v.vid,
        sku: v.sku,
        name: v.name,
        price: v.price,
        stock: v.stock,
        attrs: v.attrs,
      })),
      importedAt: new Date().toISOString(),
    };

    // Generate SKU from CJ product ID
    const sku = `CJ-${cjProduct.id}`;

    return {
      sku: sku.toUpperCase(),
      name: cjProduct.name,
      description: cjProduct.description || '',
      price: sellingPrice,
      estimatedPriceUsd: estimatedPriceUsd,
      condition: 'NEW' as const,
      seller: 'CJdropshipping',
      sellerType: 'SHOP' as const,
      source: 'CJdropshipping',
      domesticShipping: 0, // CJ ships from their warehouse
      internationalShippingUsd: 0, // Will be calculated at checkout
      serviceFee: serviceFee,
      categoryId: resolvedCategoryId,
      tags: ['cj', 'dropshipping', cjProduct.categoryName.toLowerCase().replace(/\s+/g, '-')],
      stock: stock,
      isAvailable: stock > 0,
      isNew: true,
      isBestSeller: false,
      sourceType: 'CJ' as const,
      externalProductId: cjProduct.id,
      supplierId: 'cjdropshipping',
      supplierData: supplierData,
      sellerId: null, // CJ products are catalog products, not seller-owned
    };
  }

  /**
   * CJ's CDN answers some images with the non-standard `image/jpg` type,
   * which the shared storage service rejects. Sniff the bytes so any
   * mislabelled response still uploads as a supported type.
   */
  private normalizeImageContentType(contentType: string, buffer: Buffer): string {
    const type = (contentType || '').toLowerCase().split(';')[0].trim();

    if (type === 'image/jpg') return 'image/jpeg';
    if (['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(type)) return type;

    if (buffer.length >= 3 && buffer.subarray(0, 3).toString('hex') === 'ffd8ff') {
      return 'image/jpeg';
    }
    if (buffer.length >= 4 && buffer.subarray(0, 4).toString('hex') === '89504e47') {
      return 'image/png';
    }
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP'
    ) {
      return 'image/webp';
    }
    if (buffer.length >= 12 && buffer.subarray(4, 12).toString() === 'ftypavif') {
      return 'image/avif';
    }

    return 'image/jpeg';
  }

  async importImages(productId: string, imageUrls: string[]): Promise<number> {
    const CONCURRENT_DOWNLOADS = 4;
    let uploaded = 0;
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
      while (nextIndex < imageUrls.length) {
        const i = nextIndex++;
        const imageUrl = imageUrls[i];
        if (!imageUrl) continue;

        try {
          const response = await fetch(imageUrl);
          if (!response.ok) {
            console.warn(`[CJ] Failed to download image ${imageUrl}: ${response.status}`);
            continue;
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          const contentType = this.normalizeImageContentType(
            response.headers.get('content-type') || '',
            buffer
          );
          const extension = contentType.split('/')[1] || 'jpg';
          const filename = `cj-${productId}-${i + 1}.${extension}`;

          await productImageStorageService.uploadProductImage(productId, buffer, filename, contentType);
          uploaded++;
        } catch (error) {
          console.warn(`[CJ] Failed to import image ${imageUrl}:`, error);
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENT_DOWNLOADS, imageUrls.length) }, worker)
    );

    return uploaded;
  }

  /**
   * Shared CJ → EMART read path used by both single-product and category
   * imports. Detail already carries variants + stock, so only one CJ API call
   * is issued in the normal case; variant/stock endpoints are a fallback.
   */
  async fetchNormalizedProduct(cjProductId: string): Promise<any> {
    const cjDetail = await cjProductsService.getProductDetail(cjProductId);

    const variants = cjDetail.variants?.length
      ? cjDetail.variants
      : await cjProductsService.getVariants(cjProductId);

    const stockMap = cjDetail.variantStock
      ?? (await cjProductsService.getStock(variants.map(v => v.vid)));

    return cjProductsService.normalizeProductForDetail(cjDetail, variants, stockMap);
  }

  async importProduct(cjProductId: string, options: ImportOptions = {}): Promise<any> {
    // Check if already imported
    const existing = await prisma.product.findUnique({
      where: { externalProductId: cjProductId },
    });

    if (existing) {
      throw new ConflictError(`Product already imported (Marcari23 ID: ${existing.id})`);
    }

    const normalizedProduct = await this.fetchNormalizedProduct(cjProductId);

    // Map to EMART product
    const productData = await this.mapToEMARTProduct(normalizedProduct, options);

    // Create product in database
    const product = await productService.createProduct(productData);

    // Import images
    const uploaded = await this.importImages(product.id, normalizedProduct.images);
    console.log(`[CJ] Imported ${uploaded}/${normalizedProduct.images.length} images for product ${product.id}`);

    return product;
  }
}

export default new CJMapperService();
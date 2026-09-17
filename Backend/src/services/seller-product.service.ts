import prisma from '../config/database';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors';
import sellerService from './seller.service';
import productService from './product.service';
import type { SellerProfile } from '@prisma/client';

const SKU_CONFLICT_CODE = 'P2002';

/** Prisma P2003 — a referenced record (e.g. categoryId) does not exist. */
const FK_VIOLATION_CODE = 'P2003';

/** Row shape for seller product list cards. */
const sellerProductSelect = {
  id: true,
  sku: true,
  name: true,
  description: true,
  price: true,
  estimatedPriceUsd: true,
  condition: true,
  seller: true,
  sellerType: true,
  source: true,
  domesticShipping: true,
  internationalShippingUsd: true,
  serviceFee: true,
  tags: true,
  isNew: true,
  isBestSeller: true,
  stock: true,
  isAvailable: true,
  sellerId: true,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: { id: true, name: true },
  },
  productImages: {
    where: { isPrimary: true },
    take: 1,
    select: { id: true, url: true, isPrimary: true },
  },
} as const;

/** Full row shape for the seller product detail/edit view. */
const sellerProductDetailSelect = {
  ...sellerProductSelect,
  productImages: {
    select: { id: true, url: true, path: true, isPrimary: true, sortOrder: true },
    orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
  },
};

/**
 * Seller-owned product management (Phase 6).
 *
 * Ownership is ALWAYS derived server-side:
 *   authenticated user → SellerProfile (APPROVED) → Product.sellerId
 * The request body/query/URL can never assign, transfer, or broaden ownership.
 * Product.seller (display string) and Product.sellerType (SHOP/INDIVIDUAL) keep
 * their existing marketplace meanings and are NOT the ownership relationship —
 * that is Product.sellerId → SellerProfile.
 */
class SellerProductService {
  /** Fields the seller API reads from the body. `sellerId` is never included. */
  private pickWritableFields(data: Record<string, unknown>): Record<string, unknown> {
    const allowed = [
      'sku', 'name', 'description', 'price', 'estimatedPriceUsd', 'condition',
      'seller', 'sellerType', 'source', 'domesticShipping',
      'internationalShippingUsd', 'serviceFee', 'categoryId', 'tags',
      'stock', 'isAvailable', 'isNew', 'isBestSeller',
    ] as const;
    const picked: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in data) picked[key] = data[key];
    }
    return picked;
  }

  /** Strip Prisma JSON noise from a product row for client responses. */
  private toClient(product: Record<string, unknown>) {
    return product;
  }

  /** Same normalization as the admin path: trim + uppercase; '' → undefined. */
  private normalizeSkuValue(value: unknown): string | undefined | null {
    if (value === null) return null;
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toUpperCase();
    return normalized.length > 0 ? normalized : undefined;
  }

  /** Resolve ownership for a product id. Throws NotFound/Forbidden as appropriate. */
  private async assertOwnership(productId: string, seller: SellerProfile) {
    if (!productId || typeof productId !== 'string') {
      throw new NotFoundError('Product not found');
    }
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sellerId: true },
    });
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    if (product.sellerId !== seller.id) {
      throw new ForbiddenError('You do not have permission to manage this product.');
    }
    return product;
  }

  /** Translate a SKU unique violation into the same 409 the admin API returns. */
  private throwConflictIfSkuDuplicate(error: unknown): void {
    const err = error as { code?: string; meta?: { target?: string[] } } | null;
    if (
      err?.code === SKU_CONFLICT_CODE &&
      Array.isArray(err.meta?.target) &&
      err.meta!.target.includes('sku')
    ) {
      throw new ConflictError('A product with this SKU already exists');
    }
  }

  /**
   * Validate + resolve the category through the shared ProductService logic
   * (same UUID-existence check / name matching as admin writes), so seller
   * writes can never hit the database with an invalid categoryId.
   */
  private async resolveCategoryField(data: Record<string, unknown>): Promise<string | undefined> {
    const resolved = await (productService as any).validateAndResolveCategory({
      categoryId: data.categoryId,
    });
    if (resolved) return String(resolved);
    if ('categoryId' in data && data.categoryId !== undefined && data.categoryId !== null && data.categoryId !== '') {
      throw new BadRequestError('Category not found or invalid.');
    }
    return undefined;
  }

  /** Seller list — strictly scoped to the authenticated seller's products. */
  async listProducts(
    seller: SellerProfile,
    filters: { search?: string; status?: string; isAvailable?: boolean },
    pagination: { page: number; limit: number },
  ) {
    const { page, limit } = pagination;
    const where: Record<string, unknown> = { sellerId: seller.id };

    if (filters.search && filters.search.trim()) {
      const search = filters.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
        { sku: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    if (filters.status === 'available') where.isAvailable = true;
    if (filters.status === 'unavailable') where.isAvailable = false;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: sellerProductSelect,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products: products.map((p) => this.toClient(p)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Seller detail — own products only. */
  async getProduct(seller: SellerProfile, productId: string) {
    await this.assertOwnership(productId, seller);
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: sellerProductDetailSelect,
    });
    if (!product) throw new NotFoundError('Product not found');
    return this.toClient(product);
  }

  /**
   * Seller create. sellerId is always set from the resolved profile;
   * any client-supplied sellerId in the payload was already dropped by
   * pickWritableFields.
   */
  async createProduct(seller: SellerProfile, data: Record<string, unknown>) {
    const fields = this.pickWritableFields(data);
    const resolvedCategoryId = await this.resolveCategoryField(fields);
    if (resolvedCategoryId) {
      fields.categoryId = resolvedCategoryId;
    }
    const createData: Record<string, unknown> = {
      ...fields,
      sellerId: seller.id,
      sku: this.normalizeSkuValue(fields.sku),
    };
    const product = await prisma.product.create({
      data: createData as never,
      select: sellerProductDetailSelect,
    }).catch((error) => {
      this.throwConflictIfSkuDuplicate(error);
      throw error;
    });
    return this.toClient(product);
  }

  /** Seller update — own products only; sellerId can never be changed. */
  async updateProduct(seller: SellerProfile, productId: string, data: Record<string, unknown>) {
    await this.assertOwnership(productId, seller);
    const fields = this.pickWritableFields(data);
    const resolvedCategoryId = await this.resolveCategoryField(fields);
    if (resolvedCategoryId) {
      fields.categoryId = resolvedCategoryId;
    }
    if ('sku' in fields) {
      fields.sku = this.normalizeSkuValue(fields.sku);
    }
    const product = await prisma.product.update({
      where: { id: productId },
      data: fields as never,
      select: sellerProductDetailSelect,
    }).catch((error) => {
      this.throwConflictIfSkuDuplicate(error);
      throw error;
    });
    return this.toClient(product);
  }

  /**
   * Seller delete — own products only. Order-history protection comes from
   * the schema (order_items.product has no cascade), surfaced as a clean 409
   * exactly like the admin delete path.
   */
  async deleteProduct(seller: SellerProfile, productId: string) {
    await this.assertOwnership(productId, seller);
    const referenced = await prisma.orderItem.findFirst({
      where: { productId },
      select: { id: true },
    });
    if (referenced) {
      throw new ConflictError(
        'Cannot delete this product because it is part of an existing order. Unpublish it instead if it should no longer be visible.'
      );
    }
    await prisma.product.delete({ where: { id: productId } });
    return { deleted: true };
  }

  /**
   * Resolve the caller's APPROVED seller profile or throw.
   * Delegates to the Phase 5 helper so the rules stay in one place.
   * Product endpoints report a missing/inactive seller as 403 (Phase 6 spec:
   * PENDING/REJECTED/no-profile are all forbidden here, not "not found").
   */
  async requireApprovedSeller(userId: string) {
    try {
      return await sellerService.requireApprovedSeller(userId);
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw new ForbiddenError('Seller account is not active.');
      }
      throw err;
    }
  }
}

export default new SellerProductService();

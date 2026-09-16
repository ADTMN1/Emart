import prisma from '../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import { ProductFilters, PaginationParams } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SKU_CONFLICT_CODE = 'P2002';

export class ProductService {
  /**
   * Normalize a submitted SKU: trim + uppercase. Returns undefined when empty.
   */
  private normalizeSku(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toUpperCase();
    return normalized.length > 0 ? normalized : undefined;
  }

  /**
   * Validate the category provided on a create/update write before it reaches
   * Prisma. Accepts an existing category UUID or a category name (reusing
   * resolveCategoryId's name matching); throws a clean 400 instead of letting
   * an invalid FK surface as a Prisma 500. Returns undefined when no category
   * was supplied (partial updates).
   */
  private async validateAndResolveCategory(data: {
    categoryId?: unknown;
    category?: { id?: unknown } | null;
  }): Promise<string | undefined> {
    const raw = data.categoryId ?? data.category?.id;
    if (raw === undefined) return undefined;

    const rawStr = typeof raw === 'string' ? raw.trim() : '';
    if (!rawStr) return undefined;

    // UUID path: verify it actually exists (resolveCategoryId trusts UUIDs)
    if (UUID_REGEX.test(rawStr)) {
      const exists = await prisma.category.findUnique({
        where: { id: rawStr },
        select: { id: true },
      });
      if (!exists) {
        throw new BadRequestError(`Category not found for id: ${rawStr}`);
      }
      return rawStr;
    }

    // Non-UUID path: reuse the existing name/slug resolution
    const resolved = await this.resolveCategoryId(rawStr);
    if (!resolved) {
      throw new BadRequestError(`Unknown category: "${rawStr}"`);
    }
    return resolved;
  }

  /**
   * Translate Prisma unique-constraint violations into a friendly 409 Conflict.
   * Targets the sku constraint specifically so other unique violations behave as before.
   */
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
  async resolveCategoryId(categoryFilter: string): Promise<string | null> {
    if (!categoryFilter) return null;

    // If it looks like a UUID, use it directly as categoryId
    if (UUID_REGEX.test(categoryFilter)) {
      return categoryFilter;
    }

    // Otherwise try to find category by name (exact case-insensitive match)
    const normalized = categoryFilter.trim().toLowerCase();
    const category = await prisma.category.findFirst({
      where: {
        OR: [
          { name: { equals: categoryFilter, mode: 'insensitive' } },
          { name: { equals: normalized, mode: 'insensitive' } },
          { name: { equals: normalized.replace(/\b\w/g, c => c.toUpperCase()), mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    if (category) return category.id;

    // Try slug-style matching: filter name has no spaces, look for category without spaces
    const noSpaceFilter = categoryFilter.replace(/[\s-_]/g, '').toLowerCase();
    const allCategories = await prisma.category.findMany({
      select: { id: true, name: true },
    });

    for (const cat of allCategories) {
      const catNameNoSpace = cat.name.replace(/[\s-&]/g, '').toLowerCase();
      if (catNameNoSpace === noSpaceFilter) {
        return cat.id;
      }
    }

    return null;
  }

  /**
   * Distinct filter facets computed from the actual catalog: sources,
   * normalized conditions and the real price range. Powers the marketplace
   * sidebar so filters can never reference values that match nothing.
   */
  async getProductFacets() {
    const bucketDefs = [
      { label: 'Under $50', gte: 0, lt: 50 },
      { label: '$50 - $100', gte: 50, lt: 100 },
      { label: '$100 - $250', gte: 100, lt: 250 },
      { label: '$250 - $500', gte: 250, lt: 500 },
      { label: 'Over $500', gte: 500, lt: undefined as number | undefined },
    ];

    const [sourceRows, conditionRows, priceRow, bucketCounts] = await Promise.all([
      prisma.product.groupBy({
        by: ['source'],
        where: { isAvailable: true },
        _count: { source: true },
        orderBy: { _count: { source: 'desc' } },
      }),
      prisma.product.groupBy({
        by: ['condition'],
        where: { isAvailable: true },
        _count: { condition: true },
        orderBy: { _count: { condition: 'desc' } },
      }),
      prisma.product.aggregate({
        where: { isAvailable: true },
        _min: { price: true },
        _max: { price: true },
      }),
      Promise.all(
        bucketDefs.map((b) =>
          prisma.product.count({
            where: {
              isAvailable: true,
              price: { gte: b.gte, ...(b.lt !== undefined ? { lt: b.lt } : {}) },
            },
          })
        )
      ),
    ]);

    return {
      sources: sourceRows.map((row) => ({ value: row.source, count: row._count.source })),
      conditions: conditionRows.map((row) => ({ value: row.condition, count: row._count.condition })),
      buckets: bucketDefs.map((b, i) => ({ label: b.label, count: bucketCounts[i] })),
      priceMin: priceRow._min.price ?? 0,
      priceMax: priceRow._max.price ?? 0,
    };
  }

  async getAllProducts(filters: ProductFilters, pagination: PaginationParams) {
    const page = Math.max(1, Number(pagination.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(pagination.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      isAvailable: true,
    };

    // Availability filter: storefront omits "status" and keeps the default
    // (available only). The admin page sends "active", "inactive", or "all"
    // to manage unpublished products too.
    if (filters.status === 'inactive') {
      where.isAvailable = false;
    } else if (filters.status === 'all') {
      delete where.isAvailable;
    } else if (filters.status === 'active') {
      where.isAvailable = true;
    }

    if (filters.category) {
      const resolvedCategoryId = await this.resolveCategoryId(filters.category);
      if (resolvedCategoryId) {
        where.categoryId = resolvedCategoryId;
      } else {
        // Category not found - ensure empty result rather than returning all
        where.categoryId = '00000000-0000-0000-0000-000000000000';
      }
    }

    if (filters.source) {
      where.source = filters.source;
    }

    if (filters.condition) {
      where.condition = filters.condition;
    }

    // Multi-select facet filters (marketplace sidebar).
    if (filters.conditions && filters.conditions.length > 0) {
      where.condition = { in: filters.conditions };
    }

    if (filters.sources && filters.sources.length > 0) {
      where.source = { in: filters.sources };
    }

    // Price buckets are OR-ed together; buckets without an upper bound only
    // carry gte. Supplied alongside explicit min/max when present.
    if (filters.priceBuckets && filters.priceBuckets.length > 0) {
      const bucketOR = filters.priceBuckets.map((bucket) => {
        const range: { gte?: number; lte?: number } = { gte: bucket.min };
        if (bucket.max !== undefined) range.lte = bucket.max;
        return { price: range };
      });
      where.OR = where.OR ? [...where.OR, ...bucketOR] : bucketOR;
    }

    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = filters.minPrice;
      if (filters.maxPrice) where.price.lte = filters.maxPrice;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { tags: { hasSome: [filters.search] } },
      ];
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    // Shared row shape for storefront product list queries.
    const productSelect = {
      id: true,
      sku: true,
      name: true,
      price: true,
      estimatedPriceUsd: true,
      condition: true,
      isAvailable: true,
      seller: true,
      sellerType: true,
      source: true,
      domesticShipping: true,
      internationalShippingUsd: true,
      serviceFee: true,
      tags: true,
      isNew: true,
      isBestSeller: true,
      rating: true,
      reviewCount: true,
      // Real user-rating aggregates (maintained by the rating API on write).
      ratingAgg: true,
      ratingCount: true,
      categoryId: true,
      createdAt: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      productImages: {
        where: { isPrimary: true },
        take: 1,
        select: {
          id: true,
          url: true,
          isPrimary: true,
        },
      },
    } as const;

    // Default storefront browse (opt-in via ?mix=categories): interleave
    // products across ALL categories round-robin (deterministic name order,
    // newest-first within each category) so one recent import cannot fill the
    // first pages. Skipped when a category filter is present — an explicit
    // category already scopes the grid.
    if (filters.interleave && !filters.category) {
      const categories = await prisma.category.findMany({
        select: { id: true },
        orderBy: { name: 'asc' },
      });

      if (categories.length > 0) {
        // Fetch enough newest matches for every category to contribute, then
        // reorder in memory. Page slicing happens after reordering, so pages
        // never repeat or skip products.
        const [roundRows, total] = await Promise.all([
          prisma.product.findMany({
            where,
            select: { id: true, categoryId: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take: limit * categories.length,
          }),
          prisma.product.count({ where }),
        ]);

        // Bucket product ids per category, newest-first within each bucket.
        const buckets = new Map<string, string[]>();
        for (const row of roundRows) {
          const bucket = buckets.get(row.categoryId);
          if (bucket) bucket.push(row.id);
          else buckets.set(row.categoryId, [row.id]);
        }

        // One product per category per round, categories in stable name order,
        // until every fetched product is placed. Categories without products
        // simply skip their beat.
        const orderedIds: string[] = [];
        let emitted = true;
        while (emitted) {
          emitted = false;
          for (const category of categories) {
            const bucket = buckets.get(category.id);
            if (bucket && bucket.length > 0) {
              orderedIds.push(bucket.shift()!);
              emitted = true;
            }
          }
        }

        const pageIds = orderedIds.slice(skip, skip + limit);
        const rows =
          pageIds.length > 0
            ? await prisma.product.findMany({
                where: { id: { in: pageIds } },
                select: productSelect,
              })
            : [];

        const rowsById = new Map(rows.map((row) => [row.id, row]));
        const products = pageIds
          .map((id) => rowsById.get(id))
          .filter((row): row is (typeof rows)[number] => row !== undefined);

        return {
          products,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      }
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: productSelect,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProductById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
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
        isAvailable: true,
        rating: true,
        reviewCount: true,
        categoryId: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
        productImages: {
          select: {
            id: true,
            url: true,
            path: true,
            isPrimary: true,
            sortOrder: true,
          },
          orderBy: [
            { isPrimary: 'desc' },
            { sortOrder: 'asc' },
          ],
        },
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return product;
  }

  async createProduct(data: any) {
    const { categoryId, category, ...rest } = data;

    const createData: any = {
      ...rest,
      sku: this.normalizeSku(rest.sku),
    };

    const resolvedCategoryId = await this.validateAndResolveCategory({ categoryId, category });
    if (resolvedCategoryId) {
      createData.category = {
        connect: { id: resolvedCategoryId },
      };
    }

    // Remove any explicit null fields to avoid Prisma trying to set null
    Object.keys(createData).forEach((k) => {
      if (createData[k] === null) delete createData[k];
    });

    // Ensure `image` is present and non-null because DB migration created it as NOT NULL
    if (createData.image === undefined) {
      createData.image = '';
    }

    return await prisma.product.create({
      data: createData,
      include: {
        category: true,
        productImages: {
          orderBy: [
            { isPrimary: 'desc' },
            { sortOrder: 'asc' },
          ],
        },
      },
    }).catch((error) => {
      this.throwConflictIfSkuDuplicate(error);
      throw error;
    });
  }

  async updateProduct(id: string, data: any) {
    await this.getProductById(id);

    const { categoryId, category, ...rest } = data;
    
    const updateData: any = {
      ...rest,
    };

    const resolvedCategoryId = await this.validateAndResolveCategory({ categoryId, category });
    if (resolvedCategoryId) {
      updateData.category = {
        connect: { id: resolvedCategoryId },
      };
    }

    if ('sku' in updateData) {
      const normalizedSku = this.normalizeSku(updateData.sku);
      if (normalizedSku) {
        updateData.sku = normalizedSku;
      } else {
        // Empty/absent value means "clear the SKU" — remember it, because the
        // null-removal loop below would otherwise drop it before Prisma sees it.
        delete updateData.sku;
        (updateData as any).__clearSku = true;
      }
    }

    // Remove any explicit null fields to avoid Prisma trying to set null
    Object.keys(updateData).forEach((k) => {
      if (updateData[k] === null) delete updateData[k];
    });

    if ((updateData as any).__clearSku) {
      delete (updateData as any).__clearSku;
      updateData.sku = null;
    }

    return await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        productImages: {
          orderBy: [
            { isPrimary: 'desc' },
            { sortOrder: 'asc' },
          ],
        },
      },
    }).catch((error) => {
      this.throwConflictIfSkuDuplicate(error);
      throw error;
    });
  }

  async deleteProduct(id: string) {
    // Validate product exists (throws NotFoundError if not found)
    await this.getProductById(id);

    // order_items.product has no cascade (intentionally, to preserve order
    // history), so a referenced product would otherwise fail as a Prisma 500.
    // Mirror the bulk-delete behavior with a clear, safe error instead.
    const referenced = await prisma.orderItem.findFirst({
      where: { productId: id },
      select: { id: true },
    });
    if (referenced) {
      throw new ConflictError(
        'Cannot delete this product because it is part of an existing order. Unpublish it instead if it should no longer be visible.'
      );
    }

    return await prisma.product.delete({
      where: { id },
    });
  }

  async bulkDeleteProducts(ids: string[]) {
    // De-duplicate and drop invalid ids to avoid wasted work
    const uniqueIds = Array.from(new Set(ids)).filter((id) =>
      UUID_REGEX.test(id)
    );

    if (uniqueIds.length === 0) {
      throw new BadRequestError('No valid product ids provided');
    }

    // Fetch which of the requested products actually exist, and which are
    // referenced by order items (order_items.product has no cascade delete,
    // so those products cannot be removed from the database).
    const existing = await prisma.product.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        orderItems: { select: { id: true }, take: 1 },
      },
    });

    const existingById = new Map(existing.map((p) => [p.id, p]));
    const deletable = uniqueIds.filter(
      (id) => existingById.get(id) && existingById.get(id)!.orderItems.length === 0
    );
    const blocked = uniqueIds
      .filter((id) => existingById.get(id)?.orderItems.length)
      .map((id) => existingById.get(id)!.id);
    const notFound = uniqueIds.filter((id) => !existingById.has(id));

    let deletedCount = 0;
    if (deletable.length > 0) {
      const result = await prisma.product.deleteMany({
        where: { id: { in: deletable } },
      });
      deletedCount = result.count;
    }

    return {
      deletedCount,
      failedCount: blocked.length + notFound.length,
      failed: [
        ...blocked.map((id) => ({
          id,
          reason: 'Referenced by existing orders',
        })),
        ...notFound.map((id) => ({
          id,
          reason: 'Product not found',
        })),
      ],
    };
  }

  async getFeaturedProducts(limit: number = 8) {
    return await prisma.product.findMany({
      where: {
        isAvailable: true,
        OR: [
          { isNew: true },
          { isBestSeller: true },
        ],
      },
      select: {
        id: true,
        name: true,
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
        rating: true,
        reviewCount: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        productImages: {
          where: { isPrimary: true },
          take: 1,
          select: {
            id: true,
            url: true,
            isPrimary: true,
          },
        },
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getRelatedProducts(productId: string, limit: number = 4) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: productId },
        isAvailable: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        estimatedPriceUsd: true,
        condition: true,
        seller: true,
        sellerType: true,
        source: true,
        domesticShipping: true,
        serviceFee: true,
        tags: true,
        isNew: true,
        isBestSeller: true,
        rating: true,
        reviewCount: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        productImages: {
          where: { isPrimary: true },
          take: 1,
          select: {
            id: true,
            url: true,
            isPrimary: true,
          },
        },
      },
      take: limit,
    });
  }
}

export default new ProductService();

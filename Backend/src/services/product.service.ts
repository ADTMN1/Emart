import prisma from '../config/database';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { ProductFilters, PaginationParams } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ProductService {
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

  async getAllProducts(filters: ProductFilters, pagination: PaginationParams) {
    const page = Math.max(1, Number(pagination.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(pagination.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      isAvailable: true,
    };

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

    if (filters.minPrice || filters.maxPrice) {
      where.estimatedPriceUsd = {};
      if (filters.minPrice) where.estimatedPriceUsd.gte = filters.minPrice;
      if (filters.maxPrice) where.estimatedPriceUsd.lte = filters.maxPrice;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { tags: { hasSome: [filters.search] } },
      ];
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
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
        },
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
    };

    if (categoryId) {
      createData.category = {
        connect: { id: categoryId },
      };
    } else if (category?.id) {
      createData.category = {
        connect: { id: category.id },
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
    });
  }

  async updateProduct(id: string, data: any) {
    await this.getProductById(id);

    const { categoryId, category, ...rest } = data;
    
    const updateData: any = {
      ...rest,
    };

    if (categoryId) {
      updateData.category = {
        connect: { id: categoryId },
      };
    } else if (category?.id) {
      updateData.category = {
        connect: { id: category.id },
      };
    }

    // Remove any explicit null fields to avoid Prisma trying to set null
    Object.keys(updateData).forEach((k) => {
      if (updateData[k] === null) delete updateData[k];
    });

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
    });
  }

  async deleteProduct(id: string) {
    // Validate product exists (throws NotFoundError if not found)
    await this.getProductById(id);

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

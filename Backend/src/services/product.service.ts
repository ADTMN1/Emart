import prisma from '../config/database';
import { NotFoundError } from '../utils/errors';
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
    const { page = 1, limit = 20 } = pagination;
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
        include: {
          category: true,
          productImages: {
            where: { isPrimary: true },
            take: 1,
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

  async getFeaturedProducts(limit: number = 8) {
    return await prisma.product.findMany({
      where: {
        isAvailable: true,
        OR: [
          { isNew: true },
          { isBestSeller: true },
        ],
      },
      include: {
        category: true,
        productImages: {
          where: { isPrimary: true },
          take: 1,
        },
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getRelatedProducts(productId: string, limit: number = 4) {
    const product = await this.getProductById(productId);

    return await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: productId },
        isAvailable: true,
      },
      include: {
        category: true,
        productImages: {
          where: { isPrimary: true },
          take: 1,
        },
      },
      take: limit,
    });
  }
}

export default new ProductService();

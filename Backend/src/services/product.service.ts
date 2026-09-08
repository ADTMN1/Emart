import prisma from '../config/database';
import { NotFoundError } from '../utils/errors';
import { ProductFilters, PaginationParams } from '../types';

export class ProductService {
  async getAllProducts(filters: ProductFilters, pagination: PaginationParams) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: any = {
      isAvailable: true,
    };

    if (filters.category) {
      where.categoryId = filters.category;
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
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return product;
  }

  async createProduct(data: any) {
    return await prisma.product.create({
      data,
      include: {
        category: true,
      },
    });
  }

  async updateProduct(id: string, data: any) {
    const product = await this.getProductById(id);

    return await prisma.product.update({
      where: { id },
      data,
      include: {
        category: true,
      },
    });
  }

  async deleteProduct(id: string) {
    const product = await this.getProductById(id);

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
      },
      take: limit,
    });
  }
}

export default new ProductService();

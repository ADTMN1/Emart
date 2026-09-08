import prisma from '../config/database';
import { NotFoundError } from '../utils/errors';

export class CategoryService {
  async getAllCategories() {
    return await prisma.category.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  async getCategoryById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return category;
  }

  async createCategory(data: { name: string; icon: string; color: string; count?: number }) {
    return await prisma.category.create({
      data,
    });
  }

  async updateCategory(id: string, data: Partial<{ name: string; icon: string; color: string; count: number }>) {
    await this.getCategoryById(id);

    return await prisma.category.update({
      where: { id },
      data,
    });
  }

  async deleteCategory(id: string) {
    await this.getCategoryById(id);

    return await prisma.category.delete({
      where: { id },
    });
  }
}

export default new CategoryService();

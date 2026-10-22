import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import cjProductsService from '../services/suppliers/cj/cj-products';
import cjMapperService from '../services/suppliers/cj/cj-mapper';
import cjCategoryImportService from '../services/suppliers/cj/cj-category-import.service';
import { sendSuccess } from '../utils/response';
import { BadRequestError, NotFoundError } from '../utils/errors';

class CJSupplierController {
  /**
   * GET /admin/suppliers/cj/products
   * Search CJ products
   */
  async searchProducts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { keyword, page = 1, pageSize = 20, categoryId, warehouse } = req.query;

      const result = await cjProductsService.searchProducts({
        keyword: keyword as string,
        page: Number(page),
        pageSize: Math.min(Number(pageSize), 100),
        categoryId: categoryId ? String(categoryId) : undefined,
        warehouse: warehouse as string,
      });

      const products = result.list.map(item => cjProductsService.normalizeProductForList(item));

      return sendSuccess(res, {
        products,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
      }, 'CJ products retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/suppliers/cj/products/:productId
   * Get full CJ product detail
   */
  async getProductDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;

      const normalizedProduct = await cjMapperService.fetchNormalizedProduct(productId);

      return sendSuccess(res, normalizedProduct, 'CJ product detail retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/suppliers/cj/products/:productId/import
   * Import CJ product to EMART
   */
  async importProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      const { categoryId, priceMarkupPercent = 30 } = req.body;

      const product = await cjMapperService.importProduct(productId, {
        categoryId,
        priceMarkupPercent,
      });

      return sendSuccess(res, {
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        estimatedPriceUsd: product.estimatedPriceUsd,
        stock: product.stock,
        isAvailable: product.isAvailable,
        sourceType: product.sourceType,
        externalProductId: product.externalProductId,
      }, 'CJ product imported successfully', 201);
    } catch (error: any) {
      if (error?.statusCode === 409) {
        const existingId = error.message?.match(/Marcari23 ID: ([^)]+)/)?.[1] || null;
        return res.status(409).json({
          success: false,
          error: error.message || 'Product already imported',
          data: { existingProductId: existingId },
        });
      }
      next(error);
    }
  }

  /**
   * POST /admin/suppliers/cj/categories/:categoryId/import
   * Start a CJ category import
   */
  async importCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { categoryId } = req.params;
      const { emartCategoryId, priceMarkupPercent = 30 } = req.body;

      const result = await cjCategoryImportService.startCategoryImport(
        categoryId,
        { emartCategoryId, priceMarkupPercent },
        req.user!.id
      );

      return sendSuccess(res, result, 'CJ category import started', 202);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/suppliers/cj/categories
   * Get CJ categories for filtering
   */
  async getCategories(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const categories = await cjProductsService.getCategories();
      return sendSuccess(res, categories, 'CJ categories retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new CJSupplierController();
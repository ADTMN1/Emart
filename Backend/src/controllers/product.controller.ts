import { Request, Response, NextFunction } from 'express';
import productService from '../services/product.service';
import ratingService from '../services/rating.service';
import { sendSuccess } from '../utils/response';
import { BadRequestError } from '../utils/errors';
import { AuthRequest } from '../types';

/**
 * Parse a comma-separated price bucket list like "0-49.99,50-99.99,500+".
 * Invalid tokens are skipped; "N+" is an open-ended bucket.
 */
function parsePriceBuckets(raw: string): Array<{ min: number; max?: number }> | undefined {
  const buckets = raw
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token): { min: number; max?: number } | null => {
      if (token.endsWith('+')) {
        const min = parseFloat(token.slice(0, -1));
        return Number.isFinite(min) && min >= 0 ? { min } : null;
      }
      const [minStr, maxStr] = token.split('-');
      const min = parseFloat(minStr);
      if (!Number.isFinite(min) || min < 0) return null;
      const max = parseFloat(maxStr);
        return Number.isFinite(max) && max >= min ? { min, max } : { min };
    })
    .filter((b): b is { min: number; max?: number } => b !== null);

  return buckets.length > 0 ? buckets : undefined;
}

function parseListParam(raw: unknown): string[] | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : undefined;
}

export class ProductController {
  /**
   * GET /products/facets — distinct sources, conditions and real price range
   * from the available catalog, for the marketplace filter sidebar.
   */
  async getProductFacets(req: Request, res: Response, next: NextFunction) {
    try {
      const facets = await productService.getProductFacets();
      return sendSuccess(res, facets, 'Product facets retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
  async getAllProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        category: req.query.category as string,
        source: req.query.source as string,
        condition: req.query.condition as string,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        // Accept both "q" (storefront Marketplace) and "search" (admin Products page);
        // "q" keeps priority when both are present.
        search: String(req.query.q ?? req.query.search ?? '').trim() || undefined,
        status: req.query.status as string | undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        // Storefront default browse sends ?mix=categories to interleave products
        // across ALL categories (round-robin) instead of pure newest-first.
        interleave: req.query.mix === 'categories',
        // Multi-select facet filters (marketplace sidebar).
        conditions: parseListParam(req.query.conditions),
        sources: parseListParam(req.query.sources),
        priceBuckets:
          typeof req.query.priceBuckets === 'string' && req.query.priceBuckets.trim()
            ? parsePriceBuckets(req.query.priceBuckets)
            : undefined,
      };

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };

      const result = await productService.getAllProducts(filters, pagination);
      
      return sendSuccess(res, result, 'Products retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await productService.getProductById(req.params.id);
      
      return sendSuccess(res, product, 'Product retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async createProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const product = await productService.createProduct(req.body);
      
      return sendSuccess(res, product, 'Product created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const product = await productService.updateProduct(req.params.id, req.body);
      
      return sendSuccess(res, product, 'Product updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await productService.deleteProduct(req.params.id);
      
      return sendSuccess(res, null, 'Product deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async bulkDeleteProducts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { ids } = req.body as { ids?: unknown };

      if (!Array.isArray(ids) || ids.length === 0) {
        throw new BadRequestError('ids must be a non-empty array of product ids');
      }

      const result = await productService.bulkDeleteProducts(ids as string[]);
      
      return sendSuccess(res, result, 'Bulk delete completed');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /products/:id/rating — create or update the authenticated user's
   * 1-5 star rating. Returns the saved rating plus fresh aggregate so the
   * client can render the real average/count immediately.
   */
  async rateProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await ratingService.rateProduct(
        req.user!.id,
        req.params.id,
        Number(req.body?.rating)
      );

      return sendSuccess(res, result, result.isNew ? 'Rating submitted' : 'Rating updated');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /products/my-ratings — all of the authenticated user's ratings as a
   * productId -> rating map. Static segment registered before /:id in routes.
   */
  async getMyRatings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ratings = await ratingService.getUserRatingMap(req.user!.id);
      return sendSuccess(res, { ratings }, 'Your ratings retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /** GET /products/:id/my-rating — the authenticated user's rating for one product. */
  async getMyRating(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rating = await ratingService.getUserRatingForProduct(req.user!.id, req.params.id);
      return sendSuccess(res, { rating }, 'Your rating retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getFeaturedProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 8;
      const products = await productService.getFeaturedProducts(limit);
      
      return sendSuccess(res, products, 'Featured products retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getRelatedProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 4;
      const products = await productService.getRelatedProducts(req.params.id, limit);
      
      return sendSuccess(res, products, 'Related products retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new ProductController();

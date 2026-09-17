import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import sellerProductService from '../services/seller-product.service';
import productImageController from './product-image.controller';
import { sendSuccess } from '../utils/response';
import type { SellerProfile } from '@prisma/client';

/**
 * Seller product endpoints (Phase 6). Every handler resolves the caller's
 * APPROVED seller profile from the authenticated user — never from the
 * body/query — and the service scopes every operation to that profile.
 */
class SellerProductController {
  /** GET /api/v1/seller/products — own products, paginated. */
  async listProducts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const seller = await sellerProductService.requireApprovedSeller(req.user!.id);
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limitRaw = parseInt(String(req.query.limit ?? '20'), 10) || 20;
      const limit = Math.min(100, Math.max(1, limitRaw));
      const result = await sellerProductService.listProducts(
        seller as SellerProfile,
        {
          search: req.query.search ? String(req.query.search) : undefined,
          status: req.query.status ? String(req.query.status) : undefined,
        },
        { page, limit },
      );
      return sendSuccess(res, result);
    } catch (error) {
      return next(error);
    }
  }

  /** GET /api/v1/seller/products/:id — own product detail. */
  async getProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const seller = await sellerProductService.requireApprovedSeller(req.user!.id);
      const product = await sellerProductService.getProduct(seller as SellerProfile, req.params.id);
      return sendSuccess(res, product);
    } catch (error) {
      return next(error);
    }
  }

  /** POST /api/v1/seller/products — create with server-assigned ownership. */
  async createProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const seller = await sellerProductService.requireApprovedSeller(req.user!.id);
      const product = await sellerProductService.createProduct(seller as SellerProfile, req.body ?? {});
      return sendSuccess(res, product, 'Product created successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  /** PUT /api/v1/seller/products/:id — update own product. */
  async updateProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const seller = await sellerProductService.requireApprovedSeller(req.user!.id);
      const product = await sellerProductService.updateProduct(
        seller as SellerProfile,
        req.params.id,
        req.body ?? {},
      );
      return sendSuccess(res, product, 'Product updated successfully');
    } catch (error) {
      return next(error);
    }
  }

  /** DELETE /api/v1/seller/products/:id — delete own product (order-protected). */
  async deleteProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const seller = await sellerProductService.requireApprovedSeller(req.user!.id);
      const result = await sellerProductService.deleteProduct(seller as SellerProfile, req.params.id);
      return sendSuccess(res, result, 'Product deleted successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /api/v1/seller/products/:id/images — upload an image to OWN product.
   * Reuses the shared ProductImage storage pipeline after ownership check.
   */
  async uploadImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const seller = await sellerProductService.requireApprovedSeller(req.user!.id);
      await sellerProductService.getProduct(seller as SellerProfile, req.params.id); // 403/404 gate
      return productImageController.uploadImage(req, res, next);
    } catch (error) {
      return next(error);
    }
  }

  /** DELETE /api/v1/seller/products/:id/images/:imageId — own product only. */
  async deleteImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const seller = await sellerProductService.requireApprovedSeller(req.user!.id);
      await sellerProductService.getProduct(seller as SellerProfile, req.params.id);
      return productImageController.deleteImage(req, res, next);
    } catch (error) {
      return next(error);
    }
  }

  /** PUT /api/v1/seller/products/:id/images/:imageId/primary — own product only. */
  async setPrimaryImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const seller = await sellerProductService.requireApprovedSeller(req.user!.id);
      await sellerProductService.getProduct(seller as SellerProfile, req.params.id);
      return productImageController.setPrimaryImage(req, res, next);
    } catch (error) {
      return next(error);
    }
  }

  /** PUT /api/v1/seller/products/:id/images/reorder — own product only. */
  async reorderImages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const seller = await sellerProductService.requireApprovedSeller(req.user!.id);
      await sellerProductService.getProduct(seller as SellerProfile, req.params.id);
      return productImageController.reorderImages(req, res, next);
    } catch (error) {
      return next(error);
    }
  }
}

export default new SellerProductController();

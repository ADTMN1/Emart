import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import sellerService from '../services/seller.service';
import sellerDocumentStorageService from '../services/seller-document-storage.service';
import sellerDocumentController from './seller-document.controller';
import { sendSuccess } from '../utils/response';
import { ValidationError } from '../utils/errors';

/**
 * Admin seller management (Phase 5). All routes live behind
 * authenticate + authorize('ADMIN'); reviewedBy is always the
 * authenticated admin's id — never client input.
 */
class AdminSellerController {
  /** GET /api/v1/admin/sellers/applications?status=&page=&limit= */
  async listApplications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await sellerService.listApplications(
        { status: req.query.status as string | undefined },
        {
          page: Number(req.query.page) || 1,
          limit: Number(req.query.limit) || 20,
        }
      );
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/admin/sellers/applications/:id */
  async getApplication(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await sellerService.getApplicationById(req.params.id);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/sellers/applications/:id/document
   *
   * Returns a short-lived signed URL that streams the applicant's identity
   * document through this backend. ADMIN-only (router gate); neither the
   * storage path nor the file itself is ever exposed publicly.
   */
  async getApplicationDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { path } = await sellerService.getApplicationDocument(req.params.id);
      const url = await sellerDocumentStorageService.createSignedDocumentUrl(path);
      sendSuccess(res, {
        url,
        expiresIn: sellerDocumentStorageService.signedUrlTtlSeconds,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/sellers/applications/:id/document/content
   *
   * Streams the applicant's identity document directly, for API clients that
   * authenticate with a Bearer token instead of following the signed URL.
   * Authorization is enforced by the admin router gate; errors are handled by
   * the shared error middleware.
   */
  getApplicationDocumentContent(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    return sellerDocumentController.streamApplicationDocument(req, res, next);
  }

  /** POST /api/v1/admin/sellers/applications/:id/approve */
  async approveApplication(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await sellerService.approveApplication(req.params.id, req.user!.id);
      sendSuccess(res, data, 'Seller application approved.');
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/admin/sellers/applications/:id/reject */
  async rejectApplication(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = (req.body ?? {}) as { reason?: string };
      if (!reason || !reason.trim()) {
        throw new ValidationError('A rejection reason is required.');
      }
      const data = await sellerService.rejectApplication(req.params.id, req.user!.id, reason);
      sendSuccess(res, data, 'Seller application rejected.');
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/admin/sellers/:sellerId/suspend */
  async suspendSeller(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await sellerService.suspendSeller(req.params.sellerId, req.user!.id);
      sendSuccess(res, data, 'Seller suspended.');
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/admin/sellers/:sellerId/activate */
  async activateSeller(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await sellerService.activateSeller(req.params.sellerId, req.user!.id);
      sendSuccess(res, data, 'Seller reactivated.');
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminSellerController();

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import sellerService from '../services/seller.service';
import sellerShopMediaStorageService from '../services/seller-shop-media-storage.service';
import { sendSuccess } from '../utils/response';
import { BadRequestError, NotFoundError } from '../utils/errors';

/**
 * Customer seller endpoints (Phase 5). Every value is derived from the
 * authenticated user — no client-supplied userId/sellerId/status is read.
 */
class SellerController {
  /** GET /api/v1/seller/agreement — current agreement + caller's acceptance. */
  async getAgreement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const agreement = await sellerService.getAgreement(req.user!.id);
      sendSuccess(res, agreement);
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/seller/agreement/accept — record acceptance of the current
   *  server-controlled version. The version/timestamp are never client-set. */
  async acceptAgreement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const acceptance = await sellerService.acceptAgreement(req.user!.id);
      sendSuccess(res, acceptance, 'Seller Agreement accepted.', 201);
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/seller/application — submit or resubmit (rejected only).
   *  Multipart form: the identity document is uploaded to private storage and
   *  only its storage path (never a URL) is persisted on the application.
   *  The service performs the storage upload CONCURRENTLY with its read-only
   *  pre-checks and guarantees no orphaned document is left on failure. */
  async submitApplication(req: AuthRequest, res: Response, next: NextFunction) {
    const { storeName, storeDescription, email, emergencyContact, address } = req.body as {
      storeName?: string;
      storeDescription?: string;
      email?: string;
      emergencyContact?: string;
      address?: string;
    };

    try {
      const application = await sellerService.submitApplication(
        req.user!.id,
        {
          storeName: String(storeName ?? ''),
          storeDescription: String(storeDescription ?? ''),
          email: String(email ?? ''),
          emergencyContact: String(emergencyContact ?? ''),
          address: String(address ?? ''),
        },
        req.file
          ? {
              buffer: req.file.buffer,
              originalname: req.file.originalname,
              mimetype: req.file.mimetype,
            }
          : undefined,
      );
      sendSuccess(res, application, 'Seller application submitted.', 201);
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/seller/application — own application or null. */
  async getMyApplication(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const application = await sellerService.getMyApplication(req.user!.id);
      sendSuccess(res, application);
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/seller/profile — own seller identity or null. */
  async getMyProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const profile = await sellerService.getMyProfile(req.user!.id);
      sendSuccess(res, profile);
    } catch (error) {
      next(error);
    }
  }

  /** PUT /api/v1/seller/profile — update own store identity (name/description). */
  async updateMyProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { storeName, storeDescription } = req.body as {
        storeName?: string;
        storeDescription?: string;
      };
      const profile = await sellerService.updateMyProfile(req.user!.id, {
        storeName: String(storeName ?? ''),
        storeDescription: String(storeDescription ?? ''),
      });
      sendSuccess(res, profile, 'Store profile updated.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/seller/profile/:kind — upload the storefront logo/banner.
   * The image is stored in the public shop-media bucket and only its public
   * URL is persisted on the profile (the private path stays server-side).
   */
  uploadShopMedia(kind: 'logo' | 'banner') {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          throw new BadRequestError('No file uploaded');
        }
        const media = await sellerShopMediaStorageService.uploadShopMedia(
          kind,
          req.user!.id,
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
        );
        const profile = await sellerService.updateShopMedia(req.user!.id, kind, media);
        sendSuccess(res, profile, `${kind === 'logo' ? 'Logo' : 'Banner'} updated.`);
      } catch (error) {
        next(error);
      }
    };
  }

  /** DELETE /api/v1/seller/profile/:kind — remove the storefront logo/banner. */
  removeShopMedia(kind: 'logo' | 'banner') {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const profile = await sellerService.removeShopMedia(req.user!.id, kind);
        sendSuccess(res, profile, `${kind === 'logo' ? 'Logo' : 'Banner'} removed.`);
      } catch (error) {
        next(error);
      }
    };
  }

/**
 * Seller payment methods (payout methods) — sellers manage their own
 * withdrawal methods. Only accessible to authenticated sellers.
 */
  async listPaymentMethods(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const methods = await sellerService.listPaymentMethods(req.user!.id);
      sendSuccess(res, { methods });
    } catch (error) {
      next(error);
    }
  }

  async addPaymentMethod(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { type, details, isDefault } = req.body;
      const method = await sellerService.addPaymentMethod(req.user!.id, type, details, isDefault);
      sendSuccess(res, method, 'Payment method added.', 201);
    } catch (error) {
      next(error);
    }
  }

  async updatePaymentMethod(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { details, isDefault, isActive } = req.body;
      const method = await sellerService.updatePaymentMethod(req.user!.id, req.params.id, {
        details,
        isDefault,
        isActive,
      });
      sendSuccess(res, method, 'Payment method updated.');
    } catch (error) {
      next(error);
    }
  }

  async deletePaymentMethod(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await sellerService.deletePaymentMethod(req.user!.id, req.params.id);
      sendSuccess(res, null, 'Payment method deleted.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/seller/sales — store-scoped sales report over an optional
   * inclusive date window (defaults to the last 30 days). Every figure is
   * derived server-side from the caller's own seller profile; the client never
   * supplies a seller id.
   */
  async getSalesReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const report = await sellerService.getSalesReport(req.user!.id, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });
      sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }
}

export default new SellerController();

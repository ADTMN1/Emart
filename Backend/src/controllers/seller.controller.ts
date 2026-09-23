import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import sellerService from '../services/seller.service';
import sellerDocumentStorageService from '../services/seller-document-storage.service';
import { sendSuccess } from '../utils/response';

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
   *  only its storage path (never a URL) is persisted on the application. */
  async submitApplication(req: AuthRequest, res: Response, next: NextFunction) {
    const { storeName, storeDescription, email, emergencyContact, address } = req.body as {
      storeName?: string;
      storeDescription?: string;
      email?: string;
      emergencyContact?: string;
      address?: string;
    };

    let uploadedPath: string | undefined;
    try {
      let idDocumentMimeType: string | undefined;
      if (req.file) {
        const uploaded = await sellerDocumentStorageService.uploadSellerDocument(
          req.user!.id,
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
        );
        uploadedPath = uploaded.path;
        idDocumentMimeType = uploaded.mimetype;
      }

      const application = await sellerService.submitApplication(req.user!.id, {
        storeName: String(storeName ?? ''),
        storeDescription: String(storeDescription ?? ''),
        email: String(email ?? ''),
        emergencyContact: String(emergencyContact ?? ''),
        address: String(address ?? ''),
        idDocumentPath: uploadedPath,
        idDocumentMimeType,
      });
      sendSuccess(res, application, 'Seller application submitted.', 201);
    } catch (error) {
      // Never leave an orphaned private document behind on a failed submit.
      if (uploadedPath) {
        await sellerDocumentStorageService.deleteSellerDocument(uploadedPath);
      }
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
}

export default new SellerController();

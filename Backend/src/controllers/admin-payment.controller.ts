import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import paymentService from '../services/payment.service';
import { sendSuccess } from '../utils/response';
import { ValidationError } from '../utils/errors';

/**
 * Admin payment management (Phase 3) — inline in Admin → Order Detail.
 *
 * Manages the payment information already stored on the Order row.
 * No gateway integration, no crypto verification — see payment.service.ts.
 *
 * Named `admin-payment.controller.ts` because `payment.controller.ts`
 * already serves the checkout crypto-config endpoints.
 */
class AdminPaymentController {
  /** GET /api/v1/admin/orders/:orderId/payment */
  async getPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await paymentService.getPayment(req.params.orderId);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/admin/orders/:orderId/payment/verify */
  async verifyPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { note } = (req.body ?? {}) as { note?: string };
      const adminId = req.user!.id;
      const data = await paymentService.verifyPayment(req.params.orderId, adminId, note);
      sendSuccess(res, data, 'Payment verified.');
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/admin/orders/:orderId/payment/reject */
  async rejectPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = (req.body ?? {}) as { reason?: string };
      if (!reason || !reason.trim()) {
        throw new ValidationError('A rejection reason is required.');
      }
      const adminId = req.user!.id;
      const data = await paymentService.rejectPayment(req.params.orderId, adminId, reason);
      sendSuccess(res, data, 'Payment rejected.');
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/v1/admin/orders/:orderId/payment */
  async updatePayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { paymentStatus, paymentNote } = (req.body ?? {}) as {
        paymentStatus?: string;
        paymentNote?: string | null;
      };
      const data = await paymentService.updatePayment(req.params.orderId, {
        paymentStatus: paymentStatus as never,
        paymentNote,
      });
      sendSuccess(res, data, 'Payment updated.');
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminPaymentController();

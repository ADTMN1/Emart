import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errors';
import { PaymentStatus } from '@prisma/client';

/**
 * Admin payment management (Phase 3).
 *
 * Manages the payment state already stored on the Order row. No gateway
 * integration, no crypto verification, no totals recalculation — payment
 * management only changes payment state/information.
 *
 * Uses the existing PaymentStatus enum (PENDING | PAID | FAILED | REFUNDED).
 * Rejection is modelled as FAILED with a reason in `paymentNote`; verification
 * is PAID with `paidAt` stamped. Submitted proof (`paymentProofUrl`) is never
 * deleted by either action.
 */

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
];

/**
 * Valid payment-status transitions.
 *
 *   PENDING → PAID            (verify payment)
 *   PENDING → FAILED          (reject payment)
 *   PAID    → PENDING         (undo verification)
 *   FAILED  → PENDING         (resubmission → review again)
 *   FAILED  → PAID            (reject overturned after review)
 *
 * Terminal states: REFUNDED (handled by refund flows, out of scope here).
 */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ['PAID', 'FAILED'],
  PAID: ['PENDING'],
  FAILED: ['PENDING', 'PAID'],
  REFUNDED: [],
};

export class PaymentService {
  /** Load an order for payment management or throw NotFoundError. */
  private async requireOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        paymentStatus: true,
        paymentMethod: true,
        paymentProofUrl: true,
        paidAt: true,
        paymentNote: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    return order;
  }

  /** Validate a payment-status transition against the allowed map. */
  private assertTransition(current: PaymentStatus, next: PaymentStatus) {
    const allowed = PAYMENT_TRANSITIONS[current] || [];
    if (!allowed.includes(next)) {
      if (current === next) {
        throw new ValidationError(`Payment is already in status ${current}.`);
      }
      throw new ValidationError(
        `Cannot change payment status from ${current} to ${next}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}.`
      );
    }
  }

  /**
   * GET /admin/orders/:orderId/payment — the payment information already
   * stored on the order, plus the allowed transitions for the UI.
   */
  async getPayment(orderId: string) {
    const order = await this.requireOrder(orderId);
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      paymentProofUrl: order.paymentProofUrl,
      paidAt: order.paidAt,
      paymentNote: order.paymentNote,
      submittedAt: order.createdAt,
      updatedAt: order.updatedAt,
      allowedTransitions: PAYMENT_TRANSITIONS[order.paymentStatus] || [],
    };
  }

  /** Shared write path for verify/reject/status changes. */
  private async applyStatus(
    orderId: string,
    nextStatus: PaymentStatus,
    options: { paidAt?: Date | null; paymentNote?: string | null } = {}
  ) {
    const order = await this.requireOrder(orderId);
    this.assertTransition(order.paymentStatus as PaymentStatus, nextStatus);

    // Only payment state/information changes — totals, items, shipment and
    // order status are untouched. Existing proof/method are preserved.
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: nextStatus,
        // Explicit-undefined check (not ??) so an intentional `null` (rejection)
        // clears the timestamp instead of falling back to the old value.
        paidAt: options.paidAt !== undefined ? options.paidAt : order.paidAt,
        paymentNote: options.paymentNote !== undefined ? options.paymentNote : order.paymentNote,
      },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        paymentMethod: true,
        paymentProofUrl: true,
        paidAt: true,
        paymentNote: true,
        subtotal: true,
        total: true,
        status: true,
        updatedAt: true,
      },
    });

    return {
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      paymentStatus: updated.paymentStatus,
      paymentMethod: updated.paymentMethod,
      paymentProofUrl: updated.paymentProofUrl,
      paidAt: updated.paidAt,
      paymentNote: updated.paymentNote,
      updatedAt: updated.updatedAt,
      // Echoed back so tests/QA can assert totals were not modified.
      subtotal: updated.subtotal,
      total: updated.total,
      orderStatus: updated.status,
      allowedTransitions: PAYMENT_TRANSITIONS[updated.paymentStatus] || [],
    };
  }

  /** POST /admin/orders/:orderId/payment/verify — confirm the payment. */
  async verifyPayment(orderId: string, adminId: string, note?: string) {
    void adminId;
    return this.applyStatus(orderId, 'PAID', {
      paidAt: new Date(),
      paymentNote: note?.trim() ? note.trim() : null,
    });
  }

  /** POST /admin/orders/:orderId/payment/reject — reject with a reason. */
  async rejectPayment(orderId: string, adminId: string, reason: string) {
    void adminId;
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new ValidationError('A rejection reason is required.');
    }
    return this.applyStatus(orderId, 'FAILED', {
      paidAt: null,
      paymentNote: trimmed,
    });
  }

  /**
   * PATCH /admin/orders/:orderId/payment — limited edits: clear/set the admin
   * note, or move a payment back to PENDING for re-review. Status changes use
   * the same transition validation as verify/reject.
   */
  async updatePayment(
    orderId: string,
    data: { paymentStatus?: PaymentStatus; paymentNote?: string | null }
  ) {
    const order = await this.requireOrder(orderId);

    if (data.paymentStatus !== undefined && data.paymentStatus !== order.paymentStatus) {
      return this.applyStatus(orderId, data.paymentStatus, {
        // Moving back to PENDING (re-review) clears the verification timestamp.
        paidAt: data.paymentStatus === 'PENDING' ? null : undefined,
        // Status change through PATCH also carries an optional note.
        paymentNote: data.paymentNote !== undefined ? data.paymentNote : undefined,
      });
    }

    // Note-only update: no transition, no timestamps touched.
    if (data.paymentNote === undefined) {
      return this.getPayment(orderId);
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { paymentNote: data.paymentNote },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        paymentMethod: true,
        paymentProofUrl: true,
        paidAt: true,
        paymentNote: true,
        updatedAt: true,
      },
    });

    return {
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      paymentStatus: updated.paymentStatus,
      paymentMethod: updated.paymentMethod,
      paymentProofUrl: updated.paymentProofUrl,
      paidAt: updated.paidAt,
      paymentNote: updated.paymentNote,
      updatedAt: updated.updatedAt,
      allowedTransitions: PAYMENT_TRANSITIONS[updated.paymentStatus] || [],
    };
  }
}

export default new PaymentService();

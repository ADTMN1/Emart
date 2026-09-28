import prisma from '../config/database';
import { NotFoundError } from '../utils/errors';
import { PaginationParams } from '../types';

/** Notification types for consistent event naming. */
export const NotificationType = {
  // Customer-facing
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  SHIPMENT_CREATED: 'SHIPMENT_CREATED',
  SHIPMENT_STATUS_CHANGED: 'SHIPMENT_STATUS_CHANGED',
  SHIPMENT_TRACKING_UPDATED: 'SHIPMENT_TRACKING_UPDATED',
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  SUPPORT_MESSAGE_RECEIVED: 'SUPPORT_MESSAGE_RECEIVED',
  
  // Seller-facing
  SELLER_MESSAGE_RECEIVED: 'SELLER_MESSAGE_RECEIVED',

  // Seller application lifecycle. Fans out to every ADMIN on submission, and
  // is the canonical type for a status decision delivered back to the applicant.
  SELLER_APPLICATION_STATUS: 'SELLER_APPLICATION_STATUS',

  // Admin-facing (existing)
  ORDER_REQUEST: 'ORDER_REQUEST',
  MESSAGE: 'MESSAGE',
  SUPPORT_MESSAGE: 'SUPPORT_MESSAGE',
} as const;

export type NotificationTypeValue = typeof NotificationType[keyof typeof NotificationType];

/**
 * Order-request decision state, stored on the ORDER_REQUEST row itself.
 *
 * This is deliberately SEPARATE from `Notification.readAt`:
 *   * `readAt`        -> "has the seller seen this notification?"
 *   * `requestStatus` -> "has the seller acted on this order request?"
 *
 * An ORDER_REQUEST notification row *is* the order-request record (there is no
 * OrderRequest table and `/order-requests/:id/confirm` is keyed by notification
 * id), so retiring a request must never depend on whether the seller happened to
 * open the notification. `requestStatus` is null on every other type.
 */
export const OrderRequestStatus = {
  /** Sent to the seller, not yet accepted or declined. */
  PENDING: 'PENDING',
  /** Seller accepted; the order advances to CONFIRMED. */
  ACCEPTED: 'ACCEPTED',
  /** Seller declined. The request is closed without touching Order.status. */
  DECLINED: 'DECLINED',
} as const;

export type OrderRequestStatusValue = typeof OrderRequestStatus[keyof typeof OrderRequestStatus];

/**
 * User-targeted in-app notifications (Phase 7: Admin ↔ Seller messaging).
 *
 * Notifications are scoped to a single recipient user: sellers receive one
 * when the admin sends a message, admins receive one when a seller replies.
 * The same service powers the admin navbar bell and the seller/account
 * notification list — there is deliberately no separate "admin notification"
 * table. Read state is per-notification (`readAt`).
 */
export class NotificationService {
  // Injectable client so unit tests can pass a fake Prisma (mirrors the
  // rating/order services); production uses the real singleton.
  private prisma: typeof prisma;

  constructor(prismaClient: typeof prisma = prisma) {
    this.prisma = prismaClient;
  }

  getPrisma() {
    return this.prisma;
  }

  /**
   * Create a notification for one recipient. `type` is a plain string so the
   * set can grow without schema churn.
   */
  async create(input: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    orderId?: string;
    conversationId?: string;
    messageId?: string;
    supportConversationId?: string;
    supportMessageId?: string;
    shipmentId?: string;
  }) {
    return this.prisma.notification.create({ data: { ...input } });
  }

  /**
   * Paginated list for the authenticated recipient plus the recipient's
   * current unread count, so callers can render badges with a single request.
   */
  async listForUser(userId: string, params: PaginationParams = {}) {
    const page = Math.max(1, Math.floor(params.page || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(params.limit || 20)));
    const skip = (page - 1) * limit;

    const where = { userId };
    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  /**
   * Mark a single notification as read. Scoped by recipient id so a user can
   * never touch another user's notification; a missing/foreign row is a 404.
   */
  async markRead(userId: string, notificationId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundError('Notification not found');
    }
    return result.count;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }
}

export default new NotificationService();
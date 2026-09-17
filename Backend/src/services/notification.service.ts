import prisma from '../config/database';
import { NotFoundError } from '../utils/errors';
import { PaginationParams } from '../types';

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

  /**
   * Create a notification for one recipient. `type` is a plain string so the
   * set can grow without schema churn (currently: 'MESSAGE').
   */
  async create(input: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    orderId?: string;
    conversationId?: string;
    messageId?: string;
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
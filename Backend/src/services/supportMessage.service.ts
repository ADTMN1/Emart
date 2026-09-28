import prisma from '../config/database';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { PaginationParams } from '../types';
import NotificationService, { NotificationService as NotificationServiceClass, NotificationType } from './notification.service';

export const SUPPORT_MESSAGE_MAX_LENGTH = 5000;

export class SupportMessageService {
  private prisma: typeof prisma;
  private notifications: NotificationServiceClass;

  constructor(
    prismaClient: typeof prisma = prisma,
    notificationService: NotificationServiceClass = NotificationService,
  ) {
    this.prisma = prismaClient;
    this.notifications = notificationService;
  }

  private assertBody(body: string): string {
    const trimmed = typeof body === 'string' ? body.trim() : '';
    if (!trimmed) {
      throw new ValidationError('Message cannot be empty.');
    }
    if (trimmed.length > SUPPORT_MESSAGE_MAX_LENGTH) {
      throw new ValidationError(`Message must be at most ${SUPPORT_MESSAGE_MAX_LENGTH} characters.`);
    }
    return trimmed;
  }

  private async unreadCounts(conversationIds: string[], viewerUserId: string): Promise<Map<string, number>> {
    if (conversationIds.length === 0) {
      return new Map();
    }
    const grouped = await this.prisma.supportMessage.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversationIds },
        senderUserId: { not: viewerUserId },
        readAt: null,
      },
      _count: { _all: true },
    });
    return new Map(grouped.map((g) => [g.conversationId, g._count._all]));
  }

  private async enrichMessages(conversationId: string, messages: any[], currentUserId: string) {
    const senderIds = [...new Set(messages.map((m) => m.senderUserId))] as string[];
    const senders = senderIds.length > 0
      ? await this.prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, firstName: true, lastName: true, role: true } })
      : [];
    const senderMap = new Map(senders.map((u) => [u.id, u]));

    return messages.map((m) => {
      const sender = senderMap.get(m.senderUserId);
      const isAdmin = sender?.role === 'ADMIN';
      const senderName = isAdmin
        ? 'EMART Support'
        : sender
          ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'You'
          : 'Unknown';
      return {
        id: m.id,
        body: m.body,
        senderUserId: m.senderUserId,
        senderRole: isAdmin ? 'admin' : 'customer',
        senderName,
        isOwn: m.senderUserId === currentUserId,
        readAt: m.readAt,
        createdAt: m.createdAt,
      };
    });
  }

  async listConversations(userId: string, params: PaginationParams = {}) {
    const page = Math.max(1, Math.floor(params.page || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(params.limit || 20)));
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.prisma.supportConversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, body: true, senderUserId: true, sender: { select: { role: true } }, createdAt: true, readAt: true },
          },
        },
      }),
      this.prisma.supportConversation.count({ where: { userId } }),
    ]);

    const unreadMap = await this.unreadCounts(conversations.map((c) => c.id), userId);

    return {
      conversations: conversations.map((c) => {
        const last = c.messages[0] || null;
        return {
          id: c.id,
          subject: c.subject,
          status: c.status,
          updatedAt: c.updatedAt,
          createdAt: c.createdAt,
          lastMessage: last
            ? {
                id: last.id,
                body: last.body,
                fromAdmin: last.sender.role === 'ADMIN',
                createdAt: last.createdAt,
                readAt: last.readAt,
              }
            : null,
          unreadCount: unreadMap.get(c.id) || 0,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrCreateConversation(userId: string, subject?: string) {
    let conversation = await this.prisma.supportConversation.findFirst({
      where: { userId, status: { in: ['OPEN', 'RESOLVED'] } },
      orderBy: { updatedAt: 'desc' },
    });

    if (!conversation) {
      conversation = await this.prisma.supportConversation.create({
        data: { userId, subject: subject || 'General Support' },
      });
    }

    return conversation;
  }

  async getConversationMessages(userId: string, conversationId: string) {
    const conversation = await this.prisma.supportConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }

    const messages = await this.prisma.supportMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    const enriched = await this.enrichMessages(conversationId, messages, userId);

    return {
      conversation: {
        id: conversation.id,
        subject: conversation.subject,
        status: conversation.status,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: enriched,
      unreadCount: (await this.unreadCounts([conversationId], userId)).get(conversationId) || 0,
    };
  }

  /**
   * Admin read of a single conversation.
   *
   * Deliberately *not* reusing `getConversationMessages(userId, ...)`: that
   * method scopes the lookup to the customer who opened the thread, so an admin
   * calling it always missed and 404'd. Admins are authorized by role and a
   * conversation id, so the lookup keys on `conversationId` alone, while
   * `adminUserId` is still threaded into the helpers that need to know who is
   * reading (own-message flag, "unread" definition).
   */
  async getAdminConversationMessages(adminUserId: string, conversationId: string) {
    const conversation = await this.prisma.supportConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, subject: true, status: true, createdAt: true, updatedAt: true },
    });
    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }

    const messages = await this.prisma.supportMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    const enriched = await this.enrichMessages(conversationId, messages, adminUserId);

    return {
      conversation,
      messages: enriched,
      unreadCount: (await this.unreadCounts([conversationId], adminUserId)).get(conversationId) || 0,
    };
  }

  async sendMessage(userId: string, conversationId: string, body: string) {
    const trimmed = this.assertBody(body);
    const conversation = await this.prisma.supportConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }
    if (conversation.status === 'CLOSED') {
      throw new ForbiddenError('This conversation is closed.');
    }

    const message = await this.prisma.supportMessage.create({
      data: { conversationId, senderUserId: userId, body: trimmed },
    });

    await this.prisma.supportConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date(), status: 'OPEN' },
    });

    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    // Fan out concurrently: support desks typically have several admins and a
    // serial await here multiplies the request latency by the admin count.
    await Promise.all(
      admins.map((admin) =>
        this.notifications.create({
          userId: admin.id,
          type: NotificationType.SUPPORT_MESSAGE,
          title: 'New support message',
          body: `New message from user in conversation ${conversation.subject || 'General Support'}`,
          supportConversationId: conversationId,
          supportMessageId: message.id,
        }),
      ),
    );

    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, role: true },
    });
    const isAdmin = sender?.role === 'ADMIN';
    const senderName = isAdmin ? 'EMART Support' : `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim() || 'You';

    return {
      id: message.id,
      body: message.body,
      senderUserId: message.senderUserId,
      senderRole: isAdmin ? 'admin' : 'customer',
      senderName,
      isOwn: true,
      readAt: message.readAt,
      createdAt: message.createdAt,
    };
  }

  async sendAdminReply(adminUserId: string, conversationId: string, body: string) {
    const trimmed = this.assertBody(body);
    const conversation = await this.prisma.supportConversation.findUnique({
      where: { id: conversationId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }

    const message = await this.prisma.supportMessage.create({
      data: { conversationId, senderUserId: adminUserId, body: trimmed },
    });

    await this.prisma.supportConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date(), status: 'OPEN' },
    });

    await this.notifications.create({
      userId: conversation.userId,
      type: NotificationType.SUPPORT_MESSAGE,
      title: 'New reply from EMART Support',
      body: `New message in your support conversation`,
      supportConversationId: conversationId,
      supportMessageId: message.id,
    });

    return message;
  }

  async markConversationRead(userId: string, conversationId: string) {
    const conversation = await this.prisma.supportConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }
    const result = await this.prisma.supportMessage.updateMany({
      where: { conversationId, senderUserId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async markAdminConversationRead(adminUserId: string, conversationId: string) {
    const conversation = await this.prisma.supportConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }
    const result = await this.prisma.supportMessage.updateMany({
      where: { conversationId, senderUserId: { not: adminUserId }, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async updateConversationStatus(adminUserId: string, conversationId: string, status: 'OPEN' | 'CLOSED' | 'RESOLVED') {
    const conversation = await this.prisma.supportConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }
    const updated = await this.prisma.supportConversation.update({
      where: { id: conversationId },
      data: { status },
    });
    return updated;
  }

  async getAdminConversations(adminUserId: string, params: PaginationParams & { status?: string; search?: string } = {}) {
    const page = Math.max(1, Math.floor(params.page || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(params.limit || 20)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status) {
      where.status = params.status;
    }
    if (params.search) {
      where.OR = [
        { subject: { contains: params.search, mode: 'insensitive' } },
        { user: { email: { contains: params.search, mode: 'insensitive' } } },
        { user: { firstName: { contains: params.search, mode: 'insensitive' } } },
        { user: { lastName: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [conversations, total] = await Promise.all([
      this.prisma.supportConversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, body: true, senderUserId: true, sender: { select: { role: true } }, createdAt: true, readAt: true },
          },
        },
      }),
      this.prisma.supportConversation.count({ where }),
    ]);

    const allConversationIds = conversations.map((c) => c.id);
    // Scope unread to messages the *admin* has not sent, so an admin's own
    // pending reply is never counted as unread work for the support queue.
    const adminUnreadMap = await this.unreadCounts(allConversationIds, adminUserId);

    return {
      conversations: conversations.map((c) => {
        const last = c.messages[0] || null;
        return {
          id: c.id,
          subject: c.subject,
          status: c.status,
          updatedAt: c.updatedAt,
          createdAt: c.createdAt,
          user: c.user,
          lastMessage: last
            ? {
                id: last.id,
                body: last.body,
                fromAdmin: last.sender.role === 'ADMIN',
                createdAt: last.createdAt,
                readAt: last.readAt,
              }
            : null,
          unreadCount: adminUnreadMap.get(c.id) || 0,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new SupportMessageService();
import prisma from '../config/database';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { PaginationParams } from '../types';
import NotificationService, { NotificationService as NotificationServiceClass } from './notification.service';
import sellerServiceSingleton from './seller.service';

export const MESSAGE_MAX_LENGTH = 2000;

interface SellerProfileLike {
  id: string;
  userId: string;
  storeName: string;
  status: string;
}

interface SellerServiceLike {
  requireApprovedSeller: (userId: string) => Promise<SellerProfileLike>;
}

/**
 * Order-specific Admin ↔ Seller messaging (Phase 7).
 *
 * A conversation belongs to exactly one (order, seller) pair — an order may
 * contain items from several sellers, so the unique (orderId, sellerId)
 * constraint yields one conversation per order+seller and no accidental
 * duplicates. Customers have no relation to conversations.
 *
 * Authorization rules:
 *  - Admin methods rely on the router-level `authorize('ADMIN')`.
 *  - Seller methods call `requireApprovedSeller` (authenticated user →
 *    SellerProfile → APPROVED) and every conversation is looked up by the
 *    caller's own seller profile id — identity/ownership always comes from the
 *    authenticated user, never from the request body.
 *
 * `Message.readAt` records when the RECIPIENT read the message. It is set by
 * the opposite side calling markRead; messages sent by the current user are
 * never marked read by them.
 */
export class MessageService {
  private prisma: typeof prisma;
  private notifications: NotificationServiceClass;
  private sellerAuth: SellerServiceLike;

  constructor(
    prismaClient: typeof prisma = prisma,
    notificationService: NotificationServiceClass = NotificationService,
    sellerService: SellerServiceLike = sellerServiceSingleton,
  ) {
    this.prisma = prismaClient;
    this.notifications = notificationService;
    this.sellerAuth = sellerService;
  }

  private assertBody(body: string): string {
    const trimmed = typeof body === 'string' ? body.trim() : '';
    if (!trimmed) {
      throw new ValidationError('Message cannot be empty.');
    }
    if (trimmed.length > MESSAGE_MAX_LENGTH) {
      throw new ValidationError(`Message must be at most ${MESSAGE_MAX_LENGTH} characters.`);
    }
    return trimmed;
  }

  /** Distinct seller ids whose products are part of an order. */
  private async resolveOrderSellers(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        items: { select: { product: { select: { sellerId: true } } } },
      },
    });
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    const sellerIds = [...new Set(order.items.map((i) => i.product.sellerId).filter(Boolean))] as string[];
    return { order, sellerIds };
  }

  /** Unread per-conversation counts for the viewing user (messages they haven't read). */
  private async unreadCounts(conversationIds: string[], viewerUserId: string): Promise<Map<string, number>> {
    if (conversationIds.length === 0) {
      return new Map();
    }
    const grouped = await this.prisma.message.groupBy({
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

  private async conversationBundle(conversation: { id: string; orderId: string; sellerId: string }) {
    const [order, seller] = await Promise.all([
      this.prisma.order.findUnique({
        where: { id: conversation.orderId },
        select: { id: true, orderNumber: true },
      }),
      this.prisma.sellerProfile.findUnique({
        where: { id: conversation.sellerId },
        select: { id: true, storeName: true },
      }),
    ]);
    return {
      conversation: {
        id: conversation.id,
        orderId: conversation.orderId,
        orderNumber: order?.orderNumber ?? conversation.orderId,
        seller: seller ? { id: seller.id, storeName: seller.storeName } : { id: conversation.sellerId, storeName: 'Seller' },
      },
    };
  }

  private async enrichMessages(conversation: { id: string; orderId: string; sellerId: string }, messages: any[]) {
    const [order, seller] = await Promise.all([
      this.prisma.order.findUnique({
        where: { id: conversation.orderId },
        select: { id: true, orderNumber: true, status: true },
      }),
      this.prisma.sellerProfile.findUnique({
        where: { id: conversation.sellerId },
        select: { id: true, storeName: true },
      }),
    ]);

    const senderIds = [...new Set(messages.map((m) => m.senderUserId))] as string[];
    const senders = senderIds.length > 0
      ? await this.prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, role: true } })
      : [];
    const roleById = new Map(senders.map((u) => [u.id, u.role]));

    return {
      conversation: { id: conversation.id },
      order: order ? { id: order.id, orderNumber: order.orderNumber, status: order.status } : null,
      seller: seller ? { id: seller.id, storeName: seller.storeName } : null,
      messages: messages.map((m) => {
        const isAdmin = roleById.get(m.senderUserId) === 'ADMIN';
        return {
          id: m.id,
          body: m.body,
          senderUserId: m.senderUserId,
          senderRole: isAdmin ? 'admin' : 'seller',
          senderName: isAdmin ? 'EMART Admin' : seller?.storeName || 'Seller',
          readAt: m.readAt,
          createdAt: m.createdAt,
        };
      }),
    };
  }

  // ---------------------------------------------------------------------
  // ADMIN (router-level authorize('ADMIN'))
  // ---------------------------------------------------------------------

  /**
   * GET /admin/orders/:orderId/conversations
   * All conversations for an order (there is one per seller) plus the list of
   * APPROVED sellers on the order, so the admin UI can start a conversation.
   */
  async listOrderConversations(adminUserId: string, orderId: string) {
    const { order, sellerIds } = await this.resolveOrderSellers(orderId);

    const sellers = await this.prisma.sellerProfile.findMany({
      where: { id: { in: sellerIds }, status: 'APPROVED' },
      select: { id: true, storeName: true },
    });

    const conversations = await this.prisma.conversation.findMany({
      where: { orderId },
      include: {
        seller: { select: { id: true, storeName: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, body: true, senderUserId: true, createdAt: true },
        },
      },
    });

    const unreadMap = await this.unreadCounts(conversations.map((c) => c.id), adminUserId);

    return {
      order: { id: order.id, orderNumber: order.orderNumber, status: order.status },
      sellers,
      conversations: conversations.map((c) => ({
        id: c.id,
        sellerId: c.sellerId,
        seller: c.seller,
        lastMessage: c.messages[0] || null,
        unreadCount: unreadMap.get(c.id) || 0,
      })),
    };
  }

  /**
   * POST /admin/orders/:orderId/conversations  { sellerId }
   * Get-or-create the single conversation for an order+seller. The seller must
   * be an APPROVED seller whose products appear in the order; the unique
   * (orderId, sellerId) constraint guarantees no duplicate conversations even
   * under concurrent requests.
   */
  async getOrCreateConversation(orderId: string, sellerId: string) {
    const { sellerIds } = await this.resolveOrderSellers(orderId);
    if (!sellerIds.includes(sellerId)) {
      throw new ForbiddenError('This seller is not associated with the order.');
    }

    const profile = await this.prisma.sellerProfile.findUnique({
      where: { id: sellerId },
      select: { id: true, storeName: true, status: true },
    });
    if (!profile) {
      throw new NotFoundError('Seller not found.');
    }
    if (profile.status !== 'APPROVED') {
      throw new ForbiddenError('Seller account is not active.');
    }

    const existing = await this.prisma.conversation.findUnique({
      where: { orderId_sellerId: { orderId, sellerId } },
    });
    if (existing) {
      return this.conversationBundle(existing);
    }

    try {
      const created = await this.prisma.conversation.create({ data: { orderId, sellerId } });
      return this.conversationBundle(created);
    } catch (err: any) {
      // Unique-constraint race: another request created it first.
      if (err && err.code === 'P2002') {
        const createdElsewhere = await this.prisma.conversation.findUnique({
          where: { orderId_sellerId: { orderId, sellerId } },
        });
        if (createdElsewhere) {
          return this.conversationBundle(createdElsewhere);
        }
      }
      throw err;
    }
  }

  /** GET /admin/conversations/:id/messages — admins may view any conversation. */
  async getAdminConversationMessages(adminUserId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    const enriched = await this.enrichMessages(conversation, messages);
    return {
      ...enriched,
      unreadCount: (await this.unreadCounts([conversation.id], adminUserId)).get(conversation.id) || 0,
    };
  }

  /** POST /admin/conversations/:id/messages  { body } — send + notify the seller. */
  async sendAdminMessage(adminUserId: string, conversationId: string, body: string) {
    const trimmed = this.assertBody(body);
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { order: { select: { orderNumber: true } }, seller: { select: { userId: true, storeName: true } } },
    });
    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }

    const message = await this.prisma.message.create({
      data: { conversationId, senderUserId: adminUserId, body: trimmed },
    });

    await this.notifications.create({
      userId: conversation.seller.userId,
      type: 'MESSAGE',
      title: 'New message from EMART Admin',
      body: `New message regarding Order ${conversation.order.orderNumber}`,
      orderId: conversation.orderId,
      conversationId,
      messageId: message.id,
    });

    return message;
  }

  /** PATCH /admin/conversations/:id/read — mark seller messages as read. */
  async markAdminConversationRead(adminUserId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }
    const result = await this.prisma.message.updateMany({
      where: { conversationId, senderUserId: { not: adminUserId }, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  // ---------------------------------------------------------------------
  // SELLER (authenticated + requireApprovedSeller, ownership from profile)
  // ---------------------------------------------------------------------

  private async requireSellerProfile(userId: string) {
    return this.sellerAuth.requireApprovedSeller(userId);
  }

  /** GET /seller/conversations — the caller's own conversations with unread counts. */
  async listSellerConversations(userId: string, params: PaginationParams = {}) {
    const profile = await this.requireSellerProfile(userId);
    const page = Math.max(1, Math.floor(params.page || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(params.limit || 20)));
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { sellerId: profile.id },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          order: { select: { id: true, orderNumber: true, status: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, body: true, senderUserId: true, sender: { select: { role: true } }, createdAt: true },
          },
        },
      }),
      this.prisma.conversation.count({ where: { sellerId: profile.id } }),
    ]);

    const unreadMap = await this.unreadCounts(conversations.map((c) => c.id), profile.userId);

    return {
      conversations: conversations.map((c) => {
        const last = c.messages[0] || null;
        return {
          id: c.id,
          orderId: c.orderId,
          orderNumber: c.order.orderNumber,
          orderStatus: c.order.status,
          updatedAt: c.updatedAt,
          lastMessage: last
            ? {
                id: last.id,
                body: last.body,
                fromSeller: last.sender.role !== 'ADMIN',
                createdAt: last.createdAt,
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

  /** GET /seller/conversations/:id/messages — owner-only thread. */
  async getSellerConversationMessages(userId: string, conversationId: string) {
    const profile = await this.requireSellerProfile(userId);
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, sellerId: profile.id },
    });
    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    const enriched = await this.enrichMessages(conversation, messages);
    return {
      ...enriched,
      unreadCount: (await this.unreadCounts([conversation.id], userId)).get(conversation.id) || 0,
    };
  }

  /** POST /seller/conversations/:id/messages  { body } — reply + notify every admin. */
  async sendSellerReply(userId: string, conversationId: string, body: string) {
    const trimmed = this.assertBody(body);
    const profile = await this.requireSellerProfile(userId);
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, sellerId: profile.id },
      include: { order: { select: { orderNumber: true } } },
    });
    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }

    const message = await this.prisma.message.create({
      data: { conversationId, senderUserId: userId, body: trimmed },
    });

    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    for (const admin of admins) {
      await this.notifications.create({
        userId: admin.id,
        type: 'MESSAGE',
        title: `New message from ${profile.storeName}`,
        body: `New message regarding Order ${conversation.order.orderNumber}`,
        orderId: conversation.orderId,
        conversationId,
        messageId: message.id,
      });
    }

    return message;
  }

  /** PATCH /seller/conversations/:id/read — mark admin messages as read. */
  async markSellerConversationRead(userId: string, conversationId: string) {
    const profile = await this.requireSellerProfile(userId);
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, sellerId: profile.id },
    });
    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }
    const result = await this.prisma.message.updateMany({
      where: { conversationId, senderUserId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}

export default new MessageService();
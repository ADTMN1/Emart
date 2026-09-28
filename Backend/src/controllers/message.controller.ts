import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import messageService from '../services/message.service';
import { NotificationType, OrderRequestStatus } from '../services/notification.service';
import { sendSuccess, sendError } from '../utils/response';

/**
 * Admin ↔ Seller messaging controllers (Phase 7).
 *
 * Admin methods are mounted under the admin router (already gated by
 * `authenticate` + `authorize('ADMIN')`). Seller methods are mounted under the
 * seller router (`authenticate`); the approved-seller gate and conversation
 * ownership are enforced inside the service from req.user.id — never from the
 * request body.
 */
class MessageController {
  // -------------------------------------------------------------------
  // ADMIN
  // -------------------------------------------------------------------

  async listOrderConversations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await messageService.listOrderConversations(req.user!.id, req.params.orderId);
      return sendSuccess(res, data, 'Conversations retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getOrCreateConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { conversation } = await messageService.getOrCreateConversation(
        req.params.orderId,
        req.body.sellerId,
      );
      return sendSuccess(res, conversation, 'Conversation ready', 201);
    } catch (error) {
      next(error);
    }
  }

  async sendOrderToSeller(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.params;
      const { sellerId } = req.body;

      // Get order details
      const order = await messageService.getPrisma().order.findUnique({
        where: { id: orderId },
        select: { id: true, orderNumber: true, userId: true },
      });

      if (!order) {
        return sendError(res, 'Order not found', 404);
      }

      // sellerId is the seller profile ID, need to get the userId from the seller profile
      const sellerProfile = await messageService.getPrisma().sellerProfile.findUnique({
        where: { id: sellerId },
        select: { id: true, userId: true, storeName: true },
      });

      if (!sellerProfile) {
        return sendError(res, 'Seller profile not found', 404);
      }

      const sellerUserId = sellerProfile.userId;

      // Check if seller user exists
      const sellerUser = await messageService.getPrisma().user.findUnique({
        where: { id: sellerUserId },
        select: { id: true, email: true },
      });

      if (!sellerUser) {
        return sendError(res, 'Seller user not found', 404);
      }

      // Idempotency guard. An ORDER_REQUEST is a state transition ("this seller
      // now has work"), not a message, so re-sending must not stack duplicate
      // rows on the seller's order-request queue.
      //
      // The seller-facing `sellerId` above is a SellerProfile id; notifications
      // are addressed to the owning user account, so the lookup keys on
      // `sellerUserId`.
      //
      // A bare findFirst-then-create is NOT sufficient: two concurrent requests
      // can both observe "no existing row" and both insert. A transaction-level
      // advisory lock keyed on (userId, orderId) serialises them, so the second
      // request sees the first one's row. The lock is released automatically at
      // the end of the transaction; a hash collision only over-serialises
      // unrelated pairs, it cannot permit a duplicate.
      const prismaClient = messageService.getPrisma();
      const alreadyRequested = await prismaClient.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-request:${sellerUserId}:${orderId}`}))`;

        const existing = await tx.notification.findFirst({
          where: {
            userId: sellerUserId,
            type: NotificationType.ORDER_REQUEST,
            orderId,
          },
          select: { id: true },
        });
        if (existing) {
          return true;
        }

        await tx.notification.create({
          data: {
            userId: sellerUserId,
            type: NotificationType.ORDER_REQUEST,
            title: 'New Order Request',
            body: `Order ${order.orderNumber} has been sent to you for fulfillment.`,
            orderId,
            requestStatus: OrderRequestStatus.PENDING,
          },
        });
        return false;
      });

      if (alreadyRequested) {
        return sendError(res, 'Order request has already been sent to this seller.', 409);
      }

      return sendSuccess(res, { orderId, orderNumber: order.orderNumber }, `Order sent to seller ${sellerProfile.storeName} successfully`);
    } catch (error: any) {
      console.error('Error in sendOrderToSeller:', error.message, error.code, error.meta);
      next(error);
    }
  }

  async getAdminMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await messageService.getAdminConversationMessages(req.user!.id, req.params.id);
      return sendSuccess(res, data, 'Messages retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async sendAdminMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const message = await messageService.sendAdminMessage(req.user!.id, req.params.id, req.body.body);
      return sendSuccess(res, message, 'Message sent successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async markAdminConversationRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await messageService.markAdminConversationRead(req.user!.id, req.params.id);
      return sendSuccess(res, data, 'Messages marked as read');
    } catch (error) {
      next(error);
    }
  }

  // -------------------------------------------------------------------
  // SELLER
  // -------------------------------------------------------------------

  async listMyConversations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await messageService.listSellerConversations(req.user!.id, {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });
      return sendSuccess(res, data, 'Conversations retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getSellerMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await messageService.getSellerConversationMessages(req.user!.id, req.params.id);
      return sendSuccess(res, data, 'Messages retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async sendSellerReply(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const message = await messageService.sendSellerReply(req.user!.id, req.params.id, req.body.body);
      return sendSuccess(res, message, 'Message sent successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async markSellerConversationRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await messageService.markSellerConversationRead(req.user!.id, req.params.id);
      return sendSuccess(res, data, 'Messages marked as read');
    } catch (error) {
      next(error);
    }
  }

  async getOrderRequests(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      // Get seller profile
      const sellerProfile = await messageService.getPrisma().sellerProfile.findUnique({
        where: { userId },
        select: { id: true, userId: true },
      });

      if (!sellerProfile) {
        return sendSuccess(res, { requests: [] }, 'No seller profile found');
      }

      // The seller's order-request queue is driven by the request's own state
      // (requestStatus), NOT by readAt. Reading a notification in the bell only
      // records that it was seen; it must never retire a pending request.
      const notifications = await messageService.getPrisma().notification.findMany({
        where: {
          userId: sellerProfile.userId,
          type: NotificationType.ORDER_REQUEST,
          requestStatus: OrderRequestStatus.PENDING,
        },
        select: {
          id: true,
          title: true,
          body: true,
          orderId: true,
          readAt: true,
          requestStatus: true,
          requestRespondedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Get order details for each request
      const orderIds = notifications.map((n) => n.orderId).filter(Boolean);
      const orders = await messageService.getPrisma().order.findMany({
        where: { id: { in: orderIds } },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          createdAt: true,
          total: true,
          items: {
            select: {
              product: {
                select: { name: true, condition: true },
              },
            },
          },
        },
      });

      const ordersMap = new Map(orders.map((o) => [o.id, o]));

      const requests = notifications.map((n) => ({
        notification: n,
        order: n.orderId ? ordersMap.get(n.orderId) : null,
      }));

      return sendSuccess(res, { requests }, 'Order requests retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async confirmOrderRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const notificationId = req.params.id;

      // Get seller profile
      const sellerProfile = await messageService.getPrisma().sellerProfile.findUnique({
        where: { userId },
        select: { id: true, userId: true },
      });

      if (!sellerProfile) {
        return sendError(res, 'Seller profile not found', 404);
      }

      // Find the notification and verify it belongs to this seller
      const notification = await messageService.getPrisma().notification.findUnique({
        where: { id: notificationId },
        select: { id: true, userId: true, orderId: true, type: true, requestStatus: true },
      });

      if (!notification) {
        return sendError(res, 'Order request not found', 404);
      }

      if (notification.userId !== sellerProfile.userId) {
        return sendError(res, 'Not authorized to confirm this order request', 403);
      }

      if (notification.type !== NotificationType.ORDER_REQUEST) {
        return sendError(res, 'This is not an order request', 400);
      }

      // Accepting is a business decision recorded in requestStatus. readAt is
      // set alongside it only so the bell renders the item as seen — the request
      // is NOT retired by its read state. A request the seller merely opened
      // still reads as PENDING and is therefore still acceptable here.
      const respondedAt = new Date();
      const accepted = await messageService.getPrisma().$transaction(async (tx) => {
        // Claim the request by decision state. updateMany makes the claim
        // atomic: if a second confirm races this one, only one sees count === 1.
        const claimed = await tx.notification.updateMany({
          where: {
            id: notificationId,
            userId: sellerProfile.userId,
            type: NotificationType.ORDER_REQUEST,
            requestStatus: OrderRequestStatus.PENDING,
          },
          data: {
            requestStatus: OrderRequestStatus.ACCEPTED,
            requestRespondedAt: respondedAt,
            readAt: respondedAt,
          },
        });
        if (claimed.count === 0) {
          return false;
        }

        if (notification.orderId) {
          await tx.order.update({
            where: { id: notification.orderId },
            data: { status: 'CONFIRMED' },
          });
        }
        return true;
      });

      if (!accepted) {
        return sendError(res, 'This order request has already been handled.', 409);
      }

      return sendSuccess(res, { success: true }, 'Order confirmed successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Seller declines an order request.
   *
   * Closes the request WITHOUT touching Order.status. Declining is a
   * seller-side workflow decision; changing the order's fulfilment status here
   * would reach into order/business behaviour that this notification work does
   * not own, so the order is left exactly as it was.
   */
  async declineOrderRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const notificationId = req.params.id;

      const sellerProfile = await messageService.getPrisma().sellerProfile.findUnique({
        where: { userId },
        select: { id: true, userId: true },
      });

      if (!sellerProfile) {
        return sendError(res, 'No seller profile found', 404);
      }

      const notification = await messageService.getPrisma().notification.findUnique({
        where: { id: notificationId },
        select: { id: true, userId: true, orderId: true, type: true, requestStatus: true },
      });

      if (!notification) {
        return sendError(res, 'Order request not found', 404);
      }

      // Ownership check first: a seller may never act on another seller's row.
      if (notification.userId !== sellerProfile.userId) {
        return sendError(res, 'Not authorized to decline this order request', 403);
      }

      if (notification.type !== NotificationType.ORDER_REQUEST) {
        return sendError(res, 'This is not an order request', 400);
      }

      // Same atomic claim-by-state pattern as accept, so a concurrent
      // accept/decline resolves to exactly one winner.
      const respondedAt = new Date();
      const declined = await messageService.getPrisma().notification.updateMany({
        where: {
          id: notificationId,
          userId: sellerProfile.userId,
          type: NotificationType.ORDER_REQUEST,
          requestStatus: OrderRequestStatus.PENDING,
        },
        data: {
          requestStatus: OrderRequestStatus.DECLINED,
          requestRespondedAt: respondedAt,
          readAt: respondedAt,
        },
      });

      if (declined.count === 0) {
        return sendError(res, 'This order request has already been handled.', 409);
      }

      return sendSuccess(res, { success: true }, 'Order request declined');
    } catch (error) {
      next(error);
    }
  }

  async getSellerOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      // Get seller profile
      const sellerProfile = await messageService.getPrisma().sellerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!sellerProfile) {
        return sendSuccess(res, { orders: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }, 'No seller profile found');
      }

      const filters = {
        status: req.query.status as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      };

      // Find orders that contain products from this seller
      const orderIds = await messageService.getPrisma().orderItem.findMany({
        where: {
          product: {
            sellerId: sellerProfile.id,
          },
        },
        select: { orderId: true },
        distinct: ['orderId'],
      });

      const orderIdArray = orderIds.map((oi) => oi.orderId);

      if (orderIdArray.length === 0) {
        return sendSuccess(res, { orders: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }, 'No orders found');
      }

      const where: any = { id: { in: orderIdArray } };

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      }

      const { page = 1, limit = 20 } = pagination;
      const skip = (page - 1) * limit;

      const [orders, total] = await Promise.all([
        messageService.getPrisma().order.findMany({
          where,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
            items: {
              select: {
                id: true,
                quantity: true,
                priceAtPurchase: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    condition: true,
                    productImages: {
                      where: { isPrimary: true },
                      take: 1,
                      select: { url: true },
                    },
                  },
                },
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        messageService.getPrisma().order.count({ where }),
      ]);

      return sendSuccess(res, { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }, 'Seller orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getSellerOrderById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      // Get seller profile
      const sellerProfile = await messageService.getPrisma().sellerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!sellerProfile) {
        return sendSuccess(res, null, 'No seller profile found');
      }

      // Check if order contains products from this seller
      const orderItem = await messageService.getPrisma().orderItem.findFirst({
        where: {
          orderId: req.params.id,
          product: {
            sellerId: sellerProfile.id,
          },
        },
        select: { orderId: true },
      });

      if (!orderItem) {
        return sendError(res, 'Order not found', 404);
      }

      const order = await messageService.getPrisma().order.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          subtotal: true,
          total: true,
          shippingMethod: true,
          trackingNumber: true,
          estimatedDelivery: true,
          paymentStatus: true,
          createdAt: true,
          updatedAt: true,
          // Loaded together in one query after the order row is read, instead
          // of two per-relation round-trips. See the projection below.
          billingAddressId: true,
          shippingAddressId: true,
          items: {
            select: {
              id: true,
              quantity: true,
              priceAtPurchase: true,
              serviceFeeAtPurchase: true,
              productSnapshot: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  condition: true,
                  source: true,
                  category: { select: { id: true, name: true } },
                  productImages: {
                    where: { isPrimary: true },
                    take: 1,
                    select: { id: true, url: true, isPrimary: true },
                  },
                },
              },
            },
          },
          shipment: {
            select: {
              id: true,
              trackingNumber: true,
              carrier: true,
              status: true,
              shippingCost: true,
              estimatedDelivery: true,
              shippedAt: true,
              deliveredAt: true,
              createdAt: true,
              events: true,
            },
          },
        },
      });

      if (!order) {
        return sendError(res, 'Order not found', 404);
      }

      // Both address rows are fetched with a single de-duplicated query. They
      // stay mapped to their own FK, so a distinct billing/shipping pair is
      // preserved, and the FK columns are stripped from the response.
      const addressIds = [...new Set([order.billingAddressId, order.shippingAddressId].filter(Boolean))];
      const addressRows = addressIds.length
        ? await messageService.getPrisma().address.findMany({
            where: { id: { in: addressIds } },
            select: {
              id: true,
              fullName: true,
              addressLine: true,
              city: true,
              state: true,
              postalCode: true,
              country: true,
              phone: true,
            },
          })
        : [];
      const addressById = new Map(addressRows.map((row) => [row.id, row]));
      const { billingAddressId, shippingAddressId, ...orderWithoutAddressIds } = order;
      const payload = {
        ...orderWithoutAddressIds,
        billingAddress: addressById.get(billingAddressId) ?? null,
        shippingAddress: addressById.get(shippingAddressId) ?? null,
      };

      return sendSuccess(res, { order: payload }, 'Order retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new MessageController();
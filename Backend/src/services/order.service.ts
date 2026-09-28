import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errors';
import { OrderFilters, PaginationParams } from '../types';
import { Prisma } from '@prisma/client';

/**
 * Address projection shared by the billing and shipping relations of the
 * order-detail payload. Both relations expose exactly these keys.
 */
type OrderAddress = {
  fullName: string;
  addressLine: string;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  phone: string;
};

/**
 * Scalar projection for the admin order list.
 *
 * The key order is significant: it is the order these keys appear in the
 * serialised admin order objects, because the relation loader spreads them in
 * exactly this sequence and appends `user`, `items` and then `sellers`.
 */
const ADMIN_ORDER_LIST_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  subtotal: true,
  serviceFees: true,
  domesticShipping: true,
  internationalShipping: true,
  insurance: true,
  total: true,
  trackingNumber: true,
  shippingMethod: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class OrderService {
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `EM-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Shared order-detail select shape.
   *
   * `includeAdmin` extends the projection with fields only admins should see
   * (customer identity, payment-proof reference, item product snapshots and
   * shipment cost). The customer detail payload keeps its previous shape; the
   * admin detail adds those fields on top.
   */
  private orderDetailSelect(includeAdmin: boolean) {
    return {
      id: true,
      orderNumber: true,
      status: true,
      subtotal: true,
      serviceFees: true,
      domesticShipping: true,
      internationalShipping: true,
      insurance: true,
      total: true,
      shippingMethod: true,
      shippingCarrier: true,
      trackingNumber: true,
      estimatedDelivery: true,
      notes: true,
      paymentStatus: true,
      paymentMethod: true,
      // Admin-only: the payment-proof reference is not exposed to customers.
      ...(includeAdmin ? { paymentProofUrl: true } : {}),
      // Admin-only payment-management metadata (Phase 3).
      ...(includeAdmin ? { paidAt: true } : {}),
      ...(includeAdmin ? { paymentNote: true } : {}),
      createdAt: true,
      updatedAt: true,
      // Admin-only: the customer this order belongs to.
      ...(includeAdmin
        ? {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          }
        : {}),
      items: {
        select: {
          id: true,
          quantity: true,
          priceAtPurchase: true,
          serviceFeeAtPurchase: true,
          domesticShippingAtPurchase: true,
          // Admin-only: full product snapshot captured at purchase time.
          ...(includeAdmin ? { productSnapshot: true } : {}),
          product: {
            select: {
              id: true,
              name: true,
              condition: true,
              source: true,
              // Admin-only: which seller store provides each item (Phase 7).
              ...(includeAdmin
                ? { sellerProfile: { select: { id: true, storeName: true } } }
                : {}),
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
              productImages: {
                where: { isPrimary: true },
                take: 1,
                select: {
                  url: true,
                },
              },
            },
          },
        },
      },
      // Billing/shipping addresses are loaded by `attachAddresses` in a single
      // query instead of two per-relation round-trips. Only the FK ids are
      // selected here; they are stripped before the payload is returned.
      billingAddressId: true,
      shippingAddressId: true,
      shipment: {
        select: {
          id: true,
          trackingNumber: true,
          carrier: true,
          status: true,
          // Admin-only: shipment cost is internal data.
          ...(includeAdmin ? { shippingCost: true } : {}),
          shippedAt: true,
          estimatedDelivery: true,
          deliveredAt: true,
          events: true,
        },
      },
    } satisfies Prisma.OrderSelect;
  }

  /**
   * Address fields shared by the billing and shipping projections. The API
   * contract exposes exactly these keys, so they are re-projected explicitly
   * after loading instead of returning the raw rows.
   */
  private static readonly ADDRESS_FIELDS = {
    fullName: true,
    addressLine: true,
    city: true,
    state: true,
    postalCode: true,
    country: true,
    phone: true,
  };

  private static readonly ORDER_ADDRESS_FIELDS = {
    id: true,
    ...OrderService.ADDRESS_FIELDS,
  };

  /**
   * Loads both addresses of an order with ONE query and returns the order with
   * `billingAddress` / `shippingAddress` shaped exactly as the previous
   * per-relation selects produced them.
   *
   * Billing and shipping are two independent foreign keys, so they stay
   * distinct here: each id is mapped to its own row. When both ids point at the
   * same address the duplicate is de-duplicated in the `IN` list and the same
   * row is attached to both keys, matching the previous relation behaviour.
   * The raw FK columns are never leaked into the response.
   */
  private async attachAddresses<
    T extends { billingAddressId: string; shippingAddressId: string },
  >(order: T): Promise<
    Omit<T, 'billingAddressId' | 'shippingAddressId'> & {
      billingAddress: OrderAddress | null;
      shippingAddress: OrderAddress | null;
    }
  > {
    const { billingAddressId, shippingAddressId, ...rest } = order;
    const ids = [...new Set([billingAddressId, shippingAddressId].filter(Boolean))];

    const rows = ids.length
      ? await prisma.address.findMany({
          where: { id: { in: ids } },
          select: OrderService.ORDER_ADDRESS_FIELDS,
        })
      : [];

    const byId = new Map(rows.map((row) => [row.id, row]));
    const project = (id: string | null | undefined): OrderAddress | null => {
      const row = id ? byId.get(id) : undefined;
      if (!row) return null;
      return {
        fullName: row.fullName,
        addressLine: row.addressLine,
        city: row.city,
        state: row.state,
        postalCode: row.postalCode,
        country: row.country,
        phone: row.phone,
      };
    };

    return {
      ...rest,
      billingAddress: project(billingAddressId),
      shippingAddress: project(shippingAddressId),
    };
  }

  /**
   * Admin order-list filters: status, paymentStatus, search and pagination.
   * Search matches order number, customer name/email and tracking number in
   * the database — the full table is never loaded into memory.
   */
  async getAdminOrders(filters: {
    status?: string;
    paymentStatus?: string;
    search?: string;
  }, pagination: PaginationParams) {
    const page = Math.max(1, Number(pagination.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(pagination.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
    }

    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { trackingNumber: { contains: search, mode: 'insensitive' } },
        { user: { is: { email: { contains: search, mode: 'insensitive' } } } },
        {
          user: {
            is: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          ...ADMIN_ORDER_LIST_SELECT,
          // Relation key only. Stripped again in the loader so it can never
          // reach the response, exactly as the nested loader did.
          userId: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.order.count({ where }),
    ]);

    const hydrated = await this.loadAdminOrderListRelations(orders);

    return {
      orders: hydrated.map((order) => this.attachSellers(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Hydrates the nested relations of one admin order-list page.
   *
   * Prisma's nested relation loader walks the relation tree one level at a time
   * and waits for each level to finish before starting the next, which put five
   * sequential round-trips on the critical path of this endpoint. Two of those
   * levels are siblings that need nothing but the order ids already in hand:
   * `user` (keyed by the order's userId) and `items` (keyed by the order id).
   * They are fetched together here.
   *
   * `items -> product -> sellerProfile` is a genuine chain, because product ids
   * live on the item rows and seller ids on the product rows, so each of those
   * levels still waits for the level below it. No dependency is faked away.
   *
   * The result is byte-identical to what the nested loader produced: same
   * selected fields, same key order per level, same key presence, and the same
   * `null` for a relation whose row is absent. `sellers[]` is still built by
   * `attachSellers` afterwards, so that dedupe logic is untouched.
   */
  private async loadAdminOrderListRelations<T extends { id: string; userId: string }>(
    orders: T[],
  ): Promise<Array<Omit<T, 'userId'> & {
    user: { id: string; email: string; firstName: string; lastName: string } | null;
    items: Array<{
      id: string;
      quantity: number;
      product: { name: string; sellerProfile: { id: string; storeName: string } | null } | null;
    }>;
  }>> {
    if (orders.length === 0) {
      return [];
    }

    const orderIds = orders.map((order) => order.id);
    const userIds = [...new Set(orders.map((order) => order.userId))];

    // Sibling reads: both depend only on ids that are already known.
    const [users, items] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      }),
      prisma.orderItem.findMany({
        where: { orderId: { in: orderIds } },
        select: {
          id: true,
          quantity: true,
          orderId: true,
          productId: true,
        },
      }),
    ]);

    // Genuine dependency: product ids are only known once the item rows exist.
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = productIds.length
      ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          sellerId: true,
        },
      })
      : [];

    // Genuine dependency: seller ids are only known once the product rows exist.
    const sellerIds = [
      ...new Set(products.map((product) => product.sellerId).filter((id): id is string => id !== null)),
    ];
    const sellerProfiles = sellerIds.length
      ? await prisma.sellerProfile.findMany({
        where: { id: { in: sellerIds } },
        select: {
          id: true,
          storeName: true,
        },
      })
      : [];

    const userById = new Map(users.map((user) => [user.id, user]));
    const productById = new Map(products.map((product) => [product.id, product]));
    const sellerProfileById = new Map(sellerProfiles.map((profile) => [profile.id, profile]));

    // Bucket items per order while keeping the order the item query returned
    // them in, so each order's `items` array matches the previous payload.
    const itemsByOrderId = new Map<string, typeof items>();
    for (const item of items) {
      const bucket = itemsByOrderId.get(item.orderId);
      if (bucket) {
        bucket.push(item);
      } else {
        itemsByOrderId.set(item.orderId, [item]);
      }
    }

    return orders.map(({ userId, ...order }) => ({
      ...order,
      user: userById.get(userId) ?? null,
      items: (itemsByOrderId.get(order.id) ?? []).map((item) => {
        const product = productById.get(item.productId) ?? null;
        return {
          id: item.id,
          quantity: item.quantity,
          product: product === null
            ? null
            : {
              name: product.name,
              sellerProfile: (product.sellerId !== null ? sellerProfileById.get(product.sellerId) : undefined) ?? null,
            },
        };
      }),
    }));
  }

  /**
   * Admin detail: any customer's order, projected identically to the customer
   * detail payload (plus customer and payment-proof fields). No userId filter
   * — callers are ADMIN-only by route middleware.
   */
  async getAdminOrderById(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: this.orderDetailSelect(true),
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    return this.attachSellers(await this.attachAddresses(order));
  }

  /**
   * Projects the distinct APPROVED sellers whose products appear in an order,
   * without changing the payload shape for the existing admin UI.
   */
  private attachSellers<T extends { items?: Array<{ product?: { sellerProfile?: { id: string; storeName: string } | null } | null } | null> }>(
    order: T,
  ): T & { sellers: Array<{ id: string; storeName: string }> } {
    const sellers: Array<{ id: string; storeName: string }> = [];
    const seen = new Set<string>();
    for (const item of order.items ?? []) {
      const profile = item?.product?.sellerProfile;
      if (profile && profile.id && !seen.has(profile.id)) {
        seen.add(profile.id);
        sellers.push({ id: profile.id, storeName: profile.storeName });
      }
    }
    return { ...order, sellers };
  }

  private addressData(userId: string, address: {
    fullName: string; addressLine: string; city: string; state?: string;
    postalCode: string; country: string; countryCode: string; phone: string;
  }) {
    // Pick known database fields explicitly so form-only values can never reach Prisma.
    return {
      userId,
      fullName: address.fullName,
      addressLine: address.addressLine,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      countryCode: address.countryCode,
      phone: address.phone,
      isDefault: false,
    };
  }

  async createOrder(userId: string, data: {
    items: Array<{ productId: string; quantity: number }>;
    shippingMethod: string;
    shippingCarrier?: string;
    billingAddressId: string;
    shippingAddressId: string;
    notes?: string;
    paymentMethod?: string;
    paymentProofUrl?: string | null;
    paymentStatus?: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
    shippingAddress?: {
      fullName: string; addressLine: string; city: string; state?: string;
      postalCode: string; country: string; countryCode: string; phone: string;
    };
    billingAddress?: {
      fullName: string; addressLine: string; city: string; state?: string;
      postalCode: string; country: string; countryCode: string; phone: string;
    };
  }) {
    // Validate products and calculate totals
    let subtotal = 0;
    let serviceFees = 0;
    let domesticShipping = 0;

    const orderItems = [];
    const productIds = [...new Set(data.items.map((item) => item.productId))];

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        name: true,
        isAvailable: true,
        price: true,
        serviceFee: true,
        domesticShipping: true,
      },
    });

    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of data.items) {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new NotFoundError(`Product ${item.productId} not found`);
      }

      if (!product.isAvailable) {
        throw new ValidationError(`Product ${product.name} is not available`);
      }

      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new ValidationError(`Quantity for ${product.name} must be greater than zero`);
      }

      const itemSubtotal = product.price * item.quantity;
      // serviceFee is stored in USD (the ProductForm/import fallback computes 7% of price).
      const itemServiceFee = product.serviceFee * item.quantity;
      const itemDomesticShipping = (product.domesticShipping * 0.007) * item.quantity;

      subtotal += itemSubtotal;
      serviceFees += itemServiceFee;
      domesticShipping += itemDomesticShipping;

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        priceAtPurchase: product.price,
        serviceFeeAtPurchase: itemServiceFee,
        domesticShippingAtPurchase: itemDomesticShipping,
        productSnapshot: product,
      });
    }

    // Calculate shipping based on method
    const shippingCosts: Record<string, number> = {
      'dhl': 58,
      'ems': 42,
      'sal': 28,
      'sea': 18,
    };

    // Resolve address IDs if omitted
    let billingAddressId = data.billingAddressId;
    let shippingAddressId = data.shippingAddressId;

    if (data.shippingAddress) {
      const address = await prisma.address.create({ data: this.addressData(userId, data.shippingAddress) });
      shippingAddressId = address.id;
      if (!data.billingAddress) billingAddressId = address.id;
    }

    if (data.billingAddress) {
      const address = await prisma.address.create({ data: this.addressData(userId, data.billingAddress) });
      billingAddressId = address.id;
    }

    if (!billingAddressId || !shippingAddressId) {
      let userAddress = await prisma.address.findFirst({
        where: { userId },
      });
      if (!userAddress) {
        userAddress = await prisma.address.create({
          data: {
            userId,
            fullName: 'Customer Default',
            addressLine: 'Address required',
            city: 'Unknown',
            postalCode: '00000',
            country: 'Unknown',
            countryCode: 'XX',
            phone: '0000000000',
            isDefault: true,
          },
        });
      }
      if (!billingAddressId) billingAddressId = userAddress.id;
      if (!shippingAddressId) shippingAddressId = userAddress.id;
    }

    const internationalShipping = shippingCosts[data.shippingMethod.toLowerCase()] || 42;
    const insurance = Math.round(subtotal * 0.02);
    const total = subtotal + serviceFees + domesticShipping + internationalShipping + insurance;

    // Create order
    const order = await prisma.order.create({
      data: {
        userId,
        orderNumber: this.generateOrderNumber(),
        subtotal,
        serviceFees,
        domesticShipping,
        internationalShipping,
        insurance,
        total,
        shippingMethod: data.shippingMethod,
        shippingCarrier: data.shippingCarrier,
        billingAddressId,
        shippingAddressId,
        notes: data.notes,
        paymentMethod: data.paymentMethod,
        paymentProofUrl: data.paymentProofUrl,
        paymentStatus: data.paymentStatus,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        billingAddress: true,
        shippingAddress: true,
      },
    });

    // Clear cart after order creation
    const cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });
    }

    return order;
  }

  async getOrders(userId: string, filters: OrderFilters, pagination: PaginationParams) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
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
                    select: {
                      url: true,
                    },
                  },
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrderStats(userId: string) {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const [
      totalOrders,
      inWarehouseOrders,
      inTransitOrders,
      totalSpent,
    ] = await Promise.all([
      prisma.order.count({ where: { userId } }),
      prisma.order.count({ where: { userId, status: 'IN_WAREHOUSE' } }),
      prisma.order.count({ where: { userId, status: 'IN_TRANSIT' } }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          userId,
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
      }),
    ]);

    const totalSpentAmount = totalSpent?._sum.total ?? 0;
    const estimatedSavings = Math.round(totalSpentAmount * 0.15);

    return {
      totalOrders,
      inWarehouseOrders,
      inTransitOrders,
      totalSpent: totalSpentAmount,
      estimatedSavings,
    };
  }

  async getUserShipments(userId: string) {
    const orders = await prisma.order.findMany({
      where: { userId },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);

    if (orderIds.length === 0) {
      return [];
    }

    const shipments = await prisma.shipment.findMany({
      where: { orderId: { in: orderIds } },
      select: {
        id: true,
        orderId: true,
        trackingNumber: true,
        carrier: true,
        status: true,
        shippingCost: true,
        estimatedDelivery: true,
        shippedAt: true,
        deliveredAt: true,
        createdAt: true,
        events: true,
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return shipments.map((s) => ({
      ...s,
      events: s.events ? JSON.parse(JSON.stringify(s.events)) : [],
    }));
  }

  async getOrderById(userId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      select: this.orderDetailSelect(false),
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    return this.attachAddresses(order);
  }

  async updateOrderStatus(orderId: string, status: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    return await prisma.order.update({
      where: { id: orderId },
      data: { status: status as any },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        billingAddress: true,
        shippingAddress: true,
      },
    });
  }

  async cancelOrder(userId: string, orderId: string) {
    const order = await this.getOrderById(userId, orderId);

    if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
      throw new ValidationError('Order cannot be cancelled at this stage');
    }

    return await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }
}

export default new OrderService();

import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errors';
import { OrderFilters, PaginationParams } from '../types';
import { Prisma } from '@prisma/client';

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
      billingAddress: {
        select: {
          fullName: true,
          addressLine: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          phone: true,
        },
      },
      shippingAddress: {
        select: {
          fullName: true,
          addressLine: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          phone: true,
        },
      },
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
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          items: {
            select: {
              id: true,
              quantity: true,
              product: {
                select: {
                  name: true,
                  sellerProfile: {
                    select: {
                      id: true,
                      storeName: true,
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
      orders: orders.map((order) => this.attachSellers(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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

    return this.attachSellers(order);
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

    return order;
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

    if (order.status !== 'PENDING' && order.status !== 'PAYMENT_RECEIVED') {
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

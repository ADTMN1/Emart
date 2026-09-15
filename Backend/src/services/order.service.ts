import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errors';
import { OrderFilters, PaginationParams } from '../types';

export class OrderService {
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `EM-${timestamp}-${random}`.toUpperCase();
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
        estimatedPriceUsd: true,
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

      const itemSubtotal = product.estimatedPriceUsd * item.quantity;
      const itemServiceFee = (product.serviceFee * 0.007) * item.quantity;
      const itemDomesticShipping = (product.domesticShipping * 0.007) * item.quantity;

      subtotal += itemSubtotal;
      serviceFees += itemServiceFee;
      domesticShipping += itemDomesticShipping;

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        priceAtPurchase: product.estimatedPriceUsd,
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
      select: {
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
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            quantity: true,
            priceAtPurchase: true,
            serviceFeeAtPurchase: true,
            domesticShippingAtPurchase: true,
            product: {
              select: {
                id: true,
                name: true,
                condition: true,
                source: true,
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
            shippedAt: true,
            estimatedDelivery: true,
            deliveredAt: true,
            events: true,
          },
        },
      },
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

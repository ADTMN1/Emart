import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errors';

export class CartService {
  async getCart(userId: string) {
    let cart = await prisma.cart.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            quantity: true,
            createdAt: true,
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                estimatedPriceUsd: true,
                condition: true,
                seller: true,
                sellerType: true,
                source: true,
                domesticShipping: true,
                internationalShippingUsd: true,
                serviceFee: true,
                isAvailable: true,
                stock: true,
                categoryId: true,
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
                    id: true,
                    url: true,
                    isPrimary: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Create cart if it doesn't exist
    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        select: {
          id: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          items: {
            select: {
              id: true,
              quantity: true,
              createdAt: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  estimatedPriceUsd: true,
                  condition: true,
                  seller: true,
                  sellerType: true,
                  source: true,
                  domesticShipping: true,
                  internationalShippingUsd: true,
                  serviceFee: true,
                  isAvailable: true,
                  stock: true,
                  categoryId: true,
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
                      id: true,
                      url: true,
                      isPrimary: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    }

    return cart;
  }

  async addToCart(userId: string, productId: string, quantity: number) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        isAvailable: true,
        stock: true,
        name: true,
        price: true,
        estimatedPriceUsd: true,
        condition: true,
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    if (!product.isAvailable) {
      throw new ValidationError('Product is not available');
    }

    // Get or create cart efficiently
    const cart = await prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true },
    });
    const cartItem = await prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
      update: {
        quantity: { increment: quantity },
      },
      create: {
        cartId: cart.id,
        productId,
        quantity,
      },
      select: {
        id: true,
        cartId: true,
        productId: true,
        quantity: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...cartItem,
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        estimatedPriceUsd: product.estimatedPriceUsd,
        condition: product.condition,
        productImages: [],
      },
    };
  }

  async updateCartItem(userId: string, itemId: string, quantity: number) {
    // Verify cart ownership and item existence in one query
    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: {
          userId,
        },
      },
      select: { id: true },
    });

    if (!item) {
      throw new NotFoundError('Cart item not found');
    }

    return await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
      select: {
        id: true,
        quantity: true,
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            estimatedPriceUsd: true,
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
    });
  }

  async removeFromCart(userId: string, itemId: string) {
    // Verify cart ownership and delete in one transaction
    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: {
          userId,
        },
      },
      select: { id: true },
    });

    if (!item) {
      throw new NotFoundError('Cart item not found');
    }

    await prisma.cartItem.delete({
      where: { id: itemId },
    });

    return { message: 'Item removed from cart' };
  }

  async clearCart(userId: string) {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });
    }

    return { message: 'Cart cleared' };
  }
}

export default new CartService();

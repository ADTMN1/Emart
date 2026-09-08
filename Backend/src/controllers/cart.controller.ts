import { Response, NextFunction } from 'express';
import cartService from '../services/cart.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';

export class CartController {
  async getCart(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const cart = await cartService.getCart(req.user!.id);
      return sendSuccess(res, cart, 'Cart retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async addToCart(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { productId, quantity } = req.body;
      const item = await cartService.addToCart(req.user!.id, productId, quantity);
      return sendSuccess(res, item, 'Item added to cart', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateCartItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { quantity } = req.body;
      const item = await cartService.updateCartItem(req.user!.id, req.params.itemId, quantity);
      return sendSuccess(res, item, 'Cart item updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeFromCart(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await cartService.removeFromCart(req.user!.id, req.params.itemId);
      return sendSuccess(res, result, 'Item removed from cart');
    } catch (error) {
      next(error);
    }
  }

  async clearCart(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await cartService.clearCart(req.user!.id);
      return sendSuccess(res, result, 'Cart cleared successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new CartController();

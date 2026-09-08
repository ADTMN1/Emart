import { Response, NextFunction } from 'express';
import orderService from '../services/order.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';

export class OrderController {
  async createOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const order = await orderService.createOrder(req.user!.id, req.body);
      return sendSuccess(res, order, 'Order created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const filters = {
        status: req.query.status as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };

      const result = await orderService.getOrders(req.user!.id, filters, pagination);
      return sendSuccess(res, result, 'Orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getOrderById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const order = await orderService.getOrderById(req.user!.id, req.params.id);
      return sendSuccess(res, order, 'Order retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateOrderStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const order = await orderService.updateOrderStatus(req.params.id, status);
      return sendSuccess(res, order, 'Order status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async cancelOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const order = await orderService.cancelOrder(req.user!.id, req.params.id);
      return sendSuccess(res, order, 'Order cancelled successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new OrderController();

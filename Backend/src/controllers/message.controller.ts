import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import messageService from '../services/message.service';
import { sendSuccess } from '../utils/response';

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
}

export default new MessageController();
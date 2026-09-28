import { Response, NextFunction } from 'express';
import supportMessageService from '../services/supportMessage.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';

export class SupportMessageController {
  async listConversations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const filters = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };
      const result = await supportMessageService.listConversations(req.user!.id, filters);
      return sendSuccess(res, result, 'Support conversations retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getOrCreateConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { subject } = req.body;
      const conversation = await supportMessageService.getOrCreateConversation(req.user!.id, subject);
      return sendSuccess(res, conversation, 'Conversation ready', 201);
    } catch (error) {
      next(error);
    }
  }

  async getConversationMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.params;
      const result = await supportMessageService.getConversationMessages(req.user!.id, conversationId);
      return sendSuccess(res, result, 'Messages retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.params;
      const { body } = req.body;
      const message = await supportMessageService.sendMessage(req.user!.id, conversationId, body);
      return sendSuccess(res, message, 'Message sent successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async markConversationRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.params;
      const result = await supportMessageService.markConversationRead(req.user!.id, conversationId);
      return sendSuccess(res, result, 'Conversation marked as read');
    } catch (error) {
      next(error);
    }
  }

  // Admin routes
  async getAdminConversations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const filters = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        status: req.query.status as string,
        search: req.query.search as string,
      };
      const result = await supportMessageService.getAdminConversations(req.user!.id, filters);
      return sendSuccess(res, result, 'Admin support conversations retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAdminConversationMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.params;
      const result = await supportMessageService.getAdminConversationMessages(req.user!.id, conversationId);
      return sendSuccess(res, result, 'Messages retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async sendAdminReply(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.params;
      const { body } = req.body;
      const message = await supportMessageService.sendAdminReply(req.user!.id, conversationId, body);
      return sendSuccess(res, message, 'Reply sent successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async markAdminConversationRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.params;
      const result = await supportMessageService.markAdminConversationRead(req.user!.id, conversationId);
      return sendSuccess(res, result, 'Conversation marked as read');
    } catch (error) {
      next(error);
    }
  }

  async updateConversationStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.params;
      const { status } = req.body;
      if (!['OPEN', 'CLOSED', 'RESOLVED'].includes(status)) {
        return sendSuccess(res, null, 'Invalid status', 400);
      }
      const conversation = await supportMessageService.updateConversationStatus(req.user!.id, conversationId, status);
      return sendSuccess(res, conversation, 'Conversation status updated');
    } catch (error) {
      next(error);
    }
  }
}

export default new SupportMessageController();
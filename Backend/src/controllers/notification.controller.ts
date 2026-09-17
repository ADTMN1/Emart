import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import notificationService from '../services/notification.service';
import { sendSuccess } from '../utils/response';

/**
 * In-app notifications (Phase 7). Any authenticated user may list their own
 * notifications and manage their own read state — recipients are always
 * derived from req.user.id.
 */
class NotificationController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await notificationService.listForUser(req.user!.id, {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });
      return sendSuccess(res, data, 'Notifications retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const unreadCount = await notificationService.unreadCount(req.user!.id);
      return sendSuccess(res, { unreadCount }, 'Unread count retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async markRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const updated = await notificationService.markRead(req.user!.id, req.params.id);
      return sendSuccess(res, { updated }, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  }

  async markAllRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const updated = await notificationService.markAllRead(req.user!.id);
      return sendSuccess(res, { updated }, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  }
}

export default new NotificationController();
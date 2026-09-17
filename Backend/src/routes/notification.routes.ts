import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import notificationController from '../controllers/notification.controller';

const router = Router();

// Any authenticated user manages their own notifications. Recipient identity
// is always taken from the authenticated user.
router.use(authenticate);

router.get('/', notificationController.list.bind(notificationController));
router.get('/unread-count', notificationController.getUnreadCount.bind(notificationController));
router.patch('/:id/read', notificationController.markRead.bind(notificationController));
router.patch('/read-all', notificationController.markAllRead.bind(notificationController));

export default router;
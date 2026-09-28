import { Router } from 'express';
import supportMessageController from '../controllers/supportMessage.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { sendSupportMessageValidation, createSupportConversationValidation, updateSupportConversationStatusValidation } from '../middleware/validations/supportMessage.validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Customer routes
router.get('/conversations', supportMessageController.listConversations);
router.post('/conversations', createSupportConversationValidation, validate, supportMessageController.getOrCreateConversation);
router.get('/conversations/:conversationId/messages', supportMessageController.getConversationMessages);
router.post('/conversations/:conversationId/messages', sendSupportMessageValidation, validate, supportMessageController.sendMessage);
router.patch('/conversations/:conversationId/read', supportMessageController.markConversationRead);

// Admin routes
router.get('/admin/conversations', authorize('ADMIN'), supportMessageController.getAdminConversations);
router.get('/admin/conversations/:conversationId/messages', authorize('ADMIN'), supportMessageController.getAdminConversationMessages);
router.post('/admin/conversations/:conversationId/messages', authorize('ADMIN'), sendSupportMessageValidation, validate, supportMessageController.sendAdminReply);
router.patch('/admin/conversations/:conversationId/read', authorize('ADMIN'), supportMessageController.markAdminConversationRead);
router.patch('/admin/conversations/:conversationId/status', authorize('ADMIN'), updateSupportConversationStatusValidation, validate, supportMessageController.updateConversationStatus);

export default router;
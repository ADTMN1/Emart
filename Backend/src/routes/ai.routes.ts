import { Router } from 'express';
import aiController from '../controllers/ai.controller';
import { chatValidation } from '../middleware/validations/ai.validation';
import { validate } from '../middleware/validator';

const router = Router();

/**
 * @route   POST /api/v1/ai/chat
 * @desc    Send a message to the AI assistant
 * @access  Public
 */
router.post('/chat', chatValidation, validate, aiController.chat);

export default router;

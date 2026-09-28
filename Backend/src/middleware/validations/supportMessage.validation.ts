import { body } from 'express-validator';

const SUPPORT_MESSAGE_MAX_LENGTH = 5000;

export const sendSupportMessageValidation = [
  body('body')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Message body is required')
    .isLength({ max: SUPPORT_MESSAGE_MAX_LENGTH })
    .withMessage(`Message must be at most ${SUPPORT_MESSAGE_MAX_LENGTH} characters`),
];

export const createSupportConversationValidation = [
  body('subject')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subject must be at most 200 characters'),
];

export const updateSupportConversationStatusValidation = [
  body('status')
    .isIn(['OPEN', 'CLOSED', 'RESOLVED'])
    .withMessage('Status must be OPEN, CLOSED, or RESOLVED'),
];
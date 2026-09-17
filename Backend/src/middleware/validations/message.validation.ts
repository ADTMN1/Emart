import { body } from 'express-validator';
import { MESSAGE_MAX_LENGTH } from '../../services/message.service';

/**
 * Messaging payloads (Phase 7). Body is trimmed, must be non-empty, and is
 * capped for safety — user input is stored as plain text and rendered as text
 * by the frontend, so no HTML/script reaches the DOM as markup.
 */
export const sendMessageValidation = [
  body('body')
    .exists({ checkFalsy: true })
    .withMessage('Message is required.')
    .bail()
    .isString()
    .withMessage('Message must be a string.')
    .bail()
    .customSanitizer((value: string) => value.trim())
    .isLength({ min: 1, max: MESSAGE_MAX_LENGTH })
    .withMessage(`Message must be between 1 and ${MESSAGE_MAX_LENGTH} characters.`),
];

export const createConversationValidation = [
  body('sellerId')
    .exists({ checkFalsy: true })
    .withMessage('Seller ID is required.')
    .bail()
    .isString()
    .withMessage('Seller ID must be a string.'),
];
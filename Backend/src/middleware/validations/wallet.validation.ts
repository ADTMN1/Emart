import { body, query } from 'express-validator';

export const depositValidation = [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be at least $1.00'),
  body('paymentMethod')
    .trim()
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['credit_card', 'paypal', 'bank_transfer', 'stripe', 'other'])
    .withMessage('Invalid payment method'),
  body('reference')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Reference must be less than 100 characters'),
  body('paymentDetails')
    .optional(),
];

export const withdrawValidation = [
  body('amount')
    .isFloat({ min: 10 })
    .withMessage('Minimum withdrawal amount is $10.00'),
  body('withdrawMethod')
    .trim()
    .notEmpty()
    .withMessage('Withdrawal method is required')
    .isIn(['bank_transfer', 'paypal', 'other'])
    .withMessage('Invalid withdrawal method'),
  body('reference')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Reference must be less than 100 characters'),
];

export const transactionQueryValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a positive number'),
  query('type')
    .optional()
    .isIn(['DEPOSIT', 'WITHDRAWAL', 'PAYMENT', 'REFUND', 'BONUS', 'ADJUSTMENT'])
    .withMessage('Invalid transaction type'),
  query('status')
    .optional()
    .isIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'])
    .withMessage('Invalid transaction status'),
];

import { body, param } from 'express-validator';
import { validate } from '../validator';
import { PaymentStatus } from '@prisma/client';

const orderIdParam = param('orderId')
  .isUUID()
  .withMessage('Invalid order ID.');

/** GET /admin/orders/:orderId/payment */
export const getPaymentValidation = [orderIdParam, validate];

/**
 * POST /admin/orders/:orderId/payment/verify — status transition is
 * re-validated server-side by the service; the body only carries an
 * optional admin note.
 */
export const verifyPaymentValidation = [
  orderIdParam,
  body('note')
    .optional({ nullable: true })
    .isString()
    .withMessage('Note must be a string.')
    .isLength({ max: 1000 })
    .withMessage('Note must be at most 1000 characters.'),
  validate,
];

/** POST /admin/orders/:orderId/payment/reject */
export const rejectPaymentValidation = [
  orderIdParam,
  body('reason')
    .exists({ checkFalsy: true })
    .withMessage('A rejection reason is required.')
    .isString()
    .withMessage('Reason must be a string.')
    .trim()
    .isLength({ min: 3, max: 1000 })
    .withMessage('Rejection reason must be between 3 and 1000 characters.'),
  validate,
];

/** PATCH /admin/orders/:orderId/payment */
export const updatePaymentValidation = [
  orderIdParam,
  body('paymentStatus')
    .optional()
    .isIn(Object.values(PaymentStatus))
    .withMessage(`Invalid payment status. Must be one of: ${Object.values(PaymentStatus).join(', ')}.`),
  body('paymentNote')
    .optional({ nullable: true })
    .isString()
    .withMessage('Payment note must be a string.')
    .isLength({ max: 1000 })
    .withMessage('Payment note must be at most 1000 characters.'),
  body()
    .custom((value, { req }) => {
      const hasPaymentStatus = req.body?.paymentStatus !== undefined;
      const hasPaymentNote = req.body?.paymentNote !== undefined;
      if (!hasPaymentStatus && !hasPaymentNote) {
        throw new Error('Provide at least one of paymentStatus or paymentNote.');
      }
      return true;
    }),
  validate,
];

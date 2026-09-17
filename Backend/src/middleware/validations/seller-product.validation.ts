import { body, param, query } from 'express-validator';
import { buildProductFieldRules } from './product-field-rules';

/**
 * Seller product write validation (Phase 6).
 *
 * Reuses the exact shared product field rules (same bounds, enums, messages
 * as admin product writes and the bulk import validator) so there is only one
 * SKU/pricing/condition rule set in the system.
 */

/**
 * Client-supplied sellerId is always rejected — ownership comes from the
 * authenticated user's seller profile, never the payload.
 */
const rejectSellerId = body('sellerId')
  .not()
  .exists()
  .withMessage('sellerId cannot be set — product ownership is derived from your seller account.');

export const createSellerProductValidation = [
  rejectSellerId,
  ...buildProductFieldRules({ required: true }),
];

export const updateSellerProductValidation = [
  rejectSellerId,
  ...buildProductFieldRules({ required: false }),
];

export const sellerProductIdParam = [
  param('id').isUUID().withMessage('Invalid product id'),
];

export const listSellerProductsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string'),
  query('status')
    .optional()
    .isIn(['all', 'available', 'unavailable'])
    .withMessage('Status must be one of: all, available, unavailable'),
];

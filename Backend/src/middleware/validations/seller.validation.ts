import { body, param, query } from 'express-validator';
import { validate } from '../validator';

/**
 * Seller foundation validation (Phase 5).
 *
 * Client-supplied userId / sellerId / status / reviewedBy / reviewedAt are
 * never accepted anywhere: the customer payload whitelist is exactly
 * { storeName, storeDescription } and protected values are derived
 * server-side from the authenticated user / admin session.
 */

export const SELLER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;

/** Collapses internal whitespace runs and trims both ends. */
const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const storeNameRule = body('storeName')
  .exists({ checkFalsy: true })
  .withMessage('Store name is required.')
  .bail()
  .isString()
  .withMessage('Store name must be a string.')
  .bail()
  .customSanitizer(normalizeWhitespace)
  .isLength({ min: 3, max: 80 })
  .withMessage('Store name must be between 3 and 80 characters.');

const storeDescriptionRule = body('storeDescription')
  .exists({ checkFalsy: true })
  .withMessage('Store description is required.')
  .bail()
  .isString()
  .withMessage('Store description must be a string.')
  .bail()
  .customSanitizer(normalizeWhitespace)
  .isLength({ min: 10, max: 2000 })
  .withMessage('Store description must be between 10 and 2000 characters.');

/** POST /api/v1/seller/application */
export const createSellerApplicationValidation = [
  storeNameRule,
  storeDescriptionRule,
  validate,
];

/** POST /api/v1/seller/application (resubmission reuses the same shape). */
export const resubmitSellerApplicationValidation = [
  storeNameRule,
  storeDescriptionRule,
  validate,
];

/** PUT /api/v1/seller/profile — same identity rules as applications. */
export const updateSellerProfileValidation = [
  storeNameRule,
  storeDescriptionRule,
  validate,
];

const applicationIdParam = param('id')
  .isUUID()
  .withMessage('Invalid application ID.');

const sellerIdParam = param('sellerId')
  .isUUID()
  .withMessage('Invalid seller ID.');

/** GET /api/v1/admin/sellers/applications */
export const listSellerApplicationsValidation = [
  query('status')
    .optional()
    .isIn(SELLER_STATUSES as unknown as string[])
    .withMessage(`Invalid status filter. Must be one of: ${SELLER_STATUSES.join(', ')}.`),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer.')
    .bail()
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be an integer between 1 and 100.')
    .bail()
    .toInt(),
  validate,
];

/** GET /api/v1/admin/sellers/applications/:id */
export const getSellerApplicationValidation = [applicationIdParam, validate];

/** POST /api/v1/admin/sellers/applications/:id/reject */
export const rejectSellerApplicationValidation = [
  applicationIdParam,
  body('reason')
    .exists({ checkFalsy: true })
    .withMessage('A rejection reason is required.')
    .bail()
    .isString()
    .withMessage('Reason must be a string.')
    .bail()
    .customSanitizer(normalizeWhitespace)
    .isLength({ min: 3, max: 1000 })
    .withMessage('Rejection reason must be between 3 and 1000 characters.'),
  validate,
];

/** POST /api/v1/admin/sellers/applications/:id/approve */
export const approveSellerApplicationValidation = [applicationIdParam, validate];

/** POST /api/v1/admin/sellers/:sellerId/suspend and /activate */
export const sellerStatusActionValidation = [sellerIdParam, validate];

import { body, param, query } from 'express-validator';
import { validate } from '../validator';

/**
 * Seller foundation validation (Phase 5).
 *
 * Client-supplied userId / sellerId / status / reviewedBy / reviewedAt are
 * never accepted anywhere: the customer application payload whitelist is
 * exactly { storeName, storeDescription?, email, emergencyContact?, address }
 * (the identity document is validated by multer + the storage service) and
 * protected values are derived server-side from the authenticated user /
 * admin session.
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

/** Store description is optional on the "Become a Seller" application. */
const storeDescriptionOptionalRule = body('storeDescription')
  .optional({ checkFalsy: true })
  .isString()
  .withMessage('Store description must be a string.')
  .bail()
  .customSanitizer(normalizeWhitespace)
  .isLength({ min: 10, max: 2000 })
  .withMessage('Store description must be between 10 and 2000 characters.');

const emailRule = body('email')
  .exists({ checkFalsy: true })
  .withMessage('Email address is required.')
  .bail()
  .isString()
  .withMessage('Email address must be a string.')
  .bail()
  .trim()
  .isEmail()
  .withMessage('Please provide a valid email address.')
  .bail()
  .isLength({ max: 254 })
  .withMessage('Email address is too long.');

const addressRule = body('address')
  .exists({ checkFalsy: true })
  .withMessage('Address is required.')
  .bail()
  .isString()
  .withMessage('Address must be a string.')
  .bail()
  .customSanitizer(normalizeWhitespace)
  .isLength({ min: 5, max: 300 })
  .withMessage('Address must be between 5 and 300 characters.');

const emergencyContactRule = body('emergencyContact')
  .optional({ checkFalsy: true })
  .isString()
  .withMessage('Emergency contact must be a string.')
  .bail()
  .customSanitizer(normalizeWhitespace)
  .isLength({ min: 3, max: 120 })
  .withMessage('Emergency contact must be between 3 and 120 characters.');

/** POST /api/v1/seller/application */
export const createSellerApplicationValidation = [
  storeNameRule,
  storeDescriptionOptionalRule,
  emailRule,
  emergencyContactRule,
  addressRule,
  validate,
];

/** POST /api/v1/seller/application (resubmission reuses the same shape). */
export const resubmitSellerApplicationValidation = [
  storeNameRule,
  storeDescriptionOptionalRule,
  emailRule,
  emergencyContactRule,
  addressRule,
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

const orderIdParam = param('id')
  .isUUID()
  .withMessage('Invalid order ID.');

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

export const sellerOrderIdValidation = [orderIdParam, validate];

const notificationIdParam = param('id')
  .isUUID()
  .withMessage('Invalid notification ID.');

export const confirmOrderRequestValidation = [notificationIdParam, validate];

/** POST /api/v1/seller/order-requests/:id/decline */
export const declineOrderRequestValidation = [notificationIdParam, validate];

const paymentMethodIdParam = param('id')
  .isUUID()
  .withMessage('Invalid payment method ID.');

export const addPaymentMethodValidation = [
  body('type')
    .exists({ checkFalsy: true })
    .withMessage('Payment method type is required.')
    .bail()
    .isIn(['CARD', 'BANK_TRANSFER', 'CRYPTO', 'PAYPAL', 'WISE', 'PAYONEER'])
    .withMessage('Invalid payment method type.'),
  body('details')
    .exists({ checkFalsy: true })
    .withMessage('Payment method details are required.')
    .bail()
    .isObject()
    .withMessage('Details must be an object.'),
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean.'),
  validate,
];

export const updatePaymentMethodValidation = [
  paymentMethodIdParam,
  body('details')
    .optional()
    .isObject()
    .withMessage('Details must be an object.'),
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean.'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean.'),
  validate,
];

export const paymentMethodIdValidation = [paymentMethodIdParam, validate];

/** ISO calendar date (YYYY-MM-DD) or a full ISO timestamp. */
const isDateInput = (value: string) => !Number.isNaN(Date.parse(value));

const salesDateQuery = (field: 'startDate' | 'endDate') =>
  query(field)
    .optional()
    .isString()
    .withMessage(`${field} must be a date.`)
    .bail()
    .custom(isDateInput)
    .withMessage(`${field} must be a valid ISO date (YYYY-MM-DD).`);

/**
 * GET /api/v1/seller/sales — optional inclusive window. The window length is
 * capped server-side; ordering/limit stay fixed by the report contract.
 */
export const sellerSalesReportValidation = [salesDateQuery('startDate'), salesDateQuery('endDate'), validate];

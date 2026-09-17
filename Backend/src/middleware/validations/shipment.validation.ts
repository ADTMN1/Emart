import { body, param } from 'express-validator';
import { ShipmentStatus } from '@prisma/client';

/** The full set of ShipmentStatus values from the Prisma schema. */
export const SHIPMENT_STATUSES = Object.values(ShipmentStatus) as ShipmentStatus[];

export const orderIdParamValidation = [
  param('orderId')
    .isUUID()
    .withMessage('Invalid order ID'),
];

export const createShipmentValidation = [
  ...orderIdParamValidation,
  body('carrier')
    .trim()
    .notEmpty()
    .withMessage('Carrier is required')
    .isLength({ min: 2, max: 80 })
    .withMessage('Carrier must be between 2 and 80 characters'),
  body('trackingNumber')
    .trim()
    .notEmpty()
    .withMessage('Tracking number is required')
    .isLength({ min: 4, max: 100 })
    .withMessage('Tracking number must be between 4 and 100 characters'),
  body('shippingCost')
    .exists({ checkFalsy: false })
    .withMessage('Shipping cost is required')
    .isFloat({ min: 0 })
    .withMessage('Shipping cost must be a non-negative number')
    .toFloat(),
  body('estimatedDelivery')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Estimated delivery must be a valid date')
    .toDate(),
  body('status')
    .optional()
    .isIn(SHIPMENT_STATUSES)
    .withMessage('Invalid shipment status'),
];

export const updateShipmentValidation = [
  ...orderIdParamValidation,
  body('carrier')
    .optional()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Carrier must be between 2 and 80 characters'),
  body('trackingNumber')
    .optional()
    .trim()
    .isLength({ min: 4, max: 100 })
    .withMessage('Tracking number must be between 4 and 100 characters'),
  body('shippingCost')
    .optional({ values: 'null' })
    .isFloat({ min: 0 })
    .withMessage('Shipping cost must be a non-negative number')
    .toFloat(),
  body('estimatedDelivery')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Estimated delivery must be a valid date')
    .toDate(),
  body('status')
    .optional()
    .isIn(SHIPMENT_STATUSES)
    .withMessage('Invalid shipment status'),
];

export const changeShipmentStatusValidation = [
  ...orderIdParamValidation,
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .isIn(SHIPMENT_STATUSES)
    .withMessage('Invalid shipment status'),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Message must be less than 500 characters'),
  body('location')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 120 })
    .withMessage('Location must be less than 120 characters'),
];

export const addTrackingEventValidation = [
  ...orderIdParamValidation,
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Event message is required')
    .isLength({ min: 1, max: 500 })
    .withMessage('Event message must be between 1 and 500 characters'),
  body('status')
    .optional()
    .isIn(SHIPMENT_STATUSES)
    .withMessage('Invalid event status'),
  body('location')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 120 })
    .withMessage('Location must be less than 120 characters'),
  body('occurredAt')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('occurredAt must be a valid date')
    .toDate(),
];

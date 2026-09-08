import { body } from 'express-validator';

export const createOrderValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),
  body('items.*.productId')
    .notEmpty()
    .withMessage('Product ID is required for each item'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('shippingMethod')
    .notEmpty()
    .withMessage('Shipping method is required'),
  body('billingAddressId')
    .notEmpty()
    .withMessage('Billing address is required'),
  body('shippingAddressId')
    .notEmpty()
    .withMessage('Shipping address is required'),
];

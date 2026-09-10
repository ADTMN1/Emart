import { body, query } from 'express-validator';

export const createProductValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ min: 3 })
    .withMessage('Product name must be at least 3 characters long'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Product description is required'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number')
    .toFloat(),
  body('estimatedPriceUsd')
    .isFloat({ min: 0 })
    .withMessage('Estimated USD price must be a positive number')
    .toFloat(),
  body('condition')
    .isIn(['NEW', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE'])
    .withMessage('Invalid product condition'),
  body('seller')
    .trim()
    .notEmpty()
    .withMessage('Seller name is required'),
  body('sellerType')
    .isIn(['SHOP', 'INDIVIDUAL'])
    .withMessage('Invalid seller type'),
  body('source')
    .trim()
    .notEmpty()
    .withMessage('Source marketplace is required'),
  body('domesticShipping')
    .isFloat({ min: 0 })
    .withMessage('Domestic shipping must be a positive number')
    .toFloat(),
  body('internationalShippingUsd')
    .isFloat({ min: 0 })
    .withMessage('International shipping must be a positive number')
    .toFloat(),
  body('serviceFee')
    .isFloat({ min: 0 })
    .withMessage('Service fee must be a positive number')
    .toFloat(),
  body('categoryId')
    .notEmpty()
    .withMessage('Category ID is required'),
  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer')
    .toInt(),
  body('tags')
    .isArray()
    .withMessage('Tags must be an array'),
  body('isAvailable')
    .isBoolean()
    .withMessage('isAvailable must be a boolean')
    .toBoolean(),
  body('isNew')
    .isBoolean()
    .withMessage('isNew must be a boolean')
    .toBoolean(),
  body('isBestSeller')
    .isBoolean()
    .withMessage('isBestSeller must be a boolean')
    .toBoolean(),
];

export const searchProductsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Min price must be a positive number'),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Max price must be a positive number'),
];

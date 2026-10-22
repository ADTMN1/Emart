import { query, param, body } from 'express-validator';

export const searchCJProductsValidation = [
  query('keyword')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Keyword must be 200 characters or less'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Page size must be between 1 and 100')
    .toInt(),
  query('categoryId')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Category ID must not be empty')
    .isLength({ max: 100 })
    .withMessage('Category ID must be 100 characters or less'),
  query('warehouse')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Warehouse must be 100 characters or less'),
];

export const getCJProductDetailValidation = [
  param('productId')
    .trim()
    .notEmpty()
    .withMessage('CJ product ID is required'),
];

export const importCJProductValidation = [
  param('productId')
    .trim()
    .notEmpty()
    .withMessage('CJ product ID is required'),
  body('categoryId')
    .optional()
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  body('priceMarkupPercent')
    .optional()
    .isInt({ min: 0, max: 500 })
    .withMessage('Price markup must be between 0 and 500 percent')
    .toInt(),
];

export const importCJCategoryValidation = [
  param('categoryId')
    .trim()
    .notEmpty()
    .withMessage('CJ category ID is required'),
  body('emartCategoryId')
    .trim()
    .notEmpty()
    .withMessage('Marcari23 category ID is required')
    .isUUID()
    .withMessage('Marcari23 category ID must be a valid UUID'),
  body('priceMarkupPercent')
    .optional()
    .isInt({ min: 0, max: 500 })
    .withMessage('Price markup must be between 0 and 500 percent')
    .toInt(),
];
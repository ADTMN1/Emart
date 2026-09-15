import { query } from 'express-validator';
import { buildProductFieldRules } from './product-field-rules';

/**
 * Product write validation.
 *
 * The field rules live in product-field-rules.ts (shared with the bulk
 * import validator). `required: true` reproduces the original
 * createProductValidation exactly; `required: false` the original
 * updateProductValidation.
 */
export const createProductValidation = buildProductFieldRules({ required: true });

export const updateProductValidation = buildProductFieldRules({ required: false });

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
    .withMessage('Max price must be positive number'),
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'all'])
    .withMessage('Status must be one of: active, inactive, all'),
];

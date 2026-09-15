import { body, ValidationChain } from 'express-validator';

/**
 * Shared product field rules.
 *
 * Single source of truth for product field validation, used by:
 *  - product.validation.ts (create / update express-validator chains —
 *    reproduces the original messages and semantics exactly)
 *  - the bulk import row validator (services/import/product-row.validator.ts,
 *    which mirrors these bounds/enums for spreadsheet cells)
 *
 * Change bounds/enums/messages here only — never inline duplicates elsewhere.
 */

export const PRODUCT_CONDITIONS = ['NEW', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE'] as const;
export const SELLER_TYPES = ['SHOP', 'INDIVIDUAL'] as const;

export const SKU_MIN_LENGTH = 3;
export const SKU_MAX_LENGTH = 64;
export const NAME_MIN_LENGTH = 3;

/** Fallback rates mirroring the frontend ProductForm auto-calculations. */
export const SERVICE_FEE_RATE = 0.07; // 7% of price (JPY)
export const JPY_TO_USD_RATE = 0.007;

/** Presence handling: create chains enforce presence via their validators
 * (exactly as the originals did); update chains make every field optional. */
function presence(chain: ValidationChain, required: boolean): ValidationChain {
  return required ? chain : chain.optional();
}

/**
 * Build the express-validator body chains for product writes.
 *
 * `required: true`  → create semantics, identical to the original
 *                     createProductValidation (same messages).
 * `required: false` → update semantics, identical to the original
 *                     updateProductValidation (all fields optional).
 */
export function buildProductFieldRules(options: { required: boolean }): ValidationChain[] {
  const { required } = options;

  // SKU is always optional (nullable column), even on create.
  const sku = body('sku')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: SKU_MIN_LENGTH, max: SKU_MAX_LENGTH })
    .withMessage(`SKU must be between ${SKU_MIN_LENGTH} and ${SKU_MAX_LENGTH} characters`);

  const name = presence(body('name').trim(), required)
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ min: NAME_MIN_LENGTH })
    .withMessage(`Product name must be at least ${NAME_MIN_LENGTH} characters long`);

  const description = presence(body('description').trim(), required)
    .notEmpty()
    .withMessage('Product description is required');

  const price = presence(body('price'), required)
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number')
    .toFloat();

  const estimatedPriceUsd = presence(body('estimatedPriceUsd'), required)
    .isFloat({ min: 0 })
    .withMessage('Estimated USD price must be a positive number')
    .toFloat();

  const condition = presence(body('condition'), required)
    .isIn([...PRODUCT_CONDITIONS])
    .withMessage('Invalid product condition');

  const seller = presence(body('seller').trim(), required)
    .notEmpty()
    .withMessage('Seller name is required');

  const sellerType = presence(body('sellerType'), required)
    .isIn([...SELLER_TYPES])
    .withMessage('Invalid seller type');

  const source = presence(body('source').trim(), required)
    .notEmpty()
    .withMessage('Source marketplace is required');

  const domesticShipping = presence(body('domesticShipping'), required)
    .isFloat({ min: 0 })
    .withMessage('Domestic shipping must be a positive number')
    .toFloat();

  const internationalShippingUsd = presence(body('internationalShippingUsd'), required)
    .isFloat({ min: 0 })
    .withMessage('International shipping must be a positive number')
    .toFloat();

  const serviceFee = presence(body('serviceFee'), required)
    .isFloat({ min: 0 })
    .withMessage('Service fee must be a positive number')
    .toFloat();

  const categoryId = presence(body('categoryId'), required)
    .notEmpty()
    .withMessage('Category ID is required');

  const stock = presence(body('stock'), required)
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer')
    .toInt();

  // Note: tags accepts an empty array even on create (the admin form sends []),
  // so no notEmpty here — only the array-shape rule.
  const tags = presence(body('tags'), required)
    .isArray()
    .withMessage('Tags must be an array');

  const isAvailable = presence(body('isAvailable'), required)
    .isBoolean()
    .withMessage('isAvailable must be a boolean')
    .toBoolean();

  const isNew = presence(body('isNew'), required)
    .isBoolean()
    .withMessage('isNew must be a boolean')
    .toBoolean();

  const isBestSeller = presence(body('isBestSeller'), required)
    .isBoolean()
    .withMessage('isBestSeller must be a boolean')
    .toBoolean();

  return [
    sku,
    name,
    description,
    price,
    estimatedPriceUsd,
    condition,
    seller,
    sellerType,
    source,
    domesticShipping,
    internationalShippingUsd,
    serviceFee,
    categoryId,
    stock,
    tags,
    isAvailable,
    isNew,
    isBestSeller,
  ];
}

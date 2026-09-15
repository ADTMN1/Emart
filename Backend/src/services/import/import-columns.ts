import { SERVICE_FEE_RATE, JPY_TO_USD_RATE } from '../../middleware/validations/product-field-rules';

/**
 * Canonical bulk-import column definitions for EMART (approved spec §B).
 *
 * Single source of truth for:
 *  - the CSV template download (GET /products/import/template)
 *  - the parser's header validation and field mapping
 *  - the Phase 2+ validation/preview responses
 */

export const IMPORT_COLUMNS = [
  'sku',
  'name',
  'description',
  'price',
  'estimatedPriceUsd',
  'condition',
  'seller',
  'sellerType',
  'source',
  'domesticShipping',
  'internationalShippingUsd',
  'serviceFee',
  'category',
  'tags',
  'isNew',
  'isBestSeller',
  'stock',
  'isAvailable',
  'image1',
  'image2',
  'image3',
  'image4',
  'image5',
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

/** True optional columns (may be empty). */
export const OPTIONAL_COLUMNS = new Set<ImportColumn>([
  'sku',
  'estimatedPriceUsd',
  'serviceFee',
  'tags',
  'isNew',
  'isBestSeller',
  'isAvailable',
  'image1',
  'image2',
  'image3',
  'image4',
  'image5',
]);

export function isRequiredColumn(col: ImportColumn): boolean {
  return !OPTIONAL_COLUMNS.has(col);
}

/** Required-with-fallback columns: empty is allowed, value auto-derived. */
export const FALLBACK_ELIGIBLE = new Set<ImportColumn>(['estimatedPriceUsd', 'serviceFee']);

/** Fallback calculations — identical to the ProductForm auto-calc rules. */
export function computeServiceFeeFallback(price: number): number {
  return Math.round(price * SERVICE_FEE_RATE);
}

export function computeUsdFallback(price: number): number {
  return Math.round(price * JPY_TO_USD_RATE * 100) / 100;
}

/** Template row commented into the CSV header (spec: example rows). */
export const TEMPLATE_EXAMPLE_ROWS: string[][] = [
  [
    'ELE-001',
    'Sony WH-1000XM5',
    'Reference-class ANC headphones, includes case',
    '45000',
    '315',
    'NEW',
    'Sony Store',
    'SHOP',
    'Yahoo! Auctions',
    '600',
    '25',
    '3150',
    'Electronics',
    'headphones;anc;wireless',
    'true',
    'false',
    '3',
    'true',
    'ELE-001-1.webp',
    'ELE-001-2.webp',
    '',
    '',
    '',
  ],
  [
    'FAS-014',
    "90s Levi's Denim Jacket",
    'Vintage washed denim, size M',
    '8900',
    '',
    'VERY_GOOD',
    'Thrift Junky',
    'INDIVIDUAL',
    'Mercari',
    '750',
    '25',
    '',
    'fashion',
    'denim;vintage',
    'false',
    'false',
    '1',
    'true',
    'FAS-014-1.jpg',
    '',
    '',
    '',
    '',
  ],
];

/** Build the template CSV content (UTF-8; callers prepend the BOM). */
export function buildTemplateCsv(): string {
  const escape = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines: string[] = [IMPORT_COLUMNS.join(',')];
  for (const row of TEMPLATE_EXAMPLE_ROWS) {
    lines.push(row.map(escape).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

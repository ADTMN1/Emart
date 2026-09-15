/**
 * Row-level validation for parsed bulk-import rows (spec §6).
 *
 * Pure functions — no DB access, no writes. Category resolution rules are
 * injected so Phase 2 can plug the preloaded category Map (applying the same
 * matching semantics as ProductService.resolveCategoryId) without this module
 * ever querying the database.
 *
 * Mirrors the bounds/enums of product-field-rules.ts and the SKU
 * normalization of ProductService (trim + uppercase).
 */

import {
  IMPORT_COLUMNS,
  ImportColumn,
  computeServiceFeeFallback,
  computeUsdFallback,
} from './import-columns';
import {
  PRODUCT_CONDITIONS,
  SELLER_TYPES,
  SKU_MAX_LENGTH,
  NAME_MIN_LENGTH,
} from '../../middleware/validations/product-field-rules';
import { RawCsvRow } from './csv-parser';

export type RowStatus = 'VALID' | 'WARNING' | 'ERROR';

export interface ParsedImportRow {
  rowNumber: number;
  /** Raw SKU as written in the sheet (preserved before normalization). */
  rawSku: string;
  /** Normalized SKU (trim + uppercase) used for dedupe/lookup; undefined when absent. */
  sku?: string;
  values: Partial<Record<ImportColumn, unknown>>;
  /** Category name as written; matched via the injected resolver. */
  categoryInput: string;
  errors: string[];
  warnings: string[];
  status: RowStatus;
}

/** Result of applying ProductService.resolveCategoryId matching rules offline. */
export interface CategoryMatch {
  resolved: boolean;
  categoryId?: string;
  /** The matched category's display name, for preview output. */
  categoryName?: string;
}

export type CategoryMatcher = (input: string) => CategoryMatch;

const BOOLEANS = new Set(['true', 'false']);
const IMAGE_COLUMN_PATTERN = /^image([1-5])$/;

function isBlank(v: string): boolean {
  return v.trim().length === 0;
}

function parseNumber(value: string): { ok: boolean; num?: number } {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return { ok: false };
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return { ok: false };
  return { ok: true, num };
}

function parseBool(value: string): { ok: boolean; bool?: boolean } {
  const normalized = value.trim().toLowerCase();
  if (!BOOLEANS.has(normalized)) return { ok: false };
  return { ok: true, bool: normalized === 'true' };
}

/**
 * Normalize a SKU exactly like ProductService.normalizeSku:
 * trim + uppercase. Returns undefined for empty input.
 */
export function normalizeImportSku(raw: string): string | undefined {
  const normalized = (raw ?? '').trim().toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Validate one raw CSV row against the import field rules.
 * Never throws for field problems — collects errors/warnings per row so a
 * single bad row never aborts the file (spec §6).
 */
export function validateRow(row: RawCsvRow, matchCategory: CategoryMatcher): ParsedImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const values: Partial<Record<ImportColumn, unknown>> = {};
  const c = row.cells;

  const rawSku = c.sku ?? '';
  const sku = normalizeImportSku(rawSku);

  // --- sku ---
  if (isBlank(rawSku)) {
    errors.push('SKU is required');
  } else if (sku && (sku.length < 3 || sku.length > SKU_MAX_LENGTH)) {
    errors.push(`SKU must be between 3 and ${SKU_MAX_LENGTH} characters`);
  }
  if (rawSku !== sku && sku) {
    warnings.push(`SKU normalized from "${rawSku}" to "${sku}"`);
  }

  // --- name / description ---
  if (isBlank(c.name)) {
    errors.push('Product name is required');
  } else if (c.name.trim().length < NAME_MIN_LENGTH) {
    errors.push(`Product name must be at least ${NAME_MIN_LENGTH} characters long`);
  } else {
    values.name = c.name.trim();
  }
  if (isBlank(c.description)) {
    errors.push('Product description is required');
  } else {
    values.description = c.description.trim();
  }

  // --- price ---
  const price = parseNumber(c.price);
  if (isBlank(c.price)) {
    errors.push('Price is required');
  } else if (!price.ok || price.num! < 0) {
    errors.push('Price must be a positive number');
  } else {
    values.price = price.num;
  }

  // --- estimatedPriceUsd (optional, fallback) ---
  if (isBlank(c.estimatedPriceUsd)) {
    if (price.ok && price.num! > 0) {
      const fallback = computeUsdFallback(price.num!);
      values.estimatedPriceUsd = fallback;
      warnings.push(`estimatedPriceUsd empty — computed ${fallback} from price ${price.num}`);
    }
    // If price itself is invalid, the price error already covers the row.
  } else {
    const usd = parseNumber(c.estimatedPriceUsd);
    if (!usd.ok || usd.num! < 0) {
      errors.push('Estimated USD price must be a positive number');
    } else {
      values.estimatedPriceUsd = usd.num;
    }
  }

  // --- condition / sellerType / source ---
  if (isBlank(c.condition)) {
    errors.push('Condition is required');
  } else if (!(PRODUCT_CONDITIONS as readonly string[]).includes(c.condition.trim().toUpperCase())) {
    errors.push(`Invalid condition "${c.condition.trim()}" (allowed: ${PRODUCT_CONDITIONS.join(', ')})`);
  } else {
    values.condition = c.condition.trim().toUpperCase();
  }

  if (isBlank(c.seller)) errors.push('Seller name is required');
  else values.seller = c.seller.trim();

  if (isBlank(c.sellerType)) {
    errors.push('Seller type is required');
  } else if (!(SELLER_TYPES as readonly string[]).includes(c.sellerType.trim().toUpperCase())) {
    errors.push(`Invalid seller type "${c.sellerType.trim()}" (allowed: ${SELLER_TYPES.join(', ')})`);
  } else {
    values.sellerType = c.sellerType.trim().toUpperCase();
  }

  if (isBlank(c.source)) errors.push('Source marketplace is required');
  else values.source = c.source.trim();

  // --- shipping / serviceFee (serviceFee optional with fallback) ---
  for (const [col, label] of [
    ['domesticShipping', 'Domestic shipping'],
    ['internationalShippingUsd', 'International shipping'],
  ] as const) {
    const v = parseNumber(c[col]);
    if (isBlank(c[col])) {
      errors.push(`${label} is required`);
    } else if (!v.ok || v.num! < 0) {
      errors.push(`${label} must be a positive number`);
    } else {
      values[col] = v.num;
    }
  }

  if (isBlank(c.serviceFee)) {
    if (price.ok && price.num! > 0) {
      const fallback = computeServiceFeeFallback(price.num!);
      values.serviceFee = fallback;
      warnings.push(`serviceFee empty — computed ${fallback} (7% of price)`);
    }
  } else {
    const fee = parseNumber(c.serviceFee);
    if (!fee.ok || fee.num! < 0) {
      errors.push('Service fee must be a positive number');
    } else {
      values.serviceFee = fee.num;
    }
  }

  // --- category (injected matcher; no DB here) ---
  if (isBlank(c.category)) {
    errors.push('Category is required');
  } else {
    const match = matchCategory(c.category.trim());
    if (!match.resolved) {
      errors.push(`Unknown category: "${c.category.trim()}"`);
    } else {
      // Resolved category id is stored under the canonical "category" column;
      // the raw sheet input stays on categoryInput for preview output.
      values.category = match.categoryId;
      if (match.categoryName && match.categoryName !== c.category.trim()) {
        warnings.push(`Category "${c.category.trim()}" resolved to "${match.categoryName}"`);
      }
    }
  }

  // --- tags: semicolon-separated inside the cell ---
  const tags = (c.tags ?? '')
    .split(';')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  values.tags = tags;

  // --- booleans (optional, defaults per spec) ---
  for (const [col, label, fallback] of [
    ['isNew', 'isNew', false],
    ['isBestSeller', 'isBestSeller', false],
    ['isAvailable', 'isAvailable', true],
  ] as const) {
    const raw = c[col] ?? '';
    if (isBlank(raw)) {
      values[col] = fallback;
    } else {
      const b = parseBool(raw);
      if (!b.ok) {
        errors.push(`${label} must be true or false`);
      } else {
        values[col] = b.bool;
      }
    }
  }

  // --- stock ---
  if (isBlank(c.stock)) {
    errors.push('Stock is required');
  } else if (!/^\d+$/.test(c.stock.trim())) {
    errors.push('Stock must be a non-negative integer');
  } else {
    values.stock = parseInt(c.stock, 10);
  }

  // --- image references: filenames, validated structurally only (no ZIP in Phase 1) ---
  for (const col of IMPORT_COLUMNS) {
    const m = IMAGE_COLUMN_PATTERN.exec(col);
    if (!m) continue;
    const raw = (c[col] ?? '').trim();
    if (isBlank(raw)) continue;
    if (!/^[A-Za-z0-9._-]+$/.test(raw)) {
      errors.push(`${col} must be a ZIP filename like ${'${SKU}'}-1.webp (no paths or URL characters)`);
    }
    values[col] = raw;
  }
  // Image filename prefix coherence: warn when the filename doesn't start with the SKU.
  if (sku) {
    for (const col of IMPORT_COLUMNS) {
      if (!IMAGE_COLUMN_PATTERN.test(col)) continue;
      const raw = (c[col] ?? '').trim();
      if (!raw) continue;
      if (!raw.toLowerCase().startsWith(sku.toLowerCase() + '-')) {
        warnings.push(`${col} "${raw}" does not start with SKU prefix "${sku}-"`);
      }
    }
  }

  const status: RowStatus = errors.length > 0 ? 'ERROR' : warnings.length > 0 ? 'WARNING' : 'VALID';

  return {
    rowNumber: row.rowNumber,
    rawSku,
    sku,
    values,
    categoryInput: c.category?.trim() ?? '',
    errors,
    warnings,
    status,
  };
}

/** Validate all rows. Pure — no persistence. */
export function validateRows(rows: RawCsvRow[], matchCategory: CategoryMatcher, mode: 'CREATE' | 'UPDATE' = 'CREATE'): ParsedImportRow[] {
  if (mode === 'UPDATE') return validateUpdateRows(rows, matchCategory);
  const parsed = rows.map((r) => validateRow(r, matchCategory));
  detectInFileDuplicateSkus(parsed);
  return parsed;
}

/** UPSERT composes the existing validators: known SKUs use the partial UPDATE
 * rules, while unknown SKUs retain strict CREATE validation and defaults. */
export function validateUpsertRows(rows: RawCsvRow[], matchCategory: CategoryMatcher, existingSkus: Set<string>): ParsedImportRow[] {
  const parsed = rows.map((row) => {
    const sku = normalizeImportSku(row.cells.sku ?? '');
    return sku && existingSkus.has(sku)
      ? validateUpdateRow(row, matchCategory)
      : validateRow(row, matchCategory);
  });
  detectInFileDuplicateSkus(parsed);
  return parsed;
}

/** UPDATE keeps the canonical field rules but removes only absent/empty field
 * requirements and defaults; present values are validated by the CREATE path. */
function validateUpdateRows(rows: RawCsvRow[], matchCategory: CategoryMatcher): ParsedImportRow[] {
  const parsed = rows.map((row) => validateUpdateRow(row, matchCategory));
  detectInFileDuplicateSkus(parsed); return parsed;
}

/** UPDATE deliberately has its own parser/validator path.  Empty cells and
 * omitted columns both preserve the stored value; CREATE fallbacks/defaults
 * are never introduced here. */
function validateUpdateRow(row: RawCsvRow, matchCategory: CategoryMatcher): ParsedImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const values: Partial<Record<ImportColumn, unknown>> = {};
  const c = row.cells;
  const supplied = new Set(row.suppliedColumns);
  const rawSku = c.sku ?? '';
  const sku = normalizeImportSku(rawSku);

  if (isBlank(rawSku)) errors.push('SKU is required');
  else if (sku && (sku.length < 3 || sku.length > SKU_MAX_LENGTH)) errors.push(`SKU must be between 3 and ${SKU_MAX_LENGTH} characters`);
  if (rawSku !== sku && sku) warnings.push(`SKU normalized from "${rawSku}" to "${sku}"`);

  const suppliedNonEmpty = (field: ImportColumn) => supplied.has(field) && !isBlank(c[field] ?? '');
  if (suppliedNonEmpty('name')) {
    if (c.name.trim().length < NAME_MIN_LENGTH) errors.push(`Product name must be at least ${NAME_MIN_LENGTH} characters long`);
    else values.name = c.name.trim();
  }
  if (suppliedNonEmpty('description')) values.description = c.description.trim();

  for (const [field, label] of [['price', 'Price'], ['estimatedPriceUsd', 'Estimated USD price'], ['domesticShipping', 'Domestic shipping'], ['internationalShippingUsd', 'International shipping'], ['serviceFee', 'Service fee']] as const) {
    if (!suppliedNonEmpty(field)) continue;
    const parsed = parseNumber(c[field]);
    if (!parsed.ok || parsed.num! < 0) errors.push(`${label} must be a positive number`);
    else values[field] = parsed.num;
  }
  if (suppliedNonEmpty('condition')) {
    const value = c.condition.trim().toUpperCase();
    if (!(PRODUCT_CONDITIONS as readonly string[]).includes(value)) errors.push(`Invalid condition "${c.condition.trim()}" (allowed: ${PRODUCT_CONDITIONS.join(', ')})`);
    else values.condition = value;
  }
  if (suppliedNonEmpty('seller')) values.seller = c.seller.trim();
  if (suppliedNonEmpty('sellerType')) {
    const value = c.sellerType.trim().toUpperCase();
    if (!(SELLER_TYPES as readonly string[]).includes(value)) errors.push(`Invalid seller type "${c.sellerType.trim()}" (allowed: ${SELLER_TYPES.join(', ')})`);
    else values.sellerType = value;
  }
  if (suppliedNonEmpty('source')) values.source = c.source.trim();
  if (suppliedNonEmpty('category')) {
    const match = matchCategory(c.category.trim());
    if (!match.resolved) errors.push(`Unknown category: "${c.category.trim()}"`);
    else {
      values.category = match.categoryId;
      if (match.categoryName && match.categoryName !== c.category.trim()) warnings.push(`Category "${c.category.trim()}" resolved to "${match.categoryName}"`);
    }
  }
  if (suppliedNonEmpty('tags')) values.tags = c.tags.split(';').map((tag) => tag.trim()).filter(Boolean);
  for (const field of ['isNew', 'isBestSeller', 'isAvailable'] as const) {
    if (!suppliedNonEmpty(field)) continue;
    const parsed = parseBool(c[field]);
    if (!parsed.ok) errors.push(`${field} must be true or false`);
    else values[field] = parsed.bool;
  }
  if (suppliedNonEmpty('stock')) {
    if (!/^\d+$/.test(c.stock.trim())) errors.push('Stock must be a non-negative integer');
    else values.stock = parseInt(c.stock, 10);
  }
  return { rowNumber: row.rowNumber, rawSku, sku, values, categoryInput: c.category?.trim() ?? '', errors, warnings, status: errors.length ? 'ERROR' : warnings.length ? 'WARNING' : 'VALID' };
}

/**
 * Flag SKUs duplicated inside the same spreadsheet (spec §3): the first
 * occurrence is kept, later occurrences get an error so they cannot silently
 * overwrite the first row's data during a future import.
 */
export function detectInFileDuplicateSkus(parsed: ParsedImportRow[]): void {
  const firstSeenAt = new Map<string, number>();
  for (const row of parsed) {
    if (!row.sku) continue;
    const firstRow = firstSeenAt.get(row.sku);
    if (firstRow === undefined) {
      firstSeenAt.set(row.sku, row.rowNumber);
    } else {
      row.errors.push(`Duplicate SKU in file (first occurrence on row ${firstRow} wins)`);
      row.status = 'ERROR';
    }
  }
}

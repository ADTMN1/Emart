/**
 * Minimal, dependency-free RFC 4180 CSV parser for the EMART bulk import.
 *
 * Handles: UTF-8 BOM, quoted fields, escaped quotes (""), CRLF/LF line
 * endings, commas inside quoted fields. Pure functions — no DB access.
 *
 * Deliberately NOT implemented here: ZIP handling, Excel support, product
 * creation, image uploads, and any persistence (Phase 1 scope).
 */

import { IMPORT_COLUMNS, ImportColumn } from './import-columns';

/** Cap: rejected beyond this before parsing (protects memory). */
export const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB — generous for 10k rows
/** Cap: matches the spec's recommendation to split sheets beyond this. */
export const MAX_CSV_ROWS = 10_000;

export class CsvParseError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

export interface RawCsvRow {
  /** 1-based file line number (header = line 1, first data row = 2) so
   *  reported rows match what a spreadsheet application displays. */
  rowNumber: number;
  /** Raw cell values keyed by canonical column name. */
  cells: Record<ImportColumn, string>;
  /** Columns that appeared in this file's header.  UPDATE validation needs
   * this to distinguish an omitted field from a supplied empty cell. */
  suppliedColumns: ImportColumn[];
}

export interface CsvParseResult {
  rows: RawCsvRow[];
  /** True if the file began with a UTF-8 BOM (informational). */
  hadBom: boolean;
}

const COLUMN_SET = new Set<string>(IMPORT_COLUMNS);

/**
 * Parse CSV text into typed rows.
 * Throws CsvParseError with a precise message for structural problems:
 * wrong/missing header, ragged rows, unterminated quotes, empty file,
 * or caps exceeded.
 */
export type ImportCsvMode = 'CREATE' | 'UPDATE' | 'UPSERT';

export function parseCsv(input: string, mode: ImportCsvMode = 'CREATE'): CsvParseResult {
  if (typeof input !== 'string' || input.length === 0) {
    throw new CsvParseError('CSV file is empty');
  }

  // Strip UTF-8 BOM if present (accepts both BOM and BOM-less UTF-8).
  let hadBom = false;
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) {
    hadBom = true;
    text = text.slice(1);
  }
  if (text.trim().length === 0) {
    throw new CsvParseError('CSV file is empty');
  }

  const records = splitRecords(text);

  // Header validation: exact canonical set (order-insensitive, case-sensitive
  // per the approved template). Unknown columns are rejected so typos like
  // "categorie" never silently drop data.
  const header = records[0].map((h) => h.trim());
  const missing = mode === 'CREATE' ? IMPORT_COLUMNS.filter((c) => !header.includes(c)) : (header.includes('sku') ? [] : ['sku']);
  const unknown = header.filter((h) => h.length > 0 && !COLUMN_SET.has(h));
  const duplicate = header.filter((h, i) => header.indexOf(h) !== i);
  const unsupportedPartialModeImages = mode !== 'CREATE'
    ? header.filter((h) => /^image[1-5]$/.test(h))
    : [];
  if (missing.length > 0 || unknown.length > 0 || duplicate.length > 0 || unsupportedPartialModeImages.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`missing columns: ${missing.join(', ')}`);
    if (unknown.length > 0) parts.push(`unknown columns: ${unknown.join(', ')}`);
    if (duplicate.length > 0) parts.push(`duplicate columns: ${[...new Set(duplicate)].join(', ')}`);
    if (unsupportedPartialModeImages.length > 0) parts.push(`image columns are not supported in ${mode} mode: ${unsupportedPartialModeImages.join(', ')}`);
    throw new CsvParseError(`Invalid CSV header — ${parts.join('; ')}`);
  }

  const colIndex = new Map<string, number>();
  header.forEach((h, i) => colIndex.set(h, i));

  const rows: RawCsvRow[] = [];
  for (let i = 1; i < records.length; i++) {
    const record = records[i];
    // Skip completely empty trailing lines (common when files end with \r\n).
    if (record.length === 1 && record[0].trim() === '') continue;

    if (record.length !== header.length) {
      throw new CsvParseError(
        `Malformed CSV at file line ${i + 1}: expected ${header.length} columns, found ${record.length}`
      );
    }

    const cells = {} as Record<ImportColumn, string>;
    for (const [name, idx] of colIndex) {
      cells[name as ImportColumn] = record[idx] ?? '';
    }
    for (const name of IMPORT_COLUMNS) if (!(name in cells)) cells[name] = '';
    rows.push({ rowNumber: i + 1, cells, suppliedColumns: header as ImportColumn[] });
  }

  if (rows.length > MAX_CSV_ROWS) {
    throw new CsvParseError(
      `CSV contains more than ${MAX_CSV_ROWS} data rows — split the file into smaller batches`
    );
  }

  return { rows, hadBom };
}

/**
 * RFC 4180 record splitter implemented as a character state machine.
 * Returns an array of records, each an array of unescaped field strings.
 */
function splitRecords(text: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let sawAnyChar = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    sawAnyChar = true;

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++; // escaped quote
        } else {
          inQuotes = false; // closing quote
        }
      } else {
        field += ch; // commas/newlines inside quotes are literal
      }
      continue;
    }

    if (ch === '"') {
      if (field.length === 0) {
        inQuotes = true; // opening quote
      } else {
        // Quote appearing mid-field (e.g. ab"c) — RFC says invalid.
        throw new CsvParseError('Malformed CSV: unexpected quote inside unquoted field');
      }
      continue;
    }

    if (ch === ',') {
      record.push(field);
      field = '';
      continue;
    }

    if (ch === '\r' || ch === '\n') {
      // Handle CRLF as a single terminator.
      if (ch === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      field = '';
      record = [];
      sawAnyChar = false;
      continue;
    }

    field += ch;
  }

  // Final record without trailing newline.
  if (sawAnyChar || field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records;
}

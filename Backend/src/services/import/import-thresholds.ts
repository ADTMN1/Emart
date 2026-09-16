export const IMPORT_SIZE_THRESHOLDS = {
  SYNCHRONOUS_MAX_ROWS: 100,
  ASYNC_MIN_ROWS: 101,
  ASYNC_GUARDED_MIN_ROWS: 1001,
  MAX_SUPPORTED_ROWS: 10000,
  CONCURRENCY_LIMIT: 4,
} as const;

/**
 * ZIP image imports perform remote uploads and must not hold an HTTP request
 * open. They use the existing ImportRun worker regardless of CSV row count.
 */
export function shouldProcessInBackground(rowCount: number, hasImagesZip = false): boolean {
  return hasImagesZip || rowCount > IMPORT_SIZE_THRESHOLDS.SYNCHRONOUS_MAX_ROWS;
}

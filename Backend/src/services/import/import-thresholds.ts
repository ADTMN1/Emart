export const IMPORT_SIZE_THRESHOLDS = {
  SYNCHRONOUS_MAX_ROWS: 100,
  ASYNC_MIN_ROWS: 101,
  ASYNC_GUARDED_MIN_ROWS: 1001,
  MAX_SUPPORTED_ROWS: 10000,
  CONCURRENCY_LIMIT: 4,
} as const;

export function shouldProcessInBackground(rowCount: number): boolean {
  return rowCount > IMPORT_SIZE_THRESHOLDS.SYNCHRONOUS_MAX_ROWS;
}

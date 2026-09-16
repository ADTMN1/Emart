import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldProcessInBackground } from './import-thresholds';
import { ProductImportService } from './product-import.service';

test('small CSV-only imports remain synchronous', () => {
  assert.equal(shouldProcessInBackground(15), false);
  assert.equal(shouldProcessInBackground(100), false);
});

test('CSV + ZIP imports use the existing background worker regardless of row count', () => {
  assert.equal(shouldProcessInBackground(15, true), true);
});

test('large CSV imports remain background imports without a ZIP', () => {
  assert.equal(shouldProcessInBackground(101), true);
});

test('background concurrency waits for every queued row before finalizing', async () => {
  const service = new ProductImportService();
  const processed: number[] = [];
  let active = 0;
  let peak = 0;

  await (service as any).runRowsWithConcurrency(Array.from({ length: 15 }, (_, index) => index), async (row: number) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    processed.push(row);
    active -= 1;
  }, 4);

  assert.equal(processed.length, 15);
  assert.equal(new Set(processed).size, 15);
  assert.ok(peak <= 4);
});

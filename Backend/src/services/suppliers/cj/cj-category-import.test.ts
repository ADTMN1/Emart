import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../../../config/database';
import cjClient from './cj-client';
import { CJCategoryImportService, CJCategoryImportRow } from './cj-category-import.service';

test('CJCategoryImportRow has correct structure for SUCCESS', () => {
  const row: CJCategoryImportRow = {
    cjProductId: 'cj-123',
    productName: 'Test Product',
    status: 'SUCCESS',
    emartProductId: 'emart-456',
    warnings: [],
  };

  assert.equal(row.cjProductId, 'cj-123');
  assert.equal(row.status, 'SUCCESS');
  assert.equal(row.emartProductId, 'emart-456');
});

test('CJCategoryImportRow has correct structure for SKIPPED_DUPLICATE', () => {
  const row: CJCategoryImportRow = {
    cjProductId: 'cj-123',
    productName: 'Test Product',
    status: 'SKIPPED_DUPLICATE',
    emartProductId: 'existing-id',
    warnings: [],
  };

  assert.equal(row.status, 'SKIPPED_DUPLICATE');
  assert.equal(row.emartProductId, 'existing-id');
});

test('CJCategoryImportRow has correct structure for FAILED', () => {
  const row: CJCategoryImportRow = {
    cjProductId: 'cj-123',
    productName: 'Test Product',
    status: 'FAILED',
    error: 'CJ API timeout',
    warnings: [],
  };

  assert.equal(row.status, 'FAILED');
  assert.equal(row.error, 'CJ API timeout');
});

test('CJCategoryImportRow has correct structure for WARNING', () => {
  const row: CJCategoryImportRow = {
    cjProductId: 'cj-123',
    productName: 'Test Product',
    status: 'WARNING',
    emartProductId: 'emart-789',
    warnings: ['Only 2/5 images uploaded'],
  };

  assert.equal(row.status, 'WARNING');
  assert.ok(row.warnings.includes('Only 2/5 images uploaded'));
});

test('CJCategoryImportService can be instantiated', () => {
  const service = new CJCategoryImportService();
  assert.ok(service);
  assert.equal(typeof service.startCategoryImport, 'function');
  assert.equal(typeof service.retryFailedProducts, 'function');
});

test('retryFailedProducts refuses a run that has no stored EMART category', async () => {
  const original = prisma.importRun.findUnique;
  (prisma.importRun as any).findUnique = async () => ({
    id: 'run-without-options',
    userId: 'u1',
    filename: 'CJ Category Import - 100000017',
    rowResults: [{ cjProductId: 'p1', productName: 'x', status: 'FAILED', warnings: [] }],
    sourceRows: null,
  });

  try {
    const service = new CJCategoryImportService();
    await assert.rejects(
      () => service.retryFailedProducts('run-without-options', 'u1'),
      (error: any) => {
        assert.match(error.message, /fresh category import/i);
        return true;
      }
    );
  } finally {
    (prisma.importRun as any).findUnique = original;
  }
});

test('processSingleProduct returns FAILED when CJ API fails', async () => {
  const originalFindUnique = prisma.product.findUnique;
  (prisma.product as any).findUnique = async () => null;

  cjClient.setTransportHooks({
    headers: async () => ({}),
    sleep: async () => undefined,
    fetch: async () =>
      ({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ code: 1600301, message: 'product not found', data: null }),
        headers: { get: () => null },
      }) as unknown as Response,
  });

  try {
    const service = new CJCategoryImportService();
    const result = await (service as any).processSingleProduct(
      'cj-invalid',
      'Test Product',
      { emartCategoryId: 'cat-1' }
    );

    assert.equal(result.status, 'FAILED');
    assert.equal(result.cjProductId, 'cj-invalid');
    assert.ok(result.error);
    assert.match(result.error, /product not found/);
  } finally {
    cjClient.resetTransportHooks();
    (prisma.product as any).findUnique = originalFindUnique;
  }
});

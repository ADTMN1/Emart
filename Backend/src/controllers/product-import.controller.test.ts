import assert from 'node:assert/strict';
import test from 'node:test';
import { NextFunction, Response } from 'express';
import productImportController from './product-import.controller';
import { ProductImportService } from '../services/import/product-import.service';
import { IMPORT_COLUMNS } from '../services/import/import-columns';

test('a 15-row CSV + ZIP request is accepted immediately as a background import', async () => {
  const csv = [
    IMPORT_COLUMNS.join(','),
    ...Array.from({ length: 15 }, (_, index) => IMPORT_COLUMNS.map((column) => column === 'sku' ? `ZIP-TEST-${index}` : '').join(',')),
  ].join('\n');
  const originalShouldProcess = ProductImportService.prototype.shouldProcessInBackground;
  const originalEnqueue = ProductImportService.prototype.enqueueBackgroundImport;
  let queuedRows = 0;
  let responseStatus = 0;
  let responseBody: unknown;

  try {
    ProductImportService.prototype.shouldProcessInBackground = (_rowCount, hasImagesZip) => hasImagesZip;
    ProductImportService.prototype.enqueueBackgroundImport = async (job) => {
      queuedRows = job.validatedRows.length;
      return { runId: 'background-run-id', status: 'PROCESSING', message: 'Import accepted and processing in the background.' };
    };

    const req = {
      user: { id: 'test-admin-id' },
      body: {},
      files: {
        file: [{ buffer: Buffer.from(csv), originalname: 'test.csv' }],
        imagesZip: [{ buffer: Buffer.alloc(0), originalname: 'test.zip' }],
      },
    } as any;
    const res = {
      status: (status: number) => { responseStatus = status; return res; },
      json: (body: unknown) => { responseBody = body; return res; },
    } as unknown as Response;
    let forwardedError: unknown;
    const next: NextFunction = (error?: unknown) => { forwardedError = error; };

    await productImportController.importCsv(req, res, next);

    assert.equal(forwardedError, undefined);
    assert.equal(queuedRows, 15);
    assert.equal(responseStatus, 202);
    assert.deepEqual(responseBody, {
      success: true,
      data: { runId: 'background-run-id', status: 'PROCESSING', message: 'Import accepted and processing in the background.' },
      message: 'Import accepted and processing in the background.',
    });
  } finally {
    ProductImportService.prototype.shouldProcessInBackground = originalShouldProcess;
    ProductImportService.prototype.enqueueBackgroundImport = originalEnqueue;
  }
});

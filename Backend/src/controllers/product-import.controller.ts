import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { buildTemplateCsv } from '../services/import/import-columns';
import { parseCsv, CsvParseError } from '../services/import/csv-parser';
import { validateRows, validateUpsertRows, normalizeImportSku } from '../services/import/product-row.validator';
import { buildCategoryMatcher } from '../services/import/category-matcher';
import productImportService, { ProductImportError } from '../services/import/product-import.service';
import prisma from '../config/database';
import { sendSuccess } from '../utils/response';
import { BadRequestError } from '../utils/errors';

/**
 * Bulk-import endpoints (spec §E).
 *
 * Implemented: GET /template (Phase 1), POST /validate (Phase 2 — parse
 * + validate only, zero database writes), POST /import (Phase 3 —
 * synchronous CREATE-mode CSV import with ImportRun history).
 * Deliberately NOT implemented yet: /history, /:runId, ZIP/image
 * processing, UPDATE/UPSERT modes, background jobs.
 */
export class ProductImportController {
  constructor() {
    this.getTemplate = this.getTemplate.bind(this);
    this.validateCsv = this.validateCsv.bind(this);
    this.getHistory = this.getHistory.bind(this);
    this.getRun = this.getRun.bind(this);
    this.retryFailedRows = this.retryFailedRows.bind(this);
    this.importCsv = this.importCsv.bind(this);
  }

  private importMode(value: unknown): 'CREATE' | 'UPDATE' | 'UPSERT' {
    if (value === undefined || value === '' || value === 'CREATE') return 'CREATE';
    if (value === 'UPDATE') return 'UPDATE';
    if (value === 'UPSERT') return 'UPSERT';
    throw new BadRequestError('Import mode must be CREATE, UPDATE, or UPSERT');
  }
  /**
   * GET /products/import/template
   * Returns the canonical import CSV (UTF-8 with BOM so Excel opens it
   * correctly) with the approved columns and two example rows.
   * No database access.
   */
  async getTemplate(_req: Request, res: Response): Promise<Response> {
    const BOM = '\uFEFF';
    const csv = BOM + buildTemplateCsv();

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="emart-product-import-template.csv"');
    return res.send(csv);
  }

  /**
   * POST /products/import/validate
   *
   * Accepts a CSV upload (field name: "file"), parses it with the Phase 1
   * parser, validates every row with the pure row validator (categories
   * preloaded once and injected), and returns a structured report.
   *
   * NEVER creates, updates, or deletes anything — this endpoint performs
   * zero database writes.
   */
  async validateCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        throw new BadRequestError('No CSV file uploaded (field name: "file")');
      }

      // Preload categories once (single query), inject the resolver.
      const matchCategory = await buildCategoryMatcher();

      // Decode strictly as UTF-8 (the parser strips a leading BOM itself).
      const csvText = Buffer.from(file.buffer).toString('utf-8');

      const mode = this.importMode(req.body?.mode);
      let parsed;
      try {
        parsed = parseCsv(csvText, mode);
      } catch (error) {
        if (error instanceof CsvParseError) {
          // Structural CSV problems are a clean client error — row-level data
          // problems are NOT errors of this kind and never abort the file.
          throw new BadRequestError(error.message);
        }
        throw error;
      }

      const rows = mode === 'UPSERT'
        ? await this.validateUpsertPreview(parsed.rows, matchCategory)
        : validateRows(parsed.rows, matchCategory, mode);

      const validRows = rows.filter((r) => r.status === 'VALID').length;
      const warningRows = rows.filter((r) => r.status === 'WARNING').length;
      const errorRows = rows.filter((r) => r.status === 'ERROR').length;

      sendSuccess(
        res,
        {
          totalRows: rows.length,
          validRows,
          warningRows,
          errorRows,
          hadBom: parsed.hadBom,
          mode,
          rows: rows.map((r) => ({
            rowNumber: r.rowNumber,
            rawSku: r.rawSku,
            sku: r.sku,
            values: r.values,
            errors: r.errors,
            warnings: r.warnings,
            status: r.status,
          })),
        },
        'CSV validated successfully'
      );
    } catch (error) {
      // Express 4 does not catch async rejections — follow the project's
      // controller convention (try/catch -> next) so errors reach the
      // error handler instead of crashing the process.
      next(error);
    }
  }

  private async validateUpsertPreview(rows: Parameters<typeof validateRows>[0], matchCategory: Parameters<typeof validateRows>[1]) {
    const skus = [...new Set(rows.map((row) => normalizeImportSku(row.cells.sku ?? '')).filter((sku): sku is string => !!sku))];
    const existing = skus.length ? await prisma.product.findMany({ where: { sku: { in: skus } }, select: { sku: true } }) : [];
    return validateUpsertRows(rows, matchCategory, new Set(existing.map((product) => product.sku).filter((sku): sku is string => !!sku)));
  }

  /**
   * GET /products/import/history (Phase 4, read-only)
   *
   * Paginated, newest first. Summary fields only — no rowResults/fileHash
   * in the list payload.
   */
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

      const result = await productImportService.getHistory(page, limit);

      sendSuccess(res, result, 'Import history retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /products/import/:runId (Phase 4, read-only)
   *
   * Full run detail including rowResults. 404 when the run doesn't exist.
   */
  async getRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await productImportService.getRunById(req.params.runId);
      sendSuccess(res, run, 'Import run retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async retryFailedRows(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const runId = req.params.runId;
      const userId = req.user!.id as string;
      const result = await productImportService.retryFailedRows(runId, userId);
      sendSuccess(res, result, 'Failed rows retry completed');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /products/import (Phase 3 — CREATE mode, synchronous)
   *
   * Accepts the same CSV upload as /validate, executes the import, and
   * returns the run result. Row-level failures never abort the run; the
   * full per-row outcome is persisted in the ImportRun and returned here.
   */
  async importCsv(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const file = files?.file?.[0];
      const imagesZip = files?.imagesZip?.[0];
      if (!file) {
        throw new BadRequestError('No CSV file uploaded (field name: "file")');
      }
      const userId = req.user!.id as string;

      const mode = this.importMode(req.body?.mode);
      const matchCategory = await buildCategoryMatcher();
      const csvText = Buffer.from(file.buffer).toString('utf-8');

      let parsed;
      try {
        parsed = parseCsv(csvText, mode);
      } catch (error) {
        if (error instanceof CsvParseError) {
          throw new BadRequestError(error.message);
        }
        throw error;
      }

      const rows = mode === 'UPSERT'
        ? await this.validateUpsertPreview(parsed.rows, matchCategory)
        : validateRows(parsed.rows, matchCategory, mode);

      if (imagesZip && (mode === 'UPDATE' || mode === 'UPSERT')) {
        throw new ProductImportError('ZIP image imports are not supported in UPDATE mode');
      }

      if (productImportService.shouldProcessInBackground(rows.length, Boolean(imagesZip))) {
        const accepted = await productImportService.enqueueBackgroundImport({
          userId,
          filename: file.originalname || 'upload.csv',
          fileHash: crypto.createHash('sha256').update(file.buffer).digest('hex'),
          mode,
          sourceRows: parsed.rows,
          validatedRows: rows,
          file,
          imagesZip,
        });

        res.status(202).json({
          success: true,
          data: accepted,
          message: accepted.message,
        });
        return;
      }

      const result = mode === 'UPDATE'
        ? await productImportService.importUpdateCsv(file, userId, imagesZip)
        : mode === 'UPSERT'
          ? await productImportService.importUpsertCsv(file, userId, imagesZip)
          : await productImportService.importCreateCsv(file, userId, imagesZip);

      const action = mode === 'UPDATE' ? 'updated' : mode === 'UPSERT' ? 'processed' : 'created';
      sendSuccess(res, result, `Import finished: ${result.successRows + result.warningRows} ${action}, ${result.errorRows} failed`);
    } catch (error) {
      // Clean 4xx for structural problems (malformed CSV, no file); the
      // error handler converts ProductImportError.statusCode accordingly.
      if (error instanceof ProductImportError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
        return;
      }
      next(error);
    }
  }
}

export default new ProductImportController();

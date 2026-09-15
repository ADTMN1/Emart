/**
 * Product bulk-import execution service (Phase 3: CREATE mode, CSV only).
 *
 * Pipeline: parse (Phase 1) → validate (Phase 1, injected category matcher
 * from Phase 2) → preflight DB SKU duplicates → per-row atomic product
 * creation (existing ProductService.createProduct) → ImportRun bookkeeping.
 *
 * NOT implemented in this phase (per spec): image/ZIP processing, UPDATE /
 * UPSERT modes, background jobs, retry of failed rows.
 *
 * Transaction model: each product creation is a single atomic Prisma
 * statement — one failed row can never leave a partially-created product,
 * and one failed row never aborts the run (spec §4/§3). The run itself is
 * NOT wrapped in one giant transaction.
 */

import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { parseCsv, CsvParseError, RawCsvRow } from './csv-parser';
import { validateRows, validateUpsertRows, normalizeImportSku, ParsedImportRow } from './product-row.validator';
import { buildCategoryMatcher } from './category-matcher';
import productService from '../product.service';
import productImageStorage from '../product-image-storage.service';
import { ImageZipIndex, indexImageZip, ZipImage } from './image-zip-import.service';
import { IMPORT_SIZE_THRESHOLDS, shouldProcessInBackground } from './import-thresholds';

/** Row-level outcome stored in ImportRun.rowResults. */
export interface ImportRowResult {
  rowNumber: number;
  sku?: string;
  status: 'CREATED' | 'WARNING_CREATED' | 'UPDATED' | 'WARNING_UPDATED' | 'FAILED';
  productId?: string;
  imagesUploaded?: number;
  errors: string[];
  warnings: string[];
}

export interface ImportRunResult {
  runId: string;
  status: 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED';
  totalRows: number;
  successRows: number;
  warningRows: number;
  errorRows: number;
  createdProducts: number;
  updatedProducts: number;
  imagesUploaded: number;
  imagesSkipped: number;
  imagesInvalid: number;
  imageWarnings: string[];
  rowResults: ImportRowResult[];
}

export function getFailedRowsForRetry(sourceRows: unknown[] | null | undefined, rowResults: unknown[] | null | undefined): Array<Record<string, unknown>> {
  if (!Array.isArray(sourceRows) || !Array.isArray(rowResults)) return [];
  const retryNumbers = new Set(
    (rowResults as Array<Record<string, unknown>>)
      .filter((entry) => entry?.status === 'FAILED')
      .map((entry) => Number(entry?.rowNumber))
      .filter((value) => Number.isInteger(value))
  );

  return sourceRows.filter((row) => {
    const candidate = row as Record<string, unknown> | null;
    const rowNumber = typeof candidate?.rowNumber === 'number' ? candidate.rowNumber : Number(candidate?.rowNumber);
    return Number.isInteger(rowNumber) && retryNumbers.has(rowNumber);
  }) as Array<Record<string, unknown>>;
}

export class ProductImportError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ProductImportError';
    this.statusCode = statusCode;
  }
}

export interface BackgroundImportJob {
  userId: string;
  filename: string;
  fileHash: string;
  mode: 'CREATE' | 'UPDATE' | 'UPSERT';
  sourceRows: RawCsvRow[];
  validatedRows: ParsedImportRow[];
  file?: Express.Multer.File;
  imagesZip?: Express.Multer.File;
}

const activeBackgroundImports = new Set<string>();

export class ProductImportService {
  shouldProcessInBackground(rowCount: number): boolean {
    return shouldProcessInBackground(rowCount);
  }

  async enqueueBackgroundImport(job: BackgroundImportJob): Promise<{ runId: string; status: 'PROCESSING'; message: string }> {
    if (job.mode === 'UPDATE' && job.imagesZip) {
      throw new ProductImportError('ZIP image imports are not supported in UPDATE mode');
    }
    if (job.mode === 'UPSERT' && job.imagesZip) {
      throw new ProductImportError('ZIP image import is not supported for UPSERT mode yet.');
    }
    if (job.validatedRows.length > IMPORT_SIZE_THRESHOLDS.MAX_SUPPORTED_ROWS) {
      throw new ProductImportError(`CSV contains more than ${IMPORT_SIZE_THRESHOLDS.MAX_SUPPORTED_ROWS} rows — split the file into smaller batches`);
    }

    const run = await prisma.importRun.create({
      data: {
        userId: job.userId,
        filename: job.filename,
        fileHash: job.fileHash,
        mode: job.mode as any,
        status: 'PROCESSING',
        totalRows: job.validatedRows.length,
        rowResults: [] as unknown as Prisma.InputJsonValue,
        sourceRows: job.sourceRows as unknown as Prisma.InputJsonValue,
      },
    });

    if (activeBackgroundImports.has(run.id)) {
      return {
        runId: run.id,
        status: 'PROCESSING',
        message: 'Import accepted and processing in the background.',
      };
    }

    activeBackgroundImports.add(run.id);
    void setImmediate(() => {
      this.processBackgroundImport(run.id, job).catch((error) => {
        console.error(`Background import failed for run ${run.id}:`, error);
      }).finally(() => {
        activeBackgroundImports.delete(run.id);
      });
    });

    return {
      runId: run.id,
      status: 'PROCESSING',
      message: 'Import accepted and processing in the background.',
    };
  }

  private async processBackgroundImport(runId: string, job: BackgroundImportJob): Promise<void> {
    const run = await prisma.importRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        status: true,
        mode: true,
        userId: true,
        filename: true,
        totalRows: true,
        rowResults: true,
      },
    });

    if (!run || run.status !== 'PROCESSING') {
      return;
    }

    const rowResults: ImportRowResult[] = Array.isArray(run.rowResults) ? run.rowResults as unknown as ImportRowResult[] : [];
    let successRows = 0;
    let warningRows = 0;
    let errorRows = 0;
    let createdProducts = 0;
    let updatedProducts = 0;
    const noZip: ImageZipIndex = { provided: false, imagesBySku: new Map(), warningsBySku: new Map(), globalWarnings: [], invalidImages: 0, skippedImages: 0 };

    try {
      const zipIndex = job.mode === 'CREATE'
        ? await indexImageZip(job.imagesZip, new Set(job.validatedRows.map((row) => row.sku).filter((sku): sku is string => !!sku)))
        : noZip;

      const skus = [...new Set(job.validatedRows.map((row) => row.sku).filter((sku): sku is string => !!sku))];
      const existing = skus.length > 0 ? await prisma.product.findMany({
        where: { sku: { in: skus } },
        select: { id: true, sku: true },
      }) : [];
      const existingSkuSet = new Set(existing.map((product) => product.sku).filter((sku): sku is string => !!sku));
      const productsBySku = new Map(existing.filter((product) => !!product.sku).map((product) => [product.sku!, product]));

      const runTask = async (row: ParsedImportRow): Promise<void> => {
        const result = job.mode === 'UPDATE'
          ? await this.processUpdateRow(row, productsBySku)
          : job.mode === 'UPSERT'
            ? (row.sku && productsBySku.has(row.sku)
              ? await this.processUpdateRow(row, productsBySku)
              : await this.processRow(row, existingSkuSet, zipIndex))
            : await this.processRow(row, existingSkuSet, zipIndex);

        rowResults.push(result);

        if (result.status === 'FAILED') {
          errorRows += 1;
        } else if (result.status === 'WARNING_CREATED' || result.status === 'WARNING_UPDATED') {
          warningRows += 1;
          if (result.status === 'WARNING_CREATED') createdProducts += 1; else updatedProducts += 1;
        } else {
          successRows += 1;
          if (result.status === 'CREATED') createdProducts += 1; else updatedProducts += 1;
        }

        await prisma.importRun.update({
          where: { id: runId },
          data: {
            successRows,
            warningRows,
            errorRows,
            rowResults: rowResults as unknown as Prisma.InputJsonValue,
          },
        });
      };

      await this.runRowsWithConcurrency(job.validatedRows, runTask, IMPORT_SIZE_THRESHOLDS.CONCURRENCY_LIMIT);

      const finalStatus = errorRows === 0
        ? 'COMPLETED'
        : successRows + warningRows > 0
          ? 'COMPLETED_WITH_ERRORS'
          : 'FAILED';

      const completed = await prisma.importRun.update({
        where: { id: runId },
        data: {
          status: finalStatus,
          successRows,
          warningRows,
          errorRows,
          rowResults: rowResults as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      if (completed.totalRows !== rowResults.length) {
        await prisma.importRun.update({
          where: { id: runId },
          data: {
            totalRows: rowResults.length,
          },
        }).catch(() => undefined);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await prisma.importRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          rowResults: [...rowResults, { rowNumber: 0, status: 'FAILED', errors: [errorMessage], warnings: [] }] as unknown as Prisma.InputJsonValue,
        },
      }).catch(() => undefined);
      throw error;
    }
  }

  private async runRowsWithConcurrency<T>(items: T[], worker: (item: T) => Promise<void>, limit: number): Promise<void> {
    const queue = [...items];
    const running: Promise<void>[] = [];

    const startNext = (): void => {
      const next = queue.shift();
      if (!next) return;
      const task = Promise.resolve(worker(next)).finally(() => {
        if (queue.length > 0) startNext();
      });
      running.push(task);
    };

    for (let i = 0; i < Math.min(limit, queue.length); i += 1) {
      startNext();
    }

    await Promise.all(running);
  }

  /**
   * Read: paginated import history, newest first (Phase 4).
   * Summary fields only — rowResults and fileHash are excluded from the
   * list; fetch a single run by id for the full detail.
   */
  async getHistory(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [runs, total] = await Promise.all([
      prisma.importRun.findMany({
        select: {
          id: true,
          filename: true,
          mode: true,
          status: true,
          totalRows: true,
          successRows: true,
          warningRows: true,
          errorRows: true,
          createdAt: true,
          completedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.importRun.count(),
    ]);

    return {
      items: runs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Read: one ImportRun with full rowResults. 404 when unknown. */
  async getRunById(id: string) {
    const run = await prisma.importRun.findUnique({
      where: { id },
      select: {
        id: true,
        filename: true,
        mode: true,
        status: true,
        totalRows: true,
        successRows: true,
        warningRows: true,
        errorRows: true,
        fileHash: true,
        createdAt: true,
        completedAt: true,
        rowResults: true,
        sourceRows: true,
      },
    });
    if (!run) throw new NotFoundError('Import run not found');
    return run;
  }

  async retryFailedRows(runId: string, userId: string) {
    const run = await prisma.importRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        userId: true,
        filename: true,
        fileHash: true,
        mode: true,
        rowResults: true,
        sourceRows: true,
      },
    });

    if (!run) throw new NotFoundError('Import run not found');

    const retryRows = getFailedRowsForRetry(run.sourceRows as unknown[] | null | undefined, run.rowResults as unknown[] | null | undefined);
    if (retryRows.length === 0) {
      return {
        originalRunId: run.id,
        runId: run.id,
        status: 'COMPLETED',
        totalRows: 0,
        successRows: 0,
        warningRows: 0,
        errorRows: 0,
        createdProducts: 0,
        updatedProducts: 0,
        rowResults: [],
        message: 'No failed rows were available to retry.',
      };
    }

    const rawRows = retryRows.map((sourceRow) => ({
      rowNumber: Number(sourceRow.rowNumber),
      cells: (sourceRow.cells ?? {}) as Record<string, string>,
      suppliedColumns: Array.isArray(sourceRow.suppliedColumns)
        ? (sourceRow.suppliedColumns as string[])
        : [],
    }));

    const mode = run.mode as 'CREATE' | 'UPDATE' | 'UPSERT';
    const matchCategory = await buildCategoryMatcher();
    const allSkus = [...new Set(rawRows.map((row) => normalizeImportSku((row.cells as Record<string, string>).sku ?? '')).filter((sku): sku is string => !!sku))];
    const existing = allSkus.length > 0 ? await prisma.product.findMany({
      where: { sku: { in: allSkus } },
      select: { id: true, sku: true },
    }) : [];
    const productsBySku = new Map(existing.filter((product) => !!product.sku).map((product) => [product.sku!, product]));

    const validatedRows = mode === 'UPDATE'
      ? validateRows(rawRows as any, matchCategory, 'UPDATE')
      : mode === 'UPSERT'
        ? validateUpsertRows(rawRows as any, matchCategory, new Set(productsBySku.keys()))
        : validateRows(rawRows as any, matchCategory, 'CREATE');

    const retryRun = await prisma.importRun.create({
      data: {
        userId,
        filename: `${run.filename} (retry)`,
        fileHash: run.fileHash,
        mode,
        status: 'PROCESSING',
        totalRows: validatedRows.length,
        rowResults: [],
        sourceRows: rawRows as unknown as Prisma.InputJsonValue,
      },
    });

    try {
      const noZip: ImageZipIndex = { provided: false, imagesBySku: new Map(), warningsBySku: new Map(), globalWarnings: [], invalidImages: 0, skippedImages: 0 };
      const rowResults: ImportRowResult[] = [];
      let successRows = 0;
      let warningRows = 0;
      let errorRows = 0;
      let createdProducts = 0;
      let updatedProducts = 0;

      for (const row of validatedRows) {
        const result = mode === 'UPDATE'
          ? await this.processUpdateRow(row, productsBySku)
          : mode === 'UPSERT'
            ? (row.sku && productsBySku.has(row.sku)
              ? await this.processUpdateRow(row, productsBySku)
              : await this.processRow(row, new Set(), noZip))
            : await this.processRow(row, new Set(productsBySku.keys()), noZip);

        rowResults.push(result);
        if (result.status === 'FAILED') {
          errorRows += 1;
        } else if (result.status === 'WARNING_CREATED' || result.status === 'WARNING_UPDATED') {
          warningRows += 1;
          if (result.status === 'WARNING_CREATED') createdProducts += 1; else updatedProducts += 1;
        } else {
          successRows += 1;
          if (result.status === 'CREATED') createdProducts += 1; else updatedProducts += 1;
        }
      }

      const status = errorRows === 0 ? 'COMPLETED' : successRows + warningRows > 0 ? 'COMPLETED_WITH_ERRORS' : 'FAILED';
      const finalized = await prisma.importRun.update({
        where: { id: retryRun.id },
        data: {
          status,
          successRows,
          warningRows,
          errorRows,
          rowResults: rowResults as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      return {
        originalRunId: run.id,
        runId: finalized.id,
        status,
        totalRows: validatedRows.length,
        successRows,
        warningRows,
        errorRows,
        createdProducts,
        updatedProducts,
        rowResults,
        message: `Retry processed ${validatedRows.length} failed rows for ${mode.toLowerCase()} import.`,
      };
    } catch (error) {
      await prisma.importRun.update({
        where: { id: retryRun.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          rowResults: { fatalError: error instanceof Error ? error.message : String(error) },
        },
      }).catch(() => undefined);
      throw error;
    }
  }

  /**
   * Execute a CREATE-mode CSV import for an admin user.
   * Throws ProductImportError (clean 4xx) for structurally bad input —
   * those cases never create a run; row-level problems never throw.
   */
  async importCreateCsv(file: Express.Multer.File, userId: string, imagesZip?: Express.Multer.File): Promise<ImportRunResult> {
    if (!file) throw new ProductImportError('No CSV file uploaded (field name: "file")');

    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const csvText = Buffer.from(file.buffer).toString('utf-8');
    let parsed: ReturnType<typeof parseCsv>;
    try {
      parsed = parseCsv(csvText);
    } catch (error) {
      if (error instanceof CsvParseError) throw new ProductImportError(error.message, 400);
      throw error;
    }

    const matchCategory = await buildCategoryMatcher();
    const validatedRows = validateRows(parsed.rows, matchCategory);
    let zipIndex: ImageZipIndex;
    try {
      zipIndex = await indexImageZip(imagesZip, new Set(validatedRows.map((row) => row.sku).filter((sku): sku is string => !!sku)));
    } catch (error) {
      throw new ProductImportError(error instanceof Error ? error.message : 'Invalid ZIP image archive');
    }

    const run = await prisma.importRun.create({
      data: {
        userId,
        filename: file.originalname || 'upload.csv',
        fileHash,
        mode: 'CREATE',
        status: 'PROCESSING',
        totalRows: validatedRows.length,
        rowResults: [],
        sourceRows: parsed.rows as unknown as Prisma.InputJsonValue,
      },
    });

    try {
      const skus = [...new Set(validatedRows.map((row) => row.sku).filter((sku): sku is string => !!sku))];
      const existing = skus.length > 0 ? await prisma.product.findMany({ where: { sku: { in: skus } }, select: { sku: true } }) : [];
      const existingSkuSet = new Set(existing.map((product) => product.sku));
      const rowResults: ImportRowResult[] = [];
      let successRows = 0;
      let warningRows = 0;
      let errorRows = 0;

      for (const row of validatedRows) {
        const result = await this.processRow(row, existingSkuSet, zipIndex);
        rowResults.push(result);
        if (result.status === 'FAILED') errorRows += 1;
        else if (result.status === 'WARNING_CREATED') warningRows += 1;
        else successRows += 1;
      }

      const status = errorRows === 0 ? 'COMPLETED' : successRows + warningRows > 0 ? 'COMPLETED_WITH_ERRORS' : 'FAILED';
      const finalized = await prisma.importRun.update({
        where: { id: run.id },
        data: {
          status,
          successRows,
          warningRows,
          errorRows,
          rowResults: rowResults as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      return {
        runId: finalized.id,
        status,
        totalRows: validatedRows.length,
        successRows,
        warningRows,
        errorRows,
        createdProducts: successRows + warningRows,
        updatedProducts: 0,
        imagesUploaded: rowResults.reduce((count, row) => count + (row.imagesUploaded || 0), 0),
        imagesSkipped: zipIndex.skippedImages,
        imagesInvalid: zipIndex.invalidImages,
        imageWarnings: zipIndex.globalWarnings,
        rowResults,
      };
    } catch (error) {
      await prisma.importRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          rowResults: {
            fatalError: error instanceof Error ? error.message : String(error),
          },
        },
      }).catch(() => undefined);
      throw error;
    }
  }

  /** Execute a CSV-only partial UPDATE import.  ZIP/image replacement is
   * intentionally unsupported: update rows only touch supplied canonical
   * product fields and each Prisma update is a single atomic statement. */
  async importUpdateCsv(file: Express.Multer.File, userId: string, imagesZip?: Express.Multer.File): Promise<ImportRunResult> {
    if (!file) throw new ProductImportError('No CSV file uploaded (field name: "file")');
    if (imagesZip) throw new ProductImportError('ZIP image imports are not supported in UPDATE mode');
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    let parsed: ReturnType<typeof parseCsv>;
    try { parsed = parseCsv(Buffer.from(file.buffer).toString('utf-8'), 'UPDATE'); }
    catch (error) { if (error instanceof CsvParseError) throw new ProductImportError(error.message); throw error; }
    const validatedRows = validateRows(parsed.rows, await buildCategoryMatcher(), 'UPDATE');
    const run = await prisma.importRun.create({
      data: {
        userId,
        filename: file.originalname || 'upload.csv',
        fileHash,
        mode: 'UPDATE',
        status: 'PROCESSING',
        totalRows: validatedRows.length,
        rowResults: [],
        sourceRows: parsed.rows as unknown as Prisma.InputJsonValue,
      },
    });

    try {
      const existing = await prisma.product.findMany({
        where: { sku: { in: [...new Set(validatedRows.map((row) => row.sku).filter((sku): sku is string => !!sku))] } },
        select: { id: true, sku: true },
      });
      const productsBySku = new Map(existing.map((product) => [product.sku!, product]));
      const rowResults: ImportRowResult[] = [];
      let successRows = 0;
      let warningRows = 0;
      let errorRows = 0;

      for (const row of validatedRows) {
        const result = await this.processUpdateRow(row, productsBySku);
        rowResults.push(result);
        if (result.status === 'FAILED') errorRows++;
        else if (result.status === 'WARNING_UPDATED') warningRows++;
        else successRows++;
      }

      const status = errorRows === 0 ? 'COMPLETED' : successRows + warningRows > 0 ? 'COMPLETED_WITH_ERRORS' : 'FAILED';
      const finalized = await prisma.importRun.update({
        where: { id: run.id },
        data: {
          status,
          successRows,
          warningRows,
          errorRows,
          rowResults: rowResults as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      return {
        runId: finalized.id,
        status,
        totalRows: validatedRows.length,
        successRows,
        warningRows,
        errorRows,
        createdProducts: 0,
        updatedProducts: successRows + warningRows,
        imagesUploaded: 0,
        imagesSkipped: 0,
        imagesInvalid: 0,
        imageWarnings: [],
        rowResults,
      };
    } catch (error) {
      await prisma.importRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', completedAt: new Date(), rowResults: { fatalError: error instanceof Error ? error.message : String(error) } },
      }).catch(() => undefined);
      throw error;
    }
  }

  /** CSV-only UPSERT. Existing SKUs take the proven UPDATE path; unknown
   * SKUs take the strict CREATE path. Duplicate CSV SKUs are validation
   * errors, so a row can never switch branches mid-run. */
  async importUpsertCsv(file: Express.Multer.File, userId: string, imagesZip?: Express.Multer.File): Promise<ImportRunResult> {
    if (!file) throw new ProductImportError('No CSV file uploaded (field name: "file")');
    if (imagesZip) throw new ProductImportError('ZIP image import is not supported for UPSERT mode yet.');
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    let parsed: ReturnType<typeof parseCsv>;
    try { parsed = parseCsv(Buffer.from(file.buffer).toString('utf-8'), 'UPSERT'); }
    catch (error) { if (error instanceof CsvParseError) throw new ProductImportError(error.message); throw error; }

    const skus = [...new Set(parsed.rows.map((row) => normalizeImportSku(row.cells.sku ?? '')).filter((sku): sku is string => !!sku))];
    const existing: Array<{ id: string; sku: string | null }> = skus.length
      ? await prisma.product.findMany({ where: { sku: { in: skus } }, select: { id: true, sku: true } })
      : [];
    const productsBySku = new Map<string, { id: string; sku: string | null }>(existing.filter((product) => !!product.sku).map((product) => [product.sku!, product]));
    const validatedRows = validateUpsertRows(parsed.rows, await buildCategoryMatcher(), new Set(productsBySku.keys()));
    const run = await prisma.importRun.create({
      data: {
        userId,
        filename: file.originalname || 'upload.csv',
        fileHash,
        mode: 'UPSERT',
        status: 'PROCESSING',
        totalRows: validatedRows.length,
        rowResults: [],
        sourceRows: parsed.rows as unknown as Prisma.InputJsonValue,
      },
    });

    try {
      const noZip: ImageZipIndex = { provided: false, imagesBySku: new Map(), warningsBySku: new Map(), globalWarnings: [], invalidImages: 0, skippedImages: 0 };
      const rowResults: ImportRowResult[] = [];
      let successRows = 0;
      let warningRows = 0;
      let errorRows = 0;
      let createdProducts = 0;
      let updatedProducts = 0;
      for (const row of validatedRows) {
        const result = row.sku && productsBySku.has(row.sku)
          ? await this.processUpdateRow(row, productsBySku)
          : await this.processRow(row, new Set(), noZip);
        rowResults.push(result);
        if (result.status === 'FAILED') errorRows++;
        else {
          if (result.status === 'WARNING_CREATED' || result.status === 'WARNING_UPDATED') warningRows++; else successRows++;
          if (result.status === 'CREATED' || result.status === 'WARNING_CREATED') createdProducts++; else updatedProducts++;
        }
      }
      const status = errorRows === 0 ? 'COMPLETED' : successRows + warningRows > 0 ? 'COMPLETED_WITH_ERRORS' : 'FAILED';
      const finalized = await prisma.importRun.update({
        where: { id: run.id },
        data: { status, successRows, warningRows, errorRows, rowResults: rowResults as unknown as Prisma.InputJsonValue, completedAt: new Date() },
      });
      return {
        runId: finalized.id,
        status,
        totalRows: validatedRows.length,
        successRows,
        warningRows,
        errorRows,
        createdProducts,
        updatedProducts,
        imagesUploaded: 0,
        imagesSkipped: 0,
        imagesInvalid: 0,
        imageWarnings: [],
        rowResults,
      };
    } catch (error) {
      await prisma.importRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', completedAt: new Date(), rowResults: { fatalError: error instanceof Error ? error.message : String(error) } },
      }).catch(() => undefined);
      throw error;
    }
  }

  private async processUpdateRow(row: ParsedImportRow, productsBySku: Map<string, { id: string; sku: string | null }>): Promise<ImportRowResult> {
    const base: ImportRowResult = { rowNumber: row.rowNumber, sku: row.sku, status: row.warnings.length ? 'WARNING_UPDATED' : 'UPDATED', errors: [], warnings: [...row.warnings] };
    if (row.errors.length > 0 || row.status === 'ERROR') return { ...base, status: 'FAILED', errors: row.errors };
    const existing = row.sku ? productsBySku.get(row.sku) : undefined;
    if (!existing) return { ...base, status: 'FAILED', errors: [`No product found with SKU "${row.sku || row.rawSku}"`] };
    const { category, ...fields } = row.values;
    const data: Prisma.ProductUpdateInput = { ...fields } as Prisma.ProductUpdateInput;
    if (category) data.category = { connect: { id: category as string } };
    try {
      const product = await prisma.product.update({ where: { id: existing.id }, data });
      return { ...base, productId: product.id };
    } catch (error: any) {
      return { ...base, status: 'FAILED', errors: [error?.message || 'Product update failed'] };
    }
  }

  private async processRow(row: ParsedImportRow, existingSkuSet: Set<string>, zipIndex: ImageZipIndex): Promise<ImportRowResult> {
    const base: ImportRowResult = {
      rowNumber: row.rowNumber,
      sku: row.sku,
      status: 'CREATED',
      errors: [],
      warnings: [...row.warnings, ...(row.sku ? zipIndex.warningsBySku.get(row.sku) || [] : [])],
    };

    if (row.errors.length > 0 || row.status === 'ERROR') {
      return { ...base, status: 'FAILED', errors: row.errors };
    }

    if (row.sku && existingSkuSet.has(row.sku)) {
      return {
        ...base,
        status: 'FAILED',
        errors: [`A product with SKU "${row.sku}" already exists`],
      };
    }

    if (base.warnings.length > 0) base.status = 'WARNING_CREATED';

    try {
      const v = row.values;
      const product = await productService.createProduct({
        sku: row.sku,
        name: v.name as string,
        description: v.description as string,
        price: v.price as number,
        estimatedPriceUsd: v.estimatedPriceUsd as number,
        condition: v.condition as string,
        seller: v.seller as string,
        sellerType: v.sellerType as string,
        source: v.source as string,
        domesticShipping: v.domesticShipping as number,
        internationalShippingUsd: v.internationalShippingUsd as number,
        serviceFee: v.serviceFee as number,
        categoryId: v.category as string,
        tags: (v.tags as string[]) || [],
        isNew: (v.isNew as boolean) || false,
        isBestSeller: (v.isBestSeller as boolean) || false,
        stock: (v.stock as number) ?? 1,
        isAvailable: (v.isAvailable as boolean) ?? true,
      });
      const imageResult = await this.attachImages(product.id, row, zipIndex.imagesBySku.get(row.sku || '') || [], zipIndex.provided);
      if (imageResult.warnings.length > 0) {
        base.warnings.push(...imageResult.warnings);
        base.status = 'WARNING_CREATED';
      }
      return { ...base, productId: product.id, imagesUploaded: imageResult.uploaded };
    } catch (error: any) {
      return {
        ...base,
        status: 'FAILED',
        errors: [error?.message || 'Product creation failed'],
      };
    }
  }

  private async attachImages(productId: string, row: ParsedImportRow, images: ZipImage[], zipProvided: boolean): Promise<{ uploaded: number; warnings: string[] }> {
    const warnings: string[] = [];
    const byPosition = new Map(images.map((image) => [image.position, image]));
    for (let position = 1; zipProvided && position <= 5; position++) {
      if (row.values[`image${position}` as keyof typeof row.values] && !byPosition.has(position)) {
        warnings.push(`image${position} file not found in ZIP`);
      }
    }
    if (images.length === 0) return { uploaded: 0, warnings };

    const uploaded: Array<{ id: string }> = [];
    try {
      for (const image of [...images].sort((a, b) => a.position - b.position)) {
        uploaded.push(await productImageStorage.uploadProductImage(productId, image.buffer, image.filename, image.mimetype));
      }
      return { uploaded: uploaded.length, warnings };
    } catch (error: any) {
      await Promise.all(uploaded.map((image) => productImageStorage.deleteProductImage(productId, image.id).catch(() => undefined)));
      warnings.push(`Images were not attached: ${error?.message || 'image upload failed'}`);
      return { uploaded: 0, warnings };
    }
  }
}

export default new ProductImportService();

import { Prisma } from '@prisma/client';
import prisma from '../../../config/database';
import { BadRequestError } from '../../../utils/errors';
import cjProductsService from './cj-products';
import cjMapperService from './cj-mapper';
import productService from '../../product.service';
import { IMPORT_SIZE_THRESHOLDS } from '../../import/import-thresholds';

const CJ_PAGE_SIZE = 100;
const CONCURRENCY_LIMIT = 3;
const PROGRESS_UPDATE_INTERVAL = 10;

export interface CJCategoryImportRow {
  cjProductId: string;
  productName: string;
  status: 'SUCCESS' | 'SKIPPED_DUPLICATE' | 'WARNING' | 'FAILED';
  emartProductId?: string;
  error?: string;
  warnings: string[];
}

export interface CJCategoryImportResult {
  runId: string;
  status: 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED';
  totalRows: number;
  successRows: number;
  warningRows: number;
  errorRows: number;
  skippedRows: number;
  rowResults: CJCategoryImportRow[];
}

interface CJCategoryImportOptions {
  emartCategoryId: string;
  priceMarkupPercent?: number;
}

export class CJCategoryImportService {
  async startCategoryImport(
    cjCategoryId: string,
    options: CJCategoryImportOptions,
    userId: string
  ): Promise<{ runId: string; status: 'PROCESSING' }> {
    const category = await prisma.category.findUnique({
      where: { id: options.emartCategoryId },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestError('EMART category not found');
    }

    const run = await prisma.importRun.create({
      data: {
        userId,
        filename: `CJ Category Import - ${cjCategoryId}`,
        fileHash: `cj-category-${cjCategoryId}-${Date.now()}`,
        mode: 'CREATE' as any,
        status: 'PROCESSING',
        totalRows: 0,
        rowResults: [],
        sourceRows: {
          kind: 'cj-category',
          cjCategoryId,
          emartCategoryId: options.emartCategoryId,
          priceMarkupPercent: options.priceMarkupPercent,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    void setImmediate(() => {
      this.processCategoryImport(run.id, cjCategoryId, options).catch((error) => {
        console.error(`CJ category import failed for run ${run.id}:`, error);
      });
    });

    return { runId: run.id, status: 'PROCESSING' };
  }

  private async processCategoryImport(
    runId: string,
    cjCategoryId: string,
    options: CJCategoryImportOptions
  ): Promise<void> {
    const rowResults: CJCategoryImportRow[] = [];
    let successRows = 0;
    let warningRows = 0;
    let errorRows = 0;
    let skippedRows = 0;
    let totalDiscovered = 0;

    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const cjResult = await cjProductsService.searchProducts({
          categoryId: cjCategoryId,
          page,
          pageSize: CJ_PAGE_SIZE,
        });

        const products = cjResult.list;
        if (products.length === 0) {
          hasMore = false;
          break;
        }

        totalDiscovered += products.length;

        await prisma.importRun.update({
          where: { id: runId },
          data: { totalRows: totalDiscovered },
        });

        const processProduct = async (cjProduct: typeof products[number]): Promise<void> => {
          const result = await this.processSingleProduct(cjProduct.id, cjProduct.nameEn, options);
          rowResults.push(result);

          if (result.status === 'SUCCESS') successRows++;
          else if (result.status === 'WARNING') warningRows++;
          else if (result.status === 'SKIPPED_DUPLICATE') skippedRows++;
          else errorRows++;

          const processedCount = successRows + warningRows + errorRows + skippedRows;
          if (processedCount % PROGRESS_UPDATE_INTERVAL === 0) {
            await prisma.importRun.update({
              where: { id: runId },
              data: {
                successRows,
                warningRows,
                errorRows,
                rowResults: rowResults as unknown as Prisma.InputJsonValue,
              },
            }).catch(() => undefined);
          }
        };

        await this.runWithConcurrency(products, processProduct, CONCURRENCY_LIMIT);

        if (cjResult.total && totalDiscovered >= cjResult.total) {
          hasMore = false;
        } else if (products.length < CJ_PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
        }
      }

      const finalStatus = errorRows === 0
        ? 'COMPLETED'
        : successRows + warningRows > 0
          ? 'COMPLETED_WITH_ERRORS'
          : 'FAILED';

      await prisma.importRun.update({
        where: { id: runId },
        data: {
          status: finalStatus,
          totalRows: totalDiscovered,
          successRows,
          warningRows,
          errorRows,
          rowResults: rowResults as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await prisma.importRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          rowResults: [...rowResults, {
            cjProductId: 'N/A',
            productName: 'Import aborted',
            status: 'FAILED',
            error: errorMessage,
            warnings: [],
          }] as unknown as Prisma.InputJsonValue,
        },
      }).catch(() => undefined);
      throw error;
    }
  }

  private async processSingleProduct(
    cjProductId: string,
    productName: string,
    options: CJCategoryImportOptions
  ): Promise<CJCategoryImportRow> {
    const base: CJCategoryImportRow = {
      cjProductId,
      productName,
      status: 'SUCCESS',
      warnings: [],
    };

    try {
      const existing = await prisma.product.findUnique({
        where: { externalProductId: cjProductId },
        select: { id: true },
      });

      if (existing) {
        return {
          ...base,
          status: 'SKIPPED_DUPLICATE',
          emartProductId: existing.id,
        };
      }

      const normalizedProduct = await cjMapperService.fetchNormalizedProduct(cjProductId);

      const productData = await cjMapperService.mapToEMARTProduct(normalizedProduct, {
        categoryId: options.emartCategoryId,
        priceMarkupPercent: options.priceMarkupPercent,
      });

      const product = await productService.createProduct(productData);

      const uploaded = await cjMapperService.importImages(product.id, normalizedProduct.images);
      if (uploaded < normalizedProduct.images.length) {
        base.warnings.push(`Only ${uploaded}/${normalizedProduct.images.length} images uploaded`);
        base.status = 'WARNING';
      }

      return {
        ...base,
        status: base.warnings.length > 0 ? 'WARNING' : 'SUCCESS',
        emartProductId: product.id,
      };
    } catch (error: any) {
      return {
        ...base,
        status: 'FAILED',
        error: error?.message || 'Unknown error',
      };
    }
  }

  private async runWithConcurrency<T>(
    items: T[],
    worker: (item: T) => Promise<void>,
    limit: number
  ): Promise<void> {
    let nextIndex = 0;
    const runWorker = async (): Promise<void> => {
      while (nextIndex < items.length) {
        const item = items[nextIndex++];
        await worker(item);
      }
    };

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
  }

  async retryFailedProducts(runId: string, userId: string): Promise<CJCategoryImportResult> {
    const run = await prisma.importRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        userId: true,
        filename: true,
        rowResults: true,
        sourceRows: true,
      },
    });

    if (!run) throw new BadRequestError('Import run not found');

    const savedOptions = (run.sourceRows ?? null) as {
      emartCategoryId?: string;
      priceMarkupPercent?: number;
    } | null;

    if (!savedOptions?.emartCategoryId) {
      throw new BadRequestError(
        'This run has no stored EMART category. Start a fresh category import instead so products land in the right category.'
      );
    }

    const importOptions: CJCategoryImportOptions = {
      emartCategoryId: savedOptions.emartCategoryId,
      priceMarkupPercent: savedOptions.priceMarkupPercent,
    };

    const failedProducts = (run.rowResults as unknown as CJCategoryImportRow[])
      .filter(r => r.status === 'FAILED');

    if (failedProducts.length === 0) {
      return {
        runId: run.id,
        status: 'COMPLETED',
        totalRows: 0,
        successRows: 0,
        warningRows: 0,
        errorRows: 0,
        skippedRows: 0,
        rowResults: [],
      };
    }

    const retryRun = await prisma.importRun.create({
      data: {
        userId,
        filename: `${run.filename} (retry)`,
        fileHash: `cj-retry-${runId}-${Date.now()}`,
        mode: 'CREATE' as any,
        status: 'PROCESSING',
        totalRows: failedProducts.length,
        rowResults: [],
        sourceRows: {
          kind: 'cj-category-retry',
          retryOf: runId,
          ...(savedOptions || {}),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    const rowResults: CJCategoryImportRow[] = [];
    let successRows = 0;
    let warningRows = 0;
    let errorRows = 0;
    let skippedRows = 0;

    for (const failed of failedProducts) {
      const result = await this.processSingleProduct(
        failed.cjProductId,
        failed.productName,
        importOptions
      );
      rowResults.push(result);

      if (result.status === 'SUCCESS') successRows++;
      else if (result.status === 'WARNING') warningRows++;
      else if (result.status === 'SKIPPED_DUPLICATE') skippedRows++;
      else errorRows++;
    }

    const status = errorRows === 0
      ? 'COMPLETED'
      : successRows + warningRows > 0
        ? 'COMPLETED_WITH_ERRORS'
        : 'FAILED';

    await prisma.importRun.update({
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
      runId: retryRun.id,
      status,
      totalRows: failedProducts.length,
      successRows,
      warningRows,
      errorRows,
      skippedRows,
      rowResults,
    };
  }
}

export default new CJCategoryImportService();

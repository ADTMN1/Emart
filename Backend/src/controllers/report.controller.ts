import { Request, Response, NextFunction } from 'express';
import reportService from '../services/report.service';
import { sendSuccess } from '../utils/response';

/**
 * Sales reports / analytics (Phase 4). ADMIN-only — all calculations are
 * aggregate business data; no customer PII is returned by any endpoint.
 */
class ReportController {
  /** GET /api/v1/admin/reports/sales/overview */
  async getSalesOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getOverview(req.query as Record<string, string>);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/admin/reports/sales/trend */
  async getSalesTrend(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getTrend(req.query as Record<string, string>);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/admin/reports/sales/products */
  async getSalesProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getTopProducts(req.query as Record<string, string>, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
      });
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }
  /** GET /api/v1/admin/reports/sales/categories */
  async getSalesCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getTopCategories(req.query as Record<string, string>, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
      });
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/admin/reports/sales/orders — order-status breakdown */
  async getSalesOrdersBreakdown(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getStatusBreakdown(req.query as Record<string, string>);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/admin/reports/sales/payments — payment-status breakdown */
  async getSalesPaymentsBreakdown(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getPaymentBreakdown(req.query as Record<string, string>);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export default new ReportController();

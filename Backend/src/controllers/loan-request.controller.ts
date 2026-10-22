import { Request, Response, NextFunction } from 'express';
import loanRequestService from '../services/loan-request.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';

export class LoanRequestController {
  /**
   * POST /loans - Customer submits a loan request
   */
  async submitLoanRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { requestedAmount, loanPurpose, repaymentPeriod } = req.body;
      const customerId = req.user!.id;

      const loanRequest = await loanRequestService.createLoanRequest(customerId, {
        requestedAmount,
        loanPurpose,
        repaymentPeriod,
      });

      sendSuccess(res, loanRequest, 'Loan request submitted successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /loans - Customer lists their loan requests
   */
  async getCustomerLoanRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const { status, page, limit } = req.query;

      const result = await loanRequestService.getCustomerLoanRequests(customerId, {
        status: status as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      sendSuccess(res, result, 'Loan requests retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /loans/:id - Customer gets a specific loan request
   */
  async getCustomerLoanRequestById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const { id } = req.params;

      const loanRequest = await loanRequestService.getCustomerLoanRequestById(customerId, id);

      sendSuccess(res, loanRequest, 'Loan request retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/loans - Admin lists all loan requests
   */
  async getAdminLoanRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, page, limit } = req.query;

      const result = await loanRequestService.getAdminLoanRequests({
        status: status as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      sendSuccess(res, result, 'Loan requests retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/loans/:id - Admin gets loan request details
   */
  async getAdminLoanRequestById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const loanRequest = await loanRequestService.getAdminLoanRequestById(id);

      sendSuccess(res, loanRequest, 'Loan request retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/loans/:id/decide - Admin approves or rejects a loan request
   */
  async decideLoanRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const { id } = req.params;
      const { decision, decisionNote } = req.body;

      const loanRequest = await loanRequestService.decideLoanRequest(adminId, id, {
        decision,
        decisionNote,
      });

      sendSuccess(res, loanRequest, `Loan request ${decision.toLowerCase()} successfully`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/loans/stats - Admin gets loan request statistics
   */
  async getLoanRequestStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await loanRequestService.getLoanRequestStats();
      sendSuccess(res, stats, 'Loan request statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new LoanRequestController();
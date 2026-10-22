import { Router } from 'express';
import loanRequestController from '../controllers/loan-request.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import {
  loanRequestQueryValidation,
  loanRequestIdParamValidation,
  adminLoanDecisionValidation,
} from '../middleware/validations/loan.validation';

const router = Router();

// All admin loan routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN'));

/**
 * GET /admin/loans/stats - Get loan request statistics
 */
router.get(
  '/stats',
  loanRequestController.getLoanRequestStats.bind(loanRequestController)
);

/**
 * GET /admin/loans - List all loan requests (admin)
 */
router.get(
  '/',
  loanRequestQueryValidation,
  validate,
  loanRequestController.getAdminLoanRequests.bind(loanRequestController)
);

/**
 * GET /admin/loans/:id - Get loan request details (admin)
 */
router.get(
  '/:id',
  loanRequestIdParamValidation,
  validate,
  loanRequestController.getAdminLoanRequestById.bind(loanRequestController)
);

/**
 * POST /admin/loans/:id/decide - Approve or reject a loan request
 */
router.post(
  '/:id/decide',
  loanRequestIdParamValidation,
  adminLoanDecisionValidation,
  validate,
  loanRequestController.decideLoanRequest.bind(loanRequestController)
);

export default router;
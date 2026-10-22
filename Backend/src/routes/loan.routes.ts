import { Router } from 'express';
import loanRequestController from '../controllers/loan-request.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import {
  submitLoanRequestValidation,
  loanRequestQueryValidation,
  loanRequestIdParamValidation,
} from '../middleware/validations/loan.validation';

const router = Router();

// All customer loan routes require authentication
router.use(authenticate);
// Customers only (not sellers or admins)
router.use(authorize('CUSTOMER'));

/**
 * POST /loans - Submit a new loan request
 */
router.post(
  '/',
  submitLoanRequestValidation,
  validate,
  loanRequestController.submitLoanRequest.bind(loanRequestController)
);

/**
 * GET /loans - List customer's loan requests
 */
router.get(
  '/',
  loanRequestQueryValidation,
  validate,
  loanRequestController.getCustomerLoanRequests.bind(loanRequestController)
);

/**
 * GET /loans/:id - Get a specific loan request
 */
router.get(
  '/:id',
  loanRequestIdParamValidation,
  validate,
  loanRequestController.getCustomerLoanRequestById.bind(loanRequestController)
);

export default router;
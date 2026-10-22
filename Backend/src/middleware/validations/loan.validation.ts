import { body, query, param } from 'express-validator';

export const submitLoanRequestValidation = [
  body('requestedAmount')
    .isFloat({ min: 1 })
    .withMessage('Requested amount must be at least $1.00'),
  body('loanPurpose')
    .trim()
    .notEmpty()
    .withMessage('Loan purpose is required')
    .isLength({ max: 500 })
    .withMessage('Loan purpose must be less than 500 characters'),
  body('repaymentPeriod')
    .optional()
    .isInt({ min: 1, max: 120 })
    .withMessage('Repayment period must be between 1 and 120 months'),
];

export const loanRequestQueryValidation = [
  query('status')
    .optional()
    .isIn(['PENDING', 'APPROVED', 'REJECTED'])
    .withMessage('Invalid status filter'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

export const adminLoanDecisionValidation = [
  body('decision')
    .isIn(['APPROVED', 'REJECTED'])
    .withMessage('Decision must be APPROVED or REJECTED'),
  body('decisionNote')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Decision note must be less than 1000 characters'),
];

export const loanRequestIdParamValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid loan request ID'),
];
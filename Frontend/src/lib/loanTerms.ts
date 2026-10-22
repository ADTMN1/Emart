// Display-only loan cost helpers.
//
// These mirror the authoritative backend rules in
// Backend/src/services/loan-request.service.ts:
//   INTEREST_RATE        = 0.001  (0.1%, one-time charge on the original principal)
//   PENALTY_RATE_PER_DAY = 0.01   (1% of the unpaid principal per overdue day)
//   roundToTwoDecimals(v) = Math.round(v * 100) / 100
//
// The backend remains authoritative at submission, approval and repayment;
// these values are estimates for the customer only.

export const LOAN_INTEREST_RATE = 0.001;
export const LOAN_PENALTY_RATE_PER_DAY = 0.01;

export interface LoanEstimate {
  principal: number;
  interestAmount: number;
  totalBeforePenalties: number;
  /** One day of late penalty measured on the principal entered (the penalty base is the unpaid principal). */
  estimatedDailyPenalty: number;
}

export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateLoanInterest(principal: number): number {
  return roundToTwoDecimals(principal * LOAN_INTEREST_RATE);
}

export function calculateLoanEstimate(principal: number): LoanEstimate {
  const interestAmount = calculateLoanInterest(principal);
  return {
    principal,
    interestAmount,
    totalBeforePenalties: roundToTwoDecimals(principal + interestAmount),
    estimatedDailyPenalty: roundToTwoDecimals(principal * LOAN_PENALTY_RATE_PER_DAY),
  };
}

/** Safely parse a loan amount input; returns null for empty/invalid/non-positive values. */
export function parseLoanAmount(value: string): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

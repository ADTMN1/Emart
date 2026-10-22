import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOAN_INTEREST_RATE,
  LOAN_PENALTY_RATE_PER_DAY,
  calculateLoanInterest,
  calculateLoanEstimate,
  parseLoanAmount,
  roundToTwoDecimals,
} from './loanTerms';

describe('loanTerms - backend-mirrored display calculations', () => {
  it('should use the backend rates: 0.1% interest and 1% penalty per overdue day', () => {
    // Mirrors Backend/src/services/loan-request.service.ts:
    //   INTEREST_RATE = 0.001, PENALTY_RATE_PER_DAY = 0.01
    assert.equal(LOAN_INTEREST_RATE, 0.001);
    assert.equal(LOAN_PENALTY_RATE_PER_DAY, 0.01);
  });

  it('should calculate 0.1% interest on a 10,000 ETB principal = 10 ETB', () => {
    assert.equal(calculateLoanInterest(10000), 10);
  });

  it('should produce the backend estimate breakdown for 10,000 ETB', () => {
    // Matches backend: principal 10000, interest 10, total before penalties 10010
    const estimate = calculateLoanEstimate(10000);
    assert.equal(estimate.principal, 10000);
    assert.equal(estimate.interestAmount, 10);
    assert.equal(estimate.totalBeforePenalties, 10010);
    // 1% of the entered principal as a per-day penalty indicator
    assert.equal(estimate.estimatedDailyPenalty, 100);
  });

  it('should update the estimate when the principal changes', () => {
    const estimate = calculateLoanEstimate(20000);
    assert.equal(estimate.interestAmount, 20);
    assert.equal(estimate.totalBeforePenalties, 20020);
    assert.equal(estimate.estimatedDailyPenalty, 200);
  });

  it('should round monetary values to 2 decimals like the backend', () => {
    // Backend: roundToTwoDecimals(x) = Math.round(x * 100) / 100
    assert.equal(roundToTwoDecimals(10000.123 * 0.001), 10);
    assert.equal(calculateLoanEstimate(10000.123).totalBeforePenalties, 10010.12);
  });

  it('should handle small principals safely', () => {
    const estimate = calculateLoanEstimate(100);
    assert.equal(estimate.interestAmount, 0.1);
    assert.equal(estimate.totalBeforePenalties, 100.1);
    assert.equal(estimate.estimatedDailyPenalty, 1);
  });

  it('should never include penalties or interest inside the estimate totals (no compounding)', () => {
    const estimate = calculateLoanEstimate(10000);
    // Estimate total = principal + interest only; penalties are extra and
    // accrue per overdue day on the unpaid principal (backend rule)
    assert.equal(estimate.totalBeforePenalties, estimate.principal + estimate.interestAmount);
    assert.equal(estimate.estimatedDailyPenalty, calculateLoanEstimate(estimate.principal).estimatedDailyPenalty);
  });

  describe('parseLoanAmount - safe input handling', () => {
    it('should accept valid positive numeric amounts', () => {
      assert.equal(parseLoanAmount('10000'), 10000);
      assert.equal(parseLoanAmount(' 10000.5 '), 10000.5);
      assert.equal(parseLoanAmount('1'), 1);
    });

    it('should reject empty, blank, invalid and non-positive amounts', () => {
      assert.equal(parseLoanAmount(''), null);
      assert.equal(parseLoanAmount('   '), null);
      assert.equal(parseLoanAmount('abc'), null);
      assert.equal(parseLoanAmount('NaN'), null);
      assert.equal(parseLoanAmount('Infinity'), null);
      assert.equal(parseLoanAmount('0'), null);
      assert.equal(parseLoanAmount('-5'), null);
    });
  });
});

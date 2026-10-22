import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { LoanRequestService } from './loan-request.service';
import prisma from '../config/database';
import { BadRequestError, ForbiddenError } from '../utils/errors';

describe('LoanRequestService - Financial Calculations', () => {
  let service: LoanRequestService;
  const REFERENCE_DATE = new Date('2027-01-01');
  const REFERENCE_TIME = REFERENCE_DATE.getTime();

  beforeEach(() => {
    service = new LoanRequestService();
  });

  function withMockDate(fn: () => void) {
    const originalNow = Date.now;
    (global.Date as any).now = () => REFERENCE_TIME;
    try {
      fn();
    } finally {
      (global.Date as any).now = originalNow;
    }
  }

  function withMockDateTime(time: number, fn: () => void) {
    const originalNow = Date.now;
    (global.Date as any).now = () => time;
    try {
      fn();
    } finally {
      (global.Date as any).now = originalNow;
    }
  }

  interface TestLoan {
    id: string;
    customerId: string;
    requestedAmount: number;
    interestRate: number;
    interestAmount: number;
    totalRepaymentBeforePenalties: number;
    repaymentPeriod: number | null;
    submittedAt: Date;
    dueDate: Date | null;
    outstandingPrincipal: number;
    accruedPenalty: number;
    lastPenaltyCalculatedAt: Date | null;
    fullyRepaidAt: Date | null;
    principalRepaid: number;
    interestRepaid: number;
    penaltyRepaid: number;
    status: string;
  }

  function makeLoanFixture(overrides: Partial<TestLoan> = {}): TestLoan {
    return {
      id: 'loan-1',
      customerId: 'customer-1',
      requestedAmount: 10000,
      interestRate: 0.001,
      interestAmount: 10,
      totalRepaymentBeforePenalties: 10010,
      repaymentPeriod: 12,
      submittedAt: new Date('2024-01-01'),
      dueDate: new Date('2028-01-01'),
      outstandingPrincipal: 10000,
      accruedPenalty: 0,
      lastPenaltyCalculatedAt: null,
      fullyRepaidAt: null,
      principalRepaid: 0,
      interestRepaid: 0,
      penaltyRepaid: 0,
      status: 'APPROVED',
      ...overrides,
    };
  }

  describe('calculateLoanDetails', () => {
    it('should calculate 0.1% interest on 10000 ETB principal = 10 ETB', () => {
      const loanRequest = makeLoanFixture({ interestAmount: 0, totalRepaymentBeforePenalties: 0 });

      withMockDate(() => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.equal(result.interestRate, 0.001);
        assert.equal(result.interestAmount, 10);
        assert.equal(result.totalRepaymentBeforePenalties, 10010);
      });
    });

    it('should calculate total repayment before penalties = principal + interest = 10010 ETB', () => {
      withMockDate(() => {
        const result = service.calculateLoanDetails(makeLoanFixture());
        assert.equal(result.totalRepaymentBeforePenalties, 10010);
      });
    });

    it('should have no late penalty when loan is not overdue', () => {
      withMockDate(() => {
        const result = service.calculateLoanDetails(makeLoanFixture());
        assert.equal(result.overdueDays, 0);
        assert.equal(result.isOverdue, false);
        assert.equal(result.accruedPenalty, 0);
        assert.equal(result.totalOutstanding, 10010);
      });
    });

    it('should calculate first overdue day correctly', () => {
      const loanRequest = makeLoanFixture({ dueDate: new Date('2024-01-01') });

      const testTime = new Date('2024-01-02T00:00:00.000Z').getTime();
      withMockDateTime(testTime, () => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.equal(result.overdueDays, 1);
        assert.equal(result.isOverdue, true);
      });
    });

    it('should calculate 100 ETB penalty per day on 10000 ETB unpaid principal', () => {
      const loanRequest = makeLoanFixture({ dueDate: new Date('2024-01-01') });

      const testTime = new Date('2024-01-02T00:00:00.000Z').getTime();
      withMockDateTime(testTime, () => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.equal(result.overdueDays, 1);
        assert.equal(result.accruedPenalty, 100);
        // Unpaid principal stays 10000 (interest is NOT mixed into principal)
        assert.equal(result.outstandingPrincipal, 10000);
        // Penalty is based on unpaid principal only (not principal + interest)
        assert.equal(result.totalOutstanding, 10110);
      });
    });

    it('should not compound penalties on previously accrued penalties', () => {
      // Stored penalty is stale (300 from day 3); recalculation must produce the
      // correct value from the non-compounding formula, not stack on top of it.
      const loanRequest = makeLoanFixture({
        dueDate: new Date('2024-01-01'),
        accruedPenalty: 300,
      });

      const testTime = new Date('2024-01-06T00:00:00.000Z').getTime();
      withMockDateTime(testTime, () => {
        const result = service.calculateLoanDetails(loanRequest);
        // 10000 * 0.01 * 5 days = 500 (not compounding 300 + interest on top)
        assert.equal(result.accruedPenalty, 500);
      });
    });

    it('should separate outstanding principal (unpaid principal only) from total outstanding debt', () => {
      // Partial principal repayment: outstandingPrincipal = unpaid principal only;
      // interest + penalties live outside the principal.
      const loanRequest = makeLoanFixture({
        dueDate: new Date('2024-01-01'),
        principalRepaid: 5000,
      });

      const testTime = new Date('2024-01-03T00:00:00.000Z').getTime();
      withMockDateTime(testTime, () => {
        const result = service.calculateLoanDetails(loanRequest);
        // unpaid principal = 10000 - 5000
        assert.equal(result.outstandingPrincipal, 5000);
        // penalty on remaining principal: 5000 * 0.01 * 2 days = 100
        assert.equal(result.accruedPenalty, 100);
        assert.equal(result.interestRepaid, 0);
        // total = 5000 principal + 10 interest + 100 penalty
        assert.equal(result.totalOutstanding, 5110);
      });
    });

    it('should stop accruing penalties when loan is fully repaid', () => {
      const loanRequest = makeLoanFixture({
        dueDate: new Date('2024-01-01'),
        accruedPenalty: 500,
        fullyRepaidAt: new Date('2024-01-15'),
        principalRepaid: 10000,
        interestRepaid: 10,
        penaltyRepaid: 500,
      });

      const testTime = new Date('2024-02-15T00:00:00.000Z').getTime();
      withMockDateTime(testTime, () => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.equal(result.isFullyRepaid, true);
        assert.equal(result.overdueDays, 0);
        assert.equal(result.isOverdue, false);
        assert.equal(result.outstandingPrincipal, 0);
        assert.equal(result.totalOutstanding, 0);
      });
    });

    it('should use existing interestAmount if already set', () => {
      const loanRequest = makeLoanFixture({ interestAmount: 15, totalRepaymentBeforePenalties: 10015 });

      withMockDate(() => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.equal(result.interestAmount, 15);
        assert.equal(result.totalRepaymentBeforePenalties, 10015);
      });
    });

    it('should handle missing repaymentPeriod with no due date and no penalties', () => {
      const loanRequest = makeLoanFixture({ repaymentPeriod: null, dueDate: null });

      withMockDate(() => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.equal(result.dueDate, null);
        assert.equal(result.overdueDays, 0);
        assert.equal(result.accruedPenalty, 0);
      });
    });

    it('should round monetary values to 2 decimal places', () => {
      const loanRequest = makeLoanFixture({
        requestedAmount: 10000.123,
        interestAmount: 0,
        totalRepaymentBeforePenalties: 0,
      });

      withMockDate(() => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.equal(result.interestAmount, 10);
        assert.equal(result.totalRepaymentBeforePenalties, 10010.12);
      });
    });

    it('should count no penalty for a partial overdue day (same-timezone-safe floor)', () => {
      const loanRequest = makeLoanFixture({ dueDate: new Date('2024-01-01') });

      const testTime = new Date('2024-01-01T12:00:00.000Z').getTime();
      withMockDateTime(testTime, () => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.equal(result.overdueDays, 0);
        assert.equal(result.accruedPenalty, 0);
      });
    });
  });

  describe('roundToTwoDecimals (via calculateLoanDetails)', () => {
    it('should round to 2 decimal places', () => {
      const loanRequest = makeLoanFixture({
        requestedAmount: 10000.126,
        interestAmount: 0,
        totalRepaymentBeforePenalties: 0,
      });

      withMockDate(() => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.equal(result.interestAmount, 10);
        assert.equal(result.totalRepaymentBeforePenalties, 10010.13);
      });
    });
  });

  describe('calculateDueDate (via calculateLoanDetails)', () => {
    it('should add months to submittedAt', () => {
      const loanRequest = makeLoanFixture({ submittedAt: new Date('2024-01-15'), dueDate: null });

      withMockDate(() => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.notEqual(result.dueDate, null);
        if (result.dueDate) {
          assert.equal(result.dueDate.getFullYear(), 2025);
          assert.equal(result.dueDate.getMonth(), 0);
          assert.equal(result.dueDate.getDate(), 15);
        }
      });
    });

    it('should use the given repaymentPeriod when provided', () => {
      const loanRequest = makeLoanFixture({ repaymentPeriod: 6, submittedAt: new Date('2024-01-15'), dueDate: null });

      withMockDate(() => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.notEqual(result.dueDate, null);
        if (result.dueDate) {
          assert.equal(result.dueDate.getFullYear(), 2024);
          assert.equal(result.dueDate.getMonth(), 6);
          assert.equal(result.dueDate.getDate(), 15);
        }
      });
    });
  });

  describe('calculateOverdueDays (via calculateLoanDetails)', () => {
    it('should return 0 when dueDate is in the future', () => {
      withMockDate(() => {
        const result = service.calculateLoanDetails(makeLoanFixture());
        assert.equal(result.overdueDays, 0);
      });
    });

    it('should return correct days when dueDate has passed', () => {
      const loanRequest = makeLoanFixture({ dueDate: new Date('2024-01-01') });

      const testTime = new Date('2024-01-10T00:00:00.000Z').getTime();
      withMockDateTime(testTime, () => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.equal(result.overdueDays, 9);
      });
    });

    it('should return 0 when dueDate is null', () => {
      const loanRequest = makeLoanFixture({ repaymentPeriod: null, dueDate: null });

      withMockDate(() => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.equal(result.overdueDays, 0);
      });
    });
  });

  describe('calculatePenalty (via calculateLoanDetails)', () => {
    it('should calculate penalty as unpaidPrincipal * 0.01 * overdueDays', () => {
      const loanRequest = makeLoanFixture({ dueDate: new Date('2024-01-01') });

      const testTime = new Date('2024-01-02T00:00:00.000Z').getTime();
      withMockDateTime(testTime, () => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.equal(result.accruedPenalty, 100);
      });
    });

    it('should return 0 penalty when overdueDays is 0', () => {
      withMockDate(() => {
        const result = service.calculateLoanDetails(makeLoanFixture());
        assert.equal(result.accruedPenalty, 0);
      });
    });

    it('should calculate 0 penalty when unpaid principal is 0 even when overdue', () => {
      const loanRequest = makeLoanFixture({
        dueDate: new Date('2024-01-01'),
        principalRepaid: 10000,
      });

      const testTime = new Date('2024-01-11T00:00:00.000Z').getTime();
      withMockDateTime(testTime, () => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.equal(result.outstandingPrincipal, 0);
        assert.equal(result.accruedPenalty, 0);
        // Only the unpaid interest remains
        assert.equal(result.totalOutstanding, 10);
      });
    });
  });

  describe('Penalty financial-correctness regressions', () => {
    it('should base penalty on remaining principal after partial repayment and further overdue days', () => {
      const loanRequest = makeLoanFixture({
        dueDate: new Date('2024-01-01'),
        principalRepaid: 5000,
      });

      const testTime = new Date('2024-01-04T00:00:00.000Z').getTime();
      withMockDateTime(testTime, () => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.equal(result.overdueDays, 3);
        assert.equal(result.outstandingPrincipal, 5000);
        // 5000 * 0.01 * 3 = 150 (not on 10 ETB interest, not on old penalties)
        assert.equal(result.accruedPenalty, 150);
        assert.equal(result.totalOutstanding, 5160);
      });
    });

    it('should subtract penaltyRepaid when computing unpaid penalty in totalOutstanding', () => {
      const loanRequest = makeLoanFixture({
        dueDate: new Date('2024-01-01'),
        penaltyRepaid: 200,
      });

      // accruedPenalty = 0 penalty is not applicable here because interest is unpaid
      const testTime = new Date('2024-01-07T00:00:00.000Z').getTime();
      withMockDateTime(testTime, () => {
        const result = service.calculateLoanDetails(loanRequest);
        assert.equal(result.accruedPenalty, 600);
        assert.equal(result.penaltyRepaid, 200);
        // 10000 principal + 10 interest + (600 - 200) penalty = 10410
        assert.equal(result.totalOutstanding, 10410);
      });
    });

    it('should never treat interest as part of the penalty base', () => {
      const loanRequest = makeLoanFixture({
        dueDate: new Date('2024-01-01'),
      });

      const testTime = new Date('2024-01-02T00:00:00.000Z').getTime();
      withMockDateTime(testTime, () => {
        const result = service.calculateLoanDetails(loanRequest);
        // If interest (10) were in the penalty base: 10010 * 0.01 = 100.1 (wrong)
        // Correct base is unpaid principal only: 10000 * 0.01 = 100
        assert.equal(result.accruedPenalty, 100);
      });
    });
  });

  describe('recordRepayment (with mocked transaction)', () => {
    let originalTransaction: any;

    beforeEach(() => {
      originalTransaction = (prisma as any).$transaction;
    });

    afterEach(() => {
      (prisma as any).$transaction = originalTransaction;
    });

    function createLoanStateAndTx(loan: TestLoan) {
      const state = { loan: { ...loan } };
      const calls = { forUpdateCount: 0 };

      const fakeTx: any = {
        $queryRaw: async () => {
          calls.forUpdateCount += 1;
          return [{ id: state.loan.id }];
        },
        loanRequest: {
          findUnique: async () => ({ ...state.loan }),
          update: async ({ data }: any) => {
            Object.assign(state.loan, data);
            return { ...state.loan };
          },
        },
      };

      (prisma as any).$transaction = async (fn: any) => fn(fakeTx);

      return { state, calls };
    }

    it('should validate repayment amount is greater than zero', async () => {
      await assert.rejects(
        () => service.recordRepayment('customer-1', 'loan-1', 0),
        (err: any) => err instanceof BadRequestError
      );
      await assert.rejects(
        () => service.recordRepayment('customer-1', 'loan-1', -50),
        (err: any) => err instanceof BadRequestError
      );
      await assert.rejects(
        () => service.recordRepayment('customer-1', 'loan-1', Number.NaN),
        (err: any) => err instanceof BadRequestError
      );
    });

    it('should reject repayments on non-approved loans', async () => {
      const loan = makeLoanFixture({ status: 'PENDING' });
      createLoanStateAndTx(loan);

      const paidAt = new Date('2024-01-06T00:00:00.000Z');
      await assert.rejects(
        () => service.recordRepayment('customer-1', 'loan-1', 100, paidAt),
        (err: any) => err instanceof BadRequestError
      );
    });

    it('should reject repayments on already fully repaid loans', async () => {
      const loan = makeLoanFixture({
        fullyRepaidAt: new Date('2024-01-03'),
        principalRepaid: 10000,
        interestRepaid: 10,
      });
      createLoanStateAndTx(loan);

      const paidAt = new Date('2024-01-06T00:00:00.000Z');
      await assert.rejects(
        () => service.recordRepayment('customer-1', 'loan-1', 100, paidAt),
        (err: any) => err instanceof BadRequestError
      );
    });

    it('should reject repayments from a customer who does not own the loan', async () => {
      const loan = makeLoanFixture({ customerId: 'owner-customer' });
      createLoanStateAndTx(loan);

      const paidAt = new Date('2024-01-06T00:00:00.000Z');
      await assert.rejects(
        () => service.recordRepayment('customer-1', 'loan-1', 100, paidAt),
        (err: any) => err instanceof ForbiddenError
      );
    });

    it('should lock the loan row and allocate payment penalties -> interest -> principal', async () => {
      const loan = makeLoanFixture({ dueDate: new Date('2024-01-01') });
      const { state, calls } = createLoanStateAndTx(loan);

      const testTime = new Date('2024-01-06T00:00:00.000Z').getTime();
      const paidAt = new Date('2024-01-06T00:00:00.000Z');

      await withMockDateTimeAsync(testTime, async () => {
        // Outstanding = 10000 principal + 10 interest + 500 penalty = 10510
        // Pay 10000: penalties 500 first, interest 10 next, then principal 9490
        const result = await service.recordRepayment('customer-1', 'loan-1', 10000, paidAt);

        assert.equal(state.loan.penaltyRepaid, 500);
        assert.equal(state.loan.interestRepaid, 10);
        assert.equal(state.loan.principalRepaid, 9490);
        // outstandingPrincipal tracks unpaid principal only
        assert.equal(state.loan.outstandingPrincipal, 510);
        assert.equal(state.loan.fullyRepaidAt, null);
        assert.notEqual(result, null);
      });

      // Row was locked via SELECT ... FOR UPDATE inside the transaction
      assert.equal(calls.forUpdateCount, 1);
    });

    it('should prevent concurrent repayments from exceeding outstanding debt', async () => {
      const loan = makeLoanFixture({ dueDate: new Date('2024-01-01') });
      const { state, calls } = createLoanStateAndTx(loan);

      const testTime = new Date('2024-01-06T00:00:00.000Z').getTime();
      const paidAt = new Date('2024-01-06T00:00:00.000Z');

      await withMockDateTimeAsync(testTime, async () => {
        // First repayment of 10510 clears everything...
        await service.recordRepayment('customer-1', 'loan-1', 10510, paidAt);
        assert.equal(state.loan.fullyRepaidAt, paidAt);
        assert.equal(state.loan.principalRepaid, 10000);
        assert.equal(state.loan.interestRepaid, 10);
        assert.equal(state.loan.penaltyRepaid, 500);
        assert.equal(state.loan.outstandingPrincipal, 0);

        // ...a second repayment attempt must be rejected as fully repaid
        await assert.rejects(
          () => service.recordRepayment('customer-1', 'loan-1', 1, paidAt),
          (err: any) => err instanceof BadRequestError
        );
      });

      // Each repayment attempt takes its own row lock (1 for the payment, 1 for the rejected retry)
      assert.equal(calls.forUpdateCount, 2);
    });

    it('should apply sequential partial repayments without exceeding outstanding debt', async () => {
      const loan = makeLoanFixture({ dueDate: new Date('2024-01-01') });
      const { state } = createLoanStateAndTx(loan);

      const testTime = new Date('2024-01-06T00:00:00.000Z').getTime();
      const paidAt1 = new Date('2024-01-06T00:00:00.000Z');
      const paidAt2 = new Date('2024-01-07T00:00:00.000Z');

      await withMockDateTimeAsync(testTime, async () => {
        // First partial repayment
        await service.recordRepayment('customer-1', 'loan-1', 10000, paidAt1);
        assert.equal(state.loan.principalRepaid, 9490);
        assert.equal(state.loan.outstandingPrincipal, 510);

        // Second payment exceeding remaining 510 must fail
        await assert.rejects(
          () => service.recordRepayment('customer-1', 'loan-1', 600, paidAt2),
          (err: any) => err instanceof BadRequestError
        );

        // Final payment clears the remainder
        await service.recordRepayment('customer-1', 'loan-1', 510, paidAt2);
        assert.equal(state.loan.principalRepaid, 10000);
        assert.equal(state.loan.fullyRepaidAt, paidAt2);
        assert.equal(state.loan.outstandingPrincipal, 0);
      });
    });
  });

  // Async-aware version for repaying tests so awaits complete before restoring Date.now
  async function withMockDateTimeAsync(time: number, fn: () => Promise<void>) {
    const originalNow = Date.now;
    (global.Date as any).now = () => time;
    try {
      await fn();
    } finally {
      (global.Date as any).now = originalNow;
    }
  }
});

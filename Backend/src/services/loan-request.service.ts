import prisma from '../config/database';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../utils/errors';

export interface LoanRequestFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export interface LoanRequestData {
  requestedAmount: number;
  loanPurpose: string;
  repaymentPeriod?: number;
}

export interface AdminLoanDecisionData {
  decision: 'APPROVED' | 'REJECTED';
  decisionNote?: string;
}

export interface LoanCalculationResult {
  interestRate: number;
  interestAmount: number;
  totalRepaymentBeforePenalties: number;
  dueDate: Date | null;
  outstandingPrincipal: number;
  accruedPenalty: number;
  overdueDays: number;
  isOverdue: boolean;
  isFullyRepaid: boolean;
  principalRepaid: number;
  interestRepaid: number;
  penaltyRepaid: number;
  totalOutstanding: number;
}

const INTEREST_RATE = 0.001;
const PENALTY_RATE_PER_DAY = 0.01;
const DEFAULT_REPAYMENT_MONTHS = 6;

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateDueDate(submittedAt: Date, repaymentPeriodMonths?: number): Date {
  const months = repaymentPeriodMonths ?? DEFAULT_REPAYMENT_MONTHS;
  const dueDate = new Date(submittedAt);
  dueDate.setMonth(dueDate.getMonth() + months);
  return dueDate;
}

function calculateOverdueDays(dueDate: Date | null, referenceDate?: Date): number {
  if (!dueDate) return 0;
  const refDate = referenceDate ?? new Date(Date.now());
  const diffTime = refDate.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function calculatePenalty(unpaidPrincipal: number, overdueDays: number): number {
  if (overdueDays <= 0) return 0;
  return roundToTwoDecimals(unpaidPrincipal * PENALTY_RATE_PER_DAY * overdueDays);
}

export class LoanRequestService {
  /**
   * Create a new loan request for a customer
   */
  async createLoanRequest(customerId: string, data: LoanRequestData) {
    if (!Number.isFinite(data.requestedAmount) || data.requestedAmount <= 0) {
      throw new BadRequestError('Requested amount must be greater than zero');
    }

    return prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "users"
        WHERE "id" = ${customerId}
        FOR UPDATE
      `;

      if (users.length === 0) {
        throw new NotFoundError('Customer not found');
      }

      const existingPending = await tx.loanRequest.findFirst({
        where: { customerId, status: 'PENDING' },
        select: { id: true },
      });

      if (existingPending) {
        throw new ConflictError(
          'You already have a pending loan request. Please wait for a decision before submitting a new one.'
        );
      }

      return tx.loanRequest.create({
        data: {
          customerId,
          requestedAmount: data.requestedAmount,
          loanPurpose: data.loanPurpose,
          repaymentPeriod: data.repaymentPeriod,
          status: 'PENDING',
        },
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });
  }

  /**
   * Calculate loan financial details (interest, penalties, due date, etc.)
   * 
   * Key principles:
   * - outstandingPrincipal = unpaid original principal only (requestedAmount - principalRepaid)
   * - interestAmount = one-time charge at approval (0.1% of requestedAmount)
   * - penalties = 1% per day on unpaid principal only (not on interest or previous penalties)
   * - totalOutstanding = unpaidPrincipal + unpaidInterest + unpaidPenalties
   */
  calculateLoanDetails(loanRequest: {
    requestedAmount: number;
    interestRate: number;
    interestAmount: number;
    totalRepaymentBeforePenalties: number;
    repaymentPeriod: number | null;
    submittedAt: Date;
    dueDate: Date | null;
    outstandingPrincipal: number;  // This field in DB stores the unpaid principal
    accruedPenalty: number;
    lastPenaltyCalculatedAt: Date | null;
    fullyRepaidAt: Date | null;
    principalRepaid: number;
    interestRepaid: number;
    penaltyRepaid: number;
    status: string;
  }): LoanCalculationResult {
    const now = new Date(Date.now());
    const dueDate = loanRequest.dueDate ?? (loanRequest.repaymentPeriod !== null 
      ? calculateDueDate(loanRequest.submittedAt, loanRequest.repaymentPeriod ?? undefined)
      : null);

    const interestRate = loanRequest.interestRate ?? INTEREST_RATE;
    const interestAmount = loanRequest.interestAmount > 0
      ? loanRequest.interestAmount
      : roundToTwoDecimals(loanRequest.requestedAmount * interestRate);

    const totalRepaymentBeforePenalties = loanRequest.totalRepaymentBeforePenalties > 0
      ? loanRequest.totalRepaymentBeforePenalties
      : roundToTwoDecimals(loanRequest.requestedAmount + interestAmount);

    const isFullyRepaid = !!loanRequest.fullyRepaidAt;
    
    // Unpaid principal = original principal - principal repaid
    const unpaidPrincipal = Math.max(0, loanRequest.requestedAmount - loanRequest.principalRepaid);
    
    // Unpaid interest = interest amount - interest repaid
    const unpaidInterest = Math.max(0, interestAmount - loanRequest.interestRepaid);
    
    // Overdue days
    const overdueDays = isFullyRepaid || !dueDate ? 0 : calculateOverdueDays(dueDate, now);

    // Calculate accrued penalty based on unpaid principal only
    // This is the total penalty that SHOULD have accrued by now
    const calculatedAccruedPenalty = calculatePenalty(unpaidPrincipal, overdueDays);
    
    // The stored accruedPenalty may be stale if not recently recalculated
    // Use the calculated value for display, but don't overwrite DB unless explicitly requested
    const accruedPenalty = calculatedAccruedPenalty;

    // Unpaid penalty = accrued penalty - penalty repaid
    const unpaidPenalty = Math.max(0, accruedPenalty - loanRequest.penaltyRepaid);

    // Total outstanding = unpaid principal + unpaid interest + unpaid penalty
    const totalOutstanding = roundToTwoDecimals(unpaidPrincipal + unpaidInterest + unpaidPenalty);

    return {
      interestRate,
      interestAmount,
      totalRepaymentBeforePenalties,
      dueDate,
      outstandingPrincipal: unpaidPrincipal,  // This is the true unpaid principal
      accruedPenalty: roundToTwoDecimals(accruedPenalty),
      overdueDays,
      isOverdue: overdueDays > 0 && !isFullyRepaid,
      isFullyRepaid,
      principalRepaid: loanRequest.principalRepaid,
      interestRepaid: loanRequest.interestRepaid,
      penaltyRepaid: loanRequest.penaltyRepaid,
      totalOutstanding,
    };
  }

  /**
   * Get loan request with calculated financial details for a customer
   */
  async getCustomerLoanRequestWithDetails(customerId: string, loanRequestId: string) {
    const loanRequest = await prisma.loanRequest.findFirst({
      where: {
        id: loanRequestId,
        customerId,
      },
      include: {
        reviewedByAdmin: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!loanRequest) {
      throw new NotFoundError('Loan request not found');
    }

    const calculations = this.calculateLoanDetails(loanRequest);

    return {
      ...loanRequest,
      ...calculations,
    };
  }

  /**
   * Get loan requests with calculated financial details for a customer
   */
  async getCustomerLoanRequestsWithDetails(customerId: string, filters: LoanRequestFilters = {}) {
    const { status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { customerId };
    if (status) where.status = status;

    const [loanRequests, total] = await Promise.all([
      prisma.loanRequest.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
        include: {
          reviewedByAdmin: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.loanRequest.count({ where }),
    ]);

    const loanRequestsWithDetails = loanRequests.map((loan) => ({
      ...loan,
      ...this.calculateLoanDetails(loan),
    }));

    return {
      loanRequests: loanRequestsWithDetails,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    };
  }

  /**
   * Get loan requests for a specific customer (legacy method for backward compatibility)
   */
  async getCustomerLoanRequests(customerId: string, filters: LoanRequestFilters = {}) {
    const { status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { customerId };
    if (status) where.status = status;

    const [loanRequests, total] = await Promise.all([
      prisma.loanRequest.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
        include: {
          reviewedByAdmin: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.loanRequest.count({ where }),
    ]);

    return {
      loanRequests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    };
  }

  /**
   * Get a single loan request by ID (customer access - must own it)
   */
  async getCustomerLoanRequestById(customerId: string, loanRequestId: string) {
    const loanRequest = await prisma.loanRequest.findFirst({
      where: {
        id: loanRequestId,
        customerId,
      },
      include: {
        reviewedByAdmin: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!loanRequest) {
      throw new NotFoundError('Loan request not found');
    }

    return loanRequest;
  }

  /**
   * Admin: List all loan requests with filtering and pagination
   */
  async getAdminLoanRequests(filters: LoanRequestFilters = {}) {
    const { status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [loanRequests, total] = await Promise.all([
      prisma.loanRequest.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              createdAt: true,
            },
          },
          reviewedByAdmin: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.loanRequest.count({ where }),
    ]);

    return {
      loanRequests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    };
  }

  /**
   * Admin: Get loan request details by ID with calculated financial details
   */
  async getAdminLoanRequestWithDetails(loanRequestId: string) {
    const loanRequest = await prisma.loanRequest.findUnique({
      where: { id: loanRequestId },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            createdAt: true,
            wallet: {
              select: {
                balance: true,
                currency: true,
                isActive: true,
              },
            },
          },
        },
        reviewedByAdmin: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!loanRequest) {
      throw new NotFoundError('Loan request not found');
    }

    const calculations = this.calculateLoanDetails(loanRequest);

    return {
      ...loanRequest,
      ...calculations,
    };
  }

  /**
   * Admin: Get loan request details by ID (legacy method for backward compatibility)
   */
  async getAdminLoanRequestById(loanRequestId: string) {
    const loanRequest = await prisma.loanRequest.findUnique({
      where: { id: loanRequestId },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            createdAt: true,
            wallet: {
              select: {
                balance: true,
                currency: true,
                isActive: true,
              },
            },
          },
        },
        reviewedByAdmin: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!loanRequest) {
      throw new NotFoundError('Loan request not found');
    }

    return loanRequest;
  }

  /**
   * Admin: Approve or reject a loan request
   * When approving, calculate and store interest, due date, and initial outstanding principal
   */
  async decideLoanRequest(adminId: string, loanRequestId: string, data: AdminLoanDecisionData) {
    const { decision, decisionNote } = data;

    return prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: decision,
        reviewedAt: new Date(),
        reviewedByAdminId: adminId,
        decisionNote: decisionNote || null,
      };

      if (decision === 'APPROVED') {
        const loanRequest = await tx.loanRequest.findUnique({
          where: { id: loanRequestId },
          select: {
            requestedAmount: true,
            repaymentPeriod: true,
            submittedAt: true,
            interestRate: true,
            interestAmount: true,
            totalRepaymentBeforePenalties: true,
            dueDate: true,
            outstandingPrincipal: true,
          },
        });

        if (!loanRequest) {
          throw new NotFoundError('Loan request not found');
        }

        const interestRate = loanRequest.interestRate ?? INTEREST_RATE;
        const interestAmount = loanRequest.interestAmount > 0
          ? loanRequest.interestAmount
          : roundToTwoDecimals(loanRequest.requestedAmount * interestRate);
        const totalRepaymentBeforePenalties = loanRequest.totalRepaymentBeforePenalties > 0
          ? loanRequest.totalRepaymentBeforePenalties
          : roundToTwoDecimals(loanRequest.requestedAmount + interestAmount);
        const dueDate = loanRequest.dueDate ?? (loanRequest.repaymentPeriod !== null
          ? calculateDueDate(loanRequest.submittedAt, loanRequest.repaymentPeriod ?? undefined)
          : null);

        updateData.interestRate = interestRate;
        updateData.interestAmount = interestAmount;
        updateData.totalRepaymentBeforePenalties = totalRepaymentBeforePenalties;
        updateData.dueDate = dueDate;
        // outstandingPrincipal = unpaid principal (initially = requestedAmount)
        updateData.outstandingPrincipal = loanRequest.requestedAmount;
        updateData.principalRepaid = 0;
        updateData.interestRepaid = 0;
        updateData.penaltyRepaid = 0;
        updateData.accruedPenalty = 0;
        updateData.fullyRepaidAt = null;
      }

      const updateResult = await tx.loanRequest.updateMany({
        where: {
          id: loanRequestId,
          status: 'PENDING',
        },
        data: updateData,
      });

      if (updateResult.count === 0) {
        const existing = await tx.loanRequest.findUnique({
          where: { id: loanRequestId },
          select: { id: true, status: true },
        });

        if (!existing) {
          throw new NotFoundError('Loan request not found');
        }

        throw new ConflictError(
          `Loan request has already been ${existing.status.toLowerCase()}`
        );
      }

      const updatedLoanRequest = await tx.loanRequest.findUnique({
        where: { id: loanRequestId },
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          reviewedByAdmin: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!updatedLoanRequest) {
        throw new NotFoundError('Loan request not found');
      }

      return updatedLoanRequest;
    });
  }

  /**
   * Calculate and update accrued penalties for a loan (can be called by a scheduled job)
   * IDEMPOTENT: Only updates if overdue days have increased since last calculation
   * Returns the updated loan request with new penalty calculations
   */
  async calculateAndUpdatePenalties(loanRequestId: string) {
    const loanRequest = await prisma.loanRequest.findUnique({
      where: { id: loanRequestId },
    });

    if (!loanRequest) {
      throw new NotFoundError('Loan request not found');
    }

    if (loanRequest.status !== 'APPROVED') {
      throw new BadRequestError('Penalties can only be calculated for approved loans');
    }

    if (loanRequest.fullyRepaidAt) {
      return loanRequest;
    }

    const now = new Date(Date.now());

    // Use the stored dueDate as the single source of truth.
    // If dueDate is null (no repayment period at approval time), no penalties accrue.
    const dueDate = loanRequest.dueDate;
    if (!dueDate) {
      return loanRequest;
    }

    const overdueDays = calculateOverdueDays(dueDate, now);

    if (overdueDays <= 0) {
      return loanRequest;
    }

    // Calculate unpaid principal (original - repaid)
    const unpaidPrincipal = Math.max(0, loanRequest.requestedAmount - loanRequest.principalRepaid);
    
    // Calculate total penalty that should have accrued by now
    const totalPenaltyDue = calculatePenalty(unpaidPrincipal, overdueDays);
    
    // Check if this would be a new penalty accrual (idempotency)
    // Only update if the calculated penalty is greater than what's already stored
    // and we haven't already accounted for this overdue period
    const lastCalculatedAt = loanRequest.lastPenaltyCalculatedAt 
      ? new Date(loanRequest.lastPenaltyCalculatedAt) 
      : null;
    
    // If we already calculated for this overdue period or later, don't update
    if (lastCalculatedAt) {
      const lastOverdueDays = calculateOverdueDays(dueDate, lastCalculatedAt);
      // If the last calculation was for the same or more overdue days, skip
      if (lastOverdueDays >= overdueDays) {
        return loanRequest;
      }
    }

    const newAccruedPenalty = totalPenaltyDue;

    const updatedLoanRequest = await prisma.loanRequest.update({
      where: { id: loanRequestId },
      data: {
        accruedPenalty: newAccruedPenalty,
        lastPenaltyCalculatedAt: now,
        // outstandingPrincipal remains the unpaid principal (no change needed here)
      },
    });

    return updatedLoanRequest;
  }

  /**
   * Record a repayment for a loan
   * Applies payment in order: penalties first, then interest, then principal
   * Uses row locking to prevent concurrent repayment race conditions
   * Ownership is verified inside the transaction (after the lock) for race safety
   * 
   * NOTE: This endpoint records the accounting entry for a repayment.
   * It does NOT verify that actual funds were transferred.
   * Payment verification must be implemented separately (e.g., via wallet transactions,
   * payment gateway callbacks, or manual admin verification).
   */
  async recordRepayment(
    customerId: string,
    loanRequestId: string,
    amount: number,
    paidAt: Date = new Date()
  ) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestError('Repayment amount must be greater than zero');
    }

    return prisma.$transaction(async (tx) => {
      // Lock the loan request row to prevent concurrent repayments
      const loanRequest = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "loan_requests"
        WHERE "id" = ${loanRequestId}
        FOR UPDATE
      `;

      if (loanRequest.length === 0) {
        throw new NotFoundError('Loan request not found');
      }

      const fullLoanRequest = await tx.loanRequest.findUnique({
        where: { id: loanRequestId },
      });

      if (!fullLoanRequest) {
        throw new NotFoundError('Loan request not found');
      }

      // Ownership must be verified after the lock for race safety
      if (fullLoanRequest.customerId !== customerId) {
        throw new ForbiddenError('You are not authorized to repay this loan');
      }

      if (fullLoanRequest.status !== 'APPROVED') {
        throw new BadRequestError('Repayments can only be made on approved loans');
      }

      if (fullLoanRequest.fullyRepaidAt) {
        throw new BadRequestError('Loan is already fully repaid');
      }

      const calculations = this.calculateLoanDetails(fullLoanRequest);
      const totalOutstanding = calculations.totalOutstanding;

      if (amount > totalOutstanding + 0.01) {
        throw new BadRequestError(`Repayment amount exceeds outstanding balance of ${roundToTwoDecimals(totalOutstanding)}`);
      }

      let remainingAmount = amount;
      let newPenaltyRepaid = fullLoanRequest.penaltyRepaid;
      let newInterestRepaid = fullLoanRequest.interestRepaid;
      let newPrincipalRepaid = fullLoanRequest.principalRepaid;

      // 1. Apply to penalties first
      const accruedPenalty = calculations.accruedPenalty;
      const penaltyOutstanding = Math.max(0, accruedPenalty - fullLoanRequest.penaltyRepaid);
      const penaltyPayment = Math.min(remainingAmount, penaltyOutstanding);
      newPenaltyRepaid += penaltyPayment;
      remainingAmount -= penaltyPayment;

      // 2. Apply to interest
      const interestOutstanding = Math.max(0, fullLoanRequest.interestAmount - fullLoanRequest.interestRepaid);
      const interestPayment = Math.min(remainingAmount, interestOutstanding);
      newInterestRepaid += interestPayment;
      remainingAmount -= interestPayment;

      // 3. Apply to principal
      const principalOutstanding = Math.max(0, fullLoanRequest.requestedAmount - fullLoanRequest.principalRepaid);
      const principalPayment = Math.min(remainingAmount, principalOutstanding);
      newPrincipalRepaid += principalPayment;
      remainingAmount -= principalPayment;

      const newUnpaidPrincipal = Math.max(0, fullLoanRequest.requestedAmount - newPrincipalRepaid);
      const newUnpaidInterest = Math.max(0, fullLoanRequest.interestAmount - newInterestRepaid);
      const newUnpaidPenalty = Math.max(0, accruedPenalty - newPenaltyRepaid);
      const newTotalOutstanding = roundToTwoDecimals(newUnpaidPrincipal + newUnpaidInterest + newUnpaidPenalty);

      const isFullyRepaid = newTotalOutstanding <= 0.01;

      const updatedLoanRequest = await tx.loanRequest.update({
        where: { id: loanRequestId },
        data: {
          principalRepaid: newPrincipalRepaid,
          interestRepaid: newInterestRepaid,
          penaltyRepaid: newPenaltyRepaid,
          outstandingPrincipal: newUnpaidPrincipal, // Track unpaid principal only
          accruedPenalty: calculations.accruedPenalty,
          lastPenaltyCalculatedAt: paidAt,
          fullyRepaidAt: isFullyRepaid ? paidAt : null,
        },
      });

      return updatedLoanRequest;
    });
  }

  /**
   * Get loan request statistics for admin dashboard
   */
  async getLoanRequestStats() {
    const [total, pending, approved, rejected] = await Promise.all([
      prisma.loanRequest.count(),
      prisma.loanRequest.count({ where: { status: 'PENDING' } }),
      prisma.loanRequest.count({ where: { status: 'APPROVED' } }),
      prisma.loanRequest.count({ where: { status: 'REJECTED' } }),
    ]);

    return { total, pending, approved, rejected };
  }
}

export default new LoanRequestService();
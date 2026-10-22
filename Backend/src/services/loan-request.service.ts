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

export class LoanRequestService {
  /**
   * Create a new loan request for a customer
   */
  async createLoanRequest(customerId: string, data: LoanRequestData) {
    if (!Number.isFinite(data.requestedAmount) || data.requestedAmount <= 0) {
      throw new BadRequestError('Requested amount must be greater than zero');
    }

    return prisma.$transaction(async (tx) => {
      // Serialize submissions for this customer by locking their user row.
      // Every submission through this service must acquire this lock first.
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
   * Get loan requests for a specific customer
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
   * Admin: Get loan request details by ID
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
   * Uses a transaction to ensure atomicity and prevent race conditions
   */
  async decideLoanRequest(adminId: string, loanRequestId: string, data: AdminLoanDecisionData) {
    const { decision, decisionNote } = data;

    return prisma.$transaction(async (tx) => {
      // Only one concurrent decision can change a PENDING request.
      const updateResult = await tx.loanRequest.updateMany({
        where: {
          id: loanRequestId,
          status: 'PENDING',
        },
        data: {
          status: decision,
          reviewedAt: new Date(),
          reviewedByAdminId: adminId,
          decisionNote: decisionNote || null,
        },
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
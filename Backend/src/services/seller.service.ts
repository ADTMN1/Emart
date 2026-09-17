import prisma from '../config/database';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { Prisma, SellerStatus } from '@prisma/client';

/**
 * Seller foundation (Phase 5).
 *
 * Ownership chain for every customer operation:
 *   authenticated user → own SellerApplication / SellerProfile
 *
 * Protected values (userId, status, reviewedBy, reviewedAt, sellerId) are
 * always derived server-side — no client input is ever trusted for them.
 *
 * APPLICATION LIFECYCLE
 * ---------------------
 * A user owns exactly one application row (DB-unique userId). Status
 * transitions:
 *
 *   (no application)      → PENDING    (submit)
 *   PENDING  → APPROVED   (admin approve → also creates SellerProfile)
 *   PENDING  → REJECTED   (admin reject, reason required)
 *   REJECTED → PENDING    (customer resubmission reuses the same row:
 *                          store fields updated, reason cleared,
 *                          reviewed* cleared, submittedAt re-stamped)
 *   APPROVED → SUSPENDED  (admin suspend on the profile)
 *   SUSPENDED → APPROVED  (admin reactivate on the profile)
 *
 * Submitting while PENDING/APPROVED/SUSPENDED is rejected with 409; only a
 * REJECTED application can be resubmitted. The APPROVED seller profile is a
 * separate one-per-user row (DB-unique userId) so identity survives any
 * future application-state changes and suspension keeps the profile linked.
 */

/** Valid status transitions for an application row. */
const APPLICATION_TRANSITIONS: Record<SellerStatus, SellerStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  REJECTED: ['PENDING'],
  APPROVED: ['SUSPENDED'],
  SUSPENDED: ['APPROVED'],
};

export interface ApplicationReviewContext {
  reviewedBy: string;
  reviewedAt: Date;
}

export class SellerService {
  /** Normalized, validated store fields shared by submit/resubmit. */
  private storeInput(data: { storeName: string; storeDescription: string }) {
    const storeName = String(data.storeName ?? '').replace(/\s+/g, ' ').trim();
    const storeDescription = String(data.storeDescription ?? '').replace(/\s+/g, ' ').trim();
    if (storeName.length < 3 || storeName.length > 80) {
      throw new ValidationError('Store name must be between 3 and 80 characters.');
    }
    if (storeDescription.length < 10 || storeDescription.length > 2000) {
      throw new ValidationError('Store description must be between 10 and 2000 characters.');
    }
    return { storeName, storeDescription };
  }

  /**
   * POST /seller/application — submit a first application or resubmit a
   * rejected one (same row). Everything else is a 409 conflict.
   */
  async submitApplication(
    userId: string,
    data: { storeName: string; storeDescription: string }
  ) {
    const input = this.storeInput(data);

    const existing = await prisma.sellerApplication.findUnique({ where: { userId } });
    if (existing) {
      if (existing.status === 'PENDING') {
        throw new ConflictError('You already have an application under review.');
      }
      if (existing.status === 'APPROVED') {
        throw new ConflictError('Your seller application has already been approved.');
      }
      if (existing.status === 'SUSPENDED') {
        throw new ConflictError('Your seller account is suspended. Contact support.');
      }
      // REJECTED → resubmission reuses the same row (documented behavior).
      return prisma.sellerApplication.update({
        where: { userId },
        data: {
          ...input,
          status: 'PENDING',
          rejectionReason: null,
          reviewedAt: null,
          reviewedBy: null,
          submittedAt: new Date(),
        },
        select: {
          id: true,
          storeName: true,
          storeDescription: true,
          status: true,
          rejectionReason: true,
          submittedAt: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    return prisma.sellerApplication.create({
      data: { userId, ...input, status: 'PENDING' },
      select: {
        id: true,
        storeName: true,
        storeDescription: true,
        status: true,
        rejectionReason: true,
        submittedAt: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * GET /seller/application — the caller's own application (userId derived
   * from the token). Returns null when none exists; never another user's.
   */
  async getMyApplication(userId: string) {
    return prisma.sellerApplication.findUnique({
      where: { userId },
      select: {
        id: true,
        storeName: true,
        storeDescription: true,
        status: true,
        rejectionReason: true,
        submittedAt: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * GET /seller/profile — the caller's own seller identity, if any.
   * The authorization foundation for future phases: resolves the profile
   * strictly through the authenticated userId.
   */
  async getMyProfile(userId: string) {
    return prisma.sellerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        storeName: true,
        storeDescription: true,
        status: true,
        suspendedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * PUT /seller/profile — update the caller's own store identity
   * (storeName/storeDescription). Validation is the same storeInput used by
   * applications; identity/status/ownership are never client-settable.
   * Works for APPROVED and SUSPENDED sellers (suspension gates product
   * management, not the seller's own store profile edits).
   */
  async updateMyProfile(
    userId: string,
    data: { storeName: string; storeDescription: string },
  ) {
    const input = this.storeInput(data);
    const existing = await prisma.sellerProfile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundError('Seller profile not found.');
    }
    return prisma.sellerProfile.update({
      where: { userId },
      data: input,
      select: {
        id: true,
        storeName: true,
        storeDescription: true,
        status: true,
        suspendedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Reusable seller authorization helper for future phases:
   * authenticated user → SellerProfile → require APPROVED.
   * Throws NotFoundError (no profile) / ForbiddenError (not approved).
   */
  async requireApprovedSeller(userId: string) {
    const profile = await prisma.sellerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundError('Seller profile not found.');
    }
    if (profile.status !== 'APPROVED') {
      throw new ForbiddenError('Seller account is not active.');
    }
    return profile;
  }

  /** ADMIN — server-paginated application list with status filter. */
  async listApplications(filters: { status?: string }, pagination: { page?: number; limit?: number }) {
    const page = Math.max(1, Math.floor(pagination.page || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(pagination.limit || 20)));
    const skip = (page - 1) * limit;

    const where: Prisma.SellerApplicationWhereInput = {};
    if (filters.status) {
      where.status = filters.status as SellerStatus;
    }

    const [items, total] = await Promise.all([
      prisma.sellerApplication.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          storeName: true,
          storeDescription: true,
          status: true,
          rejectionReason: true,
          submittedAt: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              // Minimal identity link so admin UI can target suspend/activate.
              sellerProfile: { select: { id: true, status: true } },
            },
          },
        },
      }),
      prisma.sellerApplication.count({ where }),
    ]);

    return {
      applications: items,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  /** ADMIN — full application detail incl. applicant identity. */
  async getApplicationById(applicationId: string) {
    const application = await prisma.sellerApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        storeName: true,
        storeDescription: true,
        status: true,
        rejectionReason: true,
        submittedAt: true,
        reviewedAt: true,
        reviewedBy: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            // Minimal identity link so admin UI can target suspend/activate.
            sellerProfile: { select: { id: true, status: true } },
          },
        },
      },
    });
    if (!application) {
      throw new NotFoundError('Seller application not found.');
    }
    return application;
  }

  /** Shared transition validation. */
  private assertApplicationTransition(current: SellerStatus, next: SellerStatus) {
    const allowed = APPLICATION_TRANSITIONS[current] || [];
    if (!allowed.includes(next)) {
      if (current === next) {
        throw new ValidationError(`Application is already ${current}.`);
      }
      throw new ValidationError(
        `Cannot change application status from ${current} to ${next}. Allowed: ${allowed.join(', ') || 'none'}.`
      );
    }
  }

  /** ADMIN — PENDING → APPROVED; also creates the one-per-user profile. */
  async approveApplication(applicationId: string, adminId: string) {
    const application = await prisma.sellerApplication.findUnique({ where: { id: applicationId } });
    if (!application) {
      throw new NotFoundError('Seller application not found.');
    }
    this.assertApplicationTransition(application.status as SellerStatus, 'APPROVED');

    const review: ApplicationReviewContext = { reviewedBy: adminId, reviewedAt: new Date() };

    const [updated] = await prisma.$transaction([
      prisma.sellerApplication.update({
        where: { id: application.id },
        data: { status: 'APPROVED', rejectionReason: null, ...review },
      }),
      // One identity per user — upsert keeps approval idempotent and the DB
      // unique constraint guarantees no second profile can ever appear.
      prisma.sellerProfile.upsert({
        where: { userId: application.userId },
        create: {
          userId: application.userId,
          storeName: application.storeName,
          storeDescription: application.storeDescription,
          status: 'APPROVED',
        },
        update: { status: 'APPROVED', suspendedAt: null },
      }),
    ]);

    return updated;
  }

  /** ADMIN — PENDING → REJECTED with a required, validated reason. */
  async rejectApplication(applicationId: string, adminId: string, reason: string) {
    const application = await prisma.sellerApplication.findUnique({ where: { id: applicationId } });
    if (!application) {
      throw new NotFoundError('Seller application not found.');
    }
    this.assertApplicationTransition(application.status as SellerStatus, 'REJECTED');

    const trimmed = reason.replace(/\s+/g, ' ').trim();
    if (trimmed.length < 3 || trimmed.length > 1000) {
      throw new ValidationError('Rejection reason must be between 3 and 1000 characters.');
    }

    return prisma.sellerApplication.update({
      where: { id: application.id },
      data: { status: 'REJECTED', rejectionReason: trimmed, reviewedBy: adminId, reviewedAt: new Date() },
    });
  }

  /** ADMIN — APPROVED → SUSPENDED on the seller profile (identity preserved). */
  async suspendSeller(sellerId: string, adminId: string) {
    const profile = await prisma.sellerProfile.findUnique({ where: { id: sellerId } });
    if (!profile) {
      throw new NotFoundError('Seller profile not found.');
    }
    this.assertApplicationTransition(profile.status as SellerStatus, 'SUSPENDED');

    return prisma.sellerProfile.update({
      where: { id: profile.id },
      data: { status: 'SUSPENDED', suspendedAt: new Date() },
    });
  }

  /** ADMIN — SUSPENDED → APPROVED on the seller profile. */
  async activateSeller(sellerId: string, adminId: string) {
    const profile = await prisma.sellerProfile.findUnique({ where: { id: sellerId } });
    if (!profile) {
      throw new NotFoundError('Seller profile not found.');
    }
    void adminId;
    this.assertApplicationTransition(profile.status as SellerStatus, 'APPROVED');

    return prisma.sellerProfile.update({
      where: { id: profile.id },
      data: { status: 'APPROVED', suspendedAt: null },
    });
  }
}

export default new SellerService();

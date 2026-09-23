import prisma from '../config/database';
import emailService, { EmailService as EmailServiceClass, SendEmailResult } from './email.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { Prisma, SellerStatus } from '@prisma/client';
import { SELLER_AGREEMENT_VERSION, SELLER_AGREEMENT_TEXT, SELLER_AGREEMENT_TITLE } from '../config/sellerAgreement';
import sellerDocumentStorageService from './seller-document-storage.service';

/** Pragmatic email shape check — the authoritative validation is the API layer. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Shape of the customer-supplied application payload. `idDocumentPath` is
 * produced server-side by the storage service from the uploaded file — it is
 * never read from the client.
 */
export interface SellerApplicationInput {
  storeName: string;
  storeDescription?: string;
  email: string;
  emergencyContact?: string;
  address: string;
  idDocumentPath?: string;
  idDocumentMimeType?: string;
}

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
  private prisma: typeof prisma;
  private email: EmailServiceClass;

  constructor(prismaClient: typeof prisma = prisma, emailClient: EmailServiceClass = emailService) {
    this.prisma = prismaClient;
    this.email = emailClient;
  }

  /**
   * GET the current EMART Seller Agreement plus the caller's acceptance
   * state. The version and text are server-controlled constants — the client
   * only reads them. `accepted` is true when the stored acceptance matches
   * the current server version.
   */
  async getAgreement(userId: string) {
    const acceptance = await this.prisma.sellerAgreementAcceptance.findUnique({
      where: { userId },
    });
    return {
      title: SELLER_AGREEMENT_TITLE,
      version: SELLER_AGREEMENT_VERSION,
      text: SELLER_AGREEMENT_TEXT,
      acceptedVersion: acceptance?.version ?? null,
      acceptedAt: acceptance?.acceptedAt ?? null,
      accepted: acceptance?.version === SELLER_AGREEMENT_VERSION,
    };
  }

  /**
   * POST — record acceptance of the CURRENT agreement version. The version
   * and timestamp are assigned server-side; the client body is ignored.
   */
  async acceptAgreement(userId: string) {
    const acceptance = await this.prisma.sellerAgreementAcceptance.upsert({
      where: { userId },
      update: { version: SELLER_AGREEMENT_VERSION, acceptedAt: new Date() },
      create: { userId, version: SELLER_AGREEMENT_VERSION },
      select: { id: true, userId: true, version: true, acceptedAt: true },
    });
    return {
      accepted: true,
      version: acceptance.version,
      acceptedAt: acceptance.acceptedAt,
    };
  }

  /**
   * Application submission/resubmission requires acceptance of the current
   * agreement version — an older (or missing) acceptance forces re-acceptance.
   */
  private async assertAgreementAccepted(userId: string) {
    const acceptance = await this.prisma.sellerAgreementAcceptance.findUnique({
      where: { userId },
    });
    if (!acceptance || acceptance.version !== SELLER_AGREEMENT_VERSION) {
      throw new ValidationError(
        'You must read and accept the current EMART Seller Agreement before submitting your application.',
      );
    }
  }

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
   * Normalized, validated "Become a Seller" application fields. All protected
   * values (userId, status, reviewedBy, reviewedAt, idDocumentPath) are derived
   * server-side and never come from this payload.
   */
  private applicationInput(data: SellerApplicationInput) {
    const storeName = String(data.storeName ?? '').replace(/\s+/g, ' ').trim();
    const storeDescription = String(data.storeDescription ?? '').replace(/\s+/g, ' ').trim();
    const email = String(data.email ?? '').trim().toLowerCase();
    const emergencyContact = String(data.emergencyContact ?? '').replace(/\s+/g, ' ').trim();
    const address = String(data.address ?? '').replace(/\s+/g, ' ').trim();

    if (storeName.length < 3 || storeName.length > 80) {
      throw new ValidationError('Shop name must be between 3 and 80 characters.');
    }
    if (storeDescription && (storeDescription.length < 10 || storeDescription.length > 2000)) {
      throw new ValidationError('Store description must be between 10 and 2000 characters.');
    }
    if (!EMAIL_REGEX.test(email) || email.length > 254) {
      throw new ValidationError('Please provide a valid email address.');
    }
    if (address.length < 5 || address.length > 300) {
      throw new ValidationError('Address must be between 5 and 300 characters.');
    }
    if (emergencyContact && (emergencyContact.length < 3 || emergencyContact.length > 120)) {
      throw new ValidationError('Emergency contact must be between 3 and 120 characters.');
    }

    return { storeName, storeDescription, email, emergencyContact, address };
  }

  /**
   * A user owns exactly one application row (DB-unique userId), so a second
   * pending application is impossible by construction. This guard produces the
   * user-facing 409 for the state transitions that are not a resubmission.
   */
  private assertNotDuplicatePending(existing: { status: SellerStatus } | null) {
    if (!existing) return;
    if (existing.status === 'PENDING') {
      throw new ConflictError('You already have an application under review.');
    }
    if (existing.status === 'APPROVED') {
      throw new ConflictError('Your seller application has already been approved.');
    }
    if (existing.status === 'SUSPENDED') {
      throw new ConflictError('Your seller account is suspended. Contact support.');
    }
  }

  /**
   * POST /seller/application — submit a first application or resubmit a
   * rejected one (same row). Everything else is a 409 conflict.
   */
  async submitApplication(userId: string, data: SellerApplicationInput) {
    // Submitting (or resubmitting) requires accepting the CURRENT agreement
    // version first — enforced server-side, never from the client.
    await this.assertAgreementAccepted(userId);

    const input = this.applicationInput(data);

    const existing = await this.prisma.sellerApplication.findUnique({ where: { userId } });
    this.assertNotDuplicatePending(existing);

    // An identity document is mandatory for a new application. A rejected
    // applicant may keep their previously uploaded document on resubmission.
    const hasNewDocument = Boolean(data.idDocumentPath);
    if (!hasNewDocument && !existing?.idDocumentPath) {
      throw new ValidationError(
        'Please upload a clear photo or scan of your ID, passport, or driver\'s license.',
      );
    }

    const documentFields = hasNewDocument
      ? { idDocumentPath: data.idDocumentPath!, idDocumentMimeType: data.idDocumentMimeType ?? null }
      : {};

    const applicationSelect = {
      id: true,
      storeName: true,
      storeDescription: true,
      email: true,
      emergencyContact: true,
      address: true,
      status: true,
      rejectionReason: true,
      submittedAt: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    } as const;

    if (existing) {
      // REJECTED → resubmission reuses the same row (documented behavior).
      const updated = await this.prisma.sellerApplication.update({
        where: { userId },
        data: {
          ...input,
          ...documentFields,
          status: 'PENDING',
          rejectionReason: null,
          reviewedAt: null,
          reviewedBy: null,
          submittedAt: new Date(),
        },
        select: { ...applicationSelect, idDocumentPath: true },
      });
      // Superseded document removed only after the row is safely updated.
      if (hasNewDocument && existing.idDocumentPath && existing.idDocumentPath !== data.idDocumentPath) {
        await sellerDocumentStorageService.deleteSellerDocument(existing.idDocumentPath);
      }
      return this.withoutDocumentPath(updated);
    }

    const created = await this.prisma.sellerApplication.create({
      data: { userId, ...input, ...documentFields, status: 'PENDING' },
      select: { ...applicationSelect, idDocumentPath: true },
    });
    return this.withoutDocumentPath(created);
  }

  /**
   * Strip the private storage path from any customer-facing payload and expose
   * only a boolean so the UI can show whether a document is on file.
   */
  private withoutDocumentPath<T extends { idDocumentPath?: string | null }>(row: T) {
    const { idDocumentPath, ...rest } = row;
    return { ...rest, hasIdDocument: Boolean(idDocumentPath) };
  }

  /**
   * GET /seller/application — the caller's own application (userId derived
   * from the token). Returns null when none exists; never another user's.
   */
  async getMyApplication(userId: string) {
    const application = await this.prisma.sellerApplication.findUnique({
      where: { userId },
      select: {
        id: true,
        storeName: true,
        storeDescription: true,
        email: true,
        emergencyContact: true,
        address: true,
        status: true,
        rejectionReason: true,
        submittedAt: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
        idDocumentPath: true,
      },
    });
    return application ? this.withoutDocumentPath(application) : null;
  }

  /**
   * GET /seller/profile — the caller's own seller identity, if any.
   * The authorization foundation for future phases: resolves the profile
   * strictly through the authenticated userId.
   */
  async getMyProfile(userId: string) {
    return this.prisma.sellerProfile.findUnique({
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
    const existing = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundError('Seller profile not found.');
    }
    return this.prisma.sellerProfile.update({
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
    const profile = await this.prisma.sellerProfile.findUnique({ where: { userId } });
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
      this.prisma.sellerApplication.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          storeName: true,
          storeDescription: true,
          email: true,
          emergencyContact: true,
          address: true,
          status: true,
          rejectionReason: true,
          submittedAt: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
          idDocumentPath: true,
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
      this.prisma.sellerApplication.count({ where }),
    ]);

    const applications = items.map((item) => this.withoutDocumentPath(item));

    return {
      applications,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  /** ADMIN — full application detail incl. applicant identity. */
  async getApplicationById(applicationId: string) {
    const application = await this.prisma.sellerApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        storeName: true,
        storeDescription: true,
        email: true,
        emergencyContact: true,
        address: true,
        status: true,
        rejectionReason: true,
        submittedAt: true,
        reviewedAt: true,
        reviewedBy: true,
        createdAt: true,
        updatedAt: true,
        idDocumentPath: true,
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
    return this.withoutDocumentPath(application);
  }

  /**
   * ADMIN — resolve the private storage path for an application's identity
   * document so the controller can mint a short-lived signed URL. The path is
   * never returned to the client.
   */
  async getApplicationDocumentPath(applicationId: string): Promise<string> {
    const application = await this.prisma.sellerApplication.findUnique({
      where: { id: applicationId },
      select: { idDocumentPath: true },
    });
    if (!application) {
      throw new NotFoundError('Seller application not found.');
    }
    if (!application.idDocumentPath) {
      throw new NotFoundError('This application has no identity document on file.');
    }
    return application.idDocumentPath;
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
    const application = await this.prisma.sellerApplication.findUnique({
      where: { id: applicationId },
      // Recipient preference: the application email supplied during the
      // "Become a Seller" form, falling back to the applying account's email
      // (minimal select: email + display name only).
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    });
    if (!application) {
      throw new NotFoundError('Seller application not found.');
    }
    this.assertApplicationTransition(application.status as SellerStatus, 'APPROVED');

    const review: ApplicationReviewContext = { reviewedBy: adminId, reviewedAt: new Date() };

    // Approval is committed to the DB FIRST — the confirmation email is sent
    // strictly AFTER the transaction succeeds, so an email failure can never
    // roll back an approved seller. The notification outcome is surfaced on
    // the response but never drives the approval result.
    const [updated] = await this.prisma.$transaction([
      this.prisma.sellerApplication.update({
        where: { id: application.id },
        data: { status: 'APPROVED', rejectionReason: null, ...review },
      }),
      // One identity per user — upsert keeps approval idempotent and the DB
      // unique constraint guarantees no second profile can ever appear.
      this.prisma.sellerProfile.upsert({
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

    let email: SendEmailResult;
    try {
      const { user } = application;
      const applicantName =
        user?.firstName || user?.lastName
          ? [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || undefined
          : undefined;
      email = await this.email.sendSellerApprovalEmail({
        to: application.email || user?.email || '',
        applicantName,
        storeName: updated.storeName,
      });
    } catch (err) {
      // Defensive window: a throwing sender must never propagate past a
      // successful approval.
      email = { sent: false, error: err instanceof Error ? err.message : String(err) };
    }
    if (!email.sent) {
      const detail = email.error ? email.error : email.reason ? email.reason : 'unknown';
      console.error(
        `[SellerService] Seller application ${application.id} approved but the approval email was not sent (${detail}).`,
      );
    }

    // Preserves the pre-existing response shape (the approved application,
    // with the private document path stripped) while exposing the notification
    // outcome to the API caller.
    return { ...this.withoutDocumentPath(updated), email };
  }

  /** ADMIN — PENDING → REJECTED with a required, validated reason. */
  async rejectApplication(applicationId: string, adminId: string, reason: string) {
    const application = await this.prisma.sellerApplication.findUnique({ where: { id: applicationId } });
    if (!application) {
      throw new NotFoundError('Seller application not found.');
    }
    this.assertApplicationTransition(application.status as SellerStatus, 'REJECTED');

    const trimmed = reason.replace(/\s+/g, ' ').trim();
    if (trimmed.length < 3 || trimmed.length > 1000) {
      throw new ValidationError('Rejection reason must be between 3 and 1000 characters.');
    }

    const updated = await this.prisma.sellerApplication.update({
      where: { id: application.id },
      data: { status: 'REJECTED', rejectionReason: trimmed, reviewedBy: adminId, reviewedAt: new Date() },
    });

    // The private document path never leaves the server on this response either.
    return this.withoutDocumentPath(updated);
  }

  /** ADMIN — APPROVED → SUSPENDED on the seller profile (identity preserved). */
  async suspendSeller(sellerId: string, adminId: string) {
    const profile = await this.prisma.sellerProfile.findUnique({ where: { id: sellerId } });
    if (!profile) {
      throw new NotFoundError('Seller profile not found.');
    }
    this.assertApplicationTransition(profile.status as SellerStatus, 'SUSPENDED');

    return this.prisma.sellerProfile.update({
      where: { id: profile.id },
      data: { status: 'SUSPENDED', suspendedAt: new Date() },
    });
  }

  /** ADMIN — SUSPENDED → APPROVED on the seller profile. */
  async activateSeller(sellerId: string, adminId: string) {
    const profile = await this.prisma.sellerProfile.findUnique({ where: { id: sellerId } });
    if (!profile) {
      throw new NotFoundError('Seller profile not found.');
    }
    void adminId;
    this.assertApplicationTransition(profile.status as SellerStatus, 'APPROVED');

    return this.prisma.sellerProfile.update({
      where: { id: profile.id },
      data: { status: 'APPROVED', suspendedAt: null },
    });
  }
}

export default new SellerService();
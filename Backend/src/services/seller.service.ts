import prisma from '../config/database';
import emailService, { EmailService as EmailServiceClass, SendEmailResult } from './email.service';
import notificationServiceSingleton, { NotificationService as NotificationServiceClass, NotificationType } from './notification.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { Prisma, SellerStatus, PaymentMethodType, OrderStatus, PaymentStatus } from '@prisma/client';
import { SELLER_AGREEMENT_VERSION, SELLER_AGREEMENT_TEXT, SELLER_AGREEMENT_TITLE } from '../config/sellerAgreement';
import sellerDocumentStorageService, {
  SellerDocumentUpload,
} from './seller-document-storage.service';
import sellerShopMediaStorageService, { ShopMediaKind } from './seller-shop-media-storage.service';

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

/* ------------------------------------------------------------------ *
 * SALES REPORTING
 * ------------------------------------------------------------------ */

/** Order states whose line amounts are never counted as seller revenue. */
const NON_REVENUE_ORDER_STATUSES: OrderStatus[] = ['CANCELLED', 'REFUNDED'];

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SALES_RANGE_DAYS = 30;
/** Hard ceiling on the report window (inclusive day count). */
const MAX_SALES_RANGE_DAYS = 366;
const TOP_PRODUCTS_LIMIT = 5;
const RECENT_ORDERS_LIMIT = 5;

const startOfUtcDay = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

/** Inclusive end of the UTC day `value` falls in. */
const endOfUtcDay = (value: Date): Date => new Date(startOfUtcDay(value).getTime() + DAY_MS - 1);

const utcDayKey = (value: Date): string => startOfUtcDay(value).toISOString().slice(0, 10);

/** Money is stored as Float; every reported figure is rounded to cents. */
const money = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * One seller-scoped order line as read for the report. `serviceFeeAtPurchase`
 * and `domesticShippingAtPurchase` are already multiplied by the line
 * quantity at order creation time, while `priceAtPurchase` is the unit price.
 */
interface SalesItemRow {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  orderCreatedAt: Date;
  productId: string;
  productName: string;
  productImage: string | null;
  quantity: number;
  priceAtPurchase: number;
  serviceFeeAtPurchase: number;
  domesticShippingAtPurchase: number;
}

export interface SellerSalesTotals {
  revenue: number;
  serviceFees: number;
  shippingCharges: number;
  netEarnings: number;
  itemsSold: number;
  orderCount: number;
  averageOrderValue: number;
  paidRevenue: number;
  pendingRevenue: number;
  excludedOrders: number;
  excludedRevenue: number;
}

export interface SellerSalesPoint {
  date: string;
  revenue: number;
  netEarnings: number;
  orders: number;
  units: number;
}

export interface SellerSalesProduct {
  productId: string;
  name: string;
  image: string | null;
  unitsSold: number;
  revenue: number;
  orderCount: number;
}

export interface SellerSalesOrder {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  revenue: number;
  items: number;
  units: number;
}

export interface SellerSalesReport {
  storeName: string;
  currency: string;
  /** Inclusive window as YYYY-MM-DD day keys, matching `series[].date`. */
  range: { startDate: string; endDate: string; days: number };
  summary: SellerSalesTotals;
  /** Same-length window immediately before `range` — the comparison baseline. */
  previous: { revenue: number; orderCount: number };
  /** Percent change vs `previous`; null when the baseline is zero. */
  change: { revenuePercent: number | null; orderPercent: number | null };
  series: SellerSalesPoint[];
  topProducts: SellerSalesProduct[];
  recentOrders: SellerSalesOrder[];
}

/** Percent change from `previous` to `current`; null when there is no baseline. */
const percentChange = (current: number, previous: number): number | null =>
  previous > 0 ? money(((current - previous) / previous) * 100) : null;

/**
 * Folds seller order lines into the totals/day/product/order buckets the
 * report is built from. Cancelled and refunded orders are tracked separately
 * and never contribute to revenue, orders or units.
 */
const aggregateSalesItems = (rows: SalesItemRow[]) => {
  const orders = new Map<string, SellerSalesOrder>();
  const excluded = new Map<string, number>();
  const days = new Map<string, SellerSalesPoint>();
  const products = new Map<
    string,
    { product: SellerSalesProduct; orderIds: Set<string> }
  >();

  let revenue = 0;
  let serviceFees = 0;
  let shippingCharges = 0;
  let netEarnings = 0;
  let itemsSold = 0;
  let paidRevenue = 0;
  let pendingRevenue = 0;

  for (const row of rows) {
    const gross = money(row.priceAtPurchase * row.quantity);

    if (NON_REVENUE_ORDER_STATUSES.includes(row.orderStatus)) {
      excluded.set(row.orderId, money((excluded.get(row.orderId) ?? 0) + gross));
      continue;
    }

    const fees = money(row.serviceFeeAtPurchase);
    const shipping = money(row.domesticShippingAtPurchase);
    const net = money(gross - fees - shipping);

    revenue += gross;
    serviceFees += fees;
    shippingCharges += shipping;
    netEarnings += net;
    itemsSold += row.quantity;
    if (row.paymentStatus === 'PAID') paidRevenue += gross;
    if (row.paymentStatus === 'PENDING') pendingRevenue += gross;

    const order = orders.get(row.orderId) ?? {
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      status: row.orderStatus,
      paymentStatus: row.paymentStatus,
      createdAt: row.orderCreatedAt,
      revenue: 0,
      items: 0,
      units: 0,
    };
    order.revenue = money(order.revenue + gross);
    order.items += 1;
    order.units += row.quantity;
    orders.set(row.orderId, order);

    const key = utcDayKey(row.orderCreatedAt);
    const day = days.get(key) ?? {
      date: key,
      revenue: 0,
      netEarnings: 0,
      orders: 0,
      units: 0,
    };
    day.revenue = money(day.revenue + gross);
    day.netEarnings = money(day.netEarnings + net);
    day.units += row.quantity;
    days.set(key, day);

    const product = products.get(row.productId) ?? {
      product: {
        productId: row.productId,
        name: row.productName,
        image: row.productImage,
        unitsSold: 0,
        revenue: 0,
        orderCount: 0,
      },
      orderIds: new Set<string>(),
    };
    product.product.unitsSold += row.quantity;
    product.product.revenue = money(product.product.revenue + gross);
    product.orderIds.add(row.orderId);
    products.set(row.productId, product);
  }

  // Distinct orders per day bucket.
  const dayOrderIds = new Map<string, Set<string>>();
  for (const row of rows) {
    if (NON_REVENUE_ORDER_STATUSES.includes(row.orderStatus)) continue;
    const key = utcDayKey(row.orderCreatedAt);
    const ids = dayOrderIds.get(key) ?? new Set<string>();
    ids.add(row.orderId);
    dayOrderIds.set(key, ids);
  }
  for (const [key, day] of days) {
    day.orders = dayOrderIds.get(key)?.size ?? 0;
  }

  const orderCount = orders.size;

  return {
    totals: {
      revenue: money(revenue),
      serviceFees: money(serviceFees),
      shippingCharges: money(shippingCharges),
      netEarnings: money(netEarnings),
      itemsSold,
      orderCount,
      averageOrderValue: orderCount > 0 ? money(revenue / orderCount) : 0,
      paidRevenue: money(paidRevenue),
      pendingRevenue: money(pendingRevenue),
      excludedOrders: excluded.size,
      excludedRevenue: money([...excluded.values()].reduce((sum, value) => sum + value, 0)),
    } satisfies SellerSalesTotals,
    days,
    products,
    orders: [...orders.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    ),
  };
};

export class SellerService {
  private prisma: typeof prisma;
  private email: EmailServiceClass;
  private notifications: NotificationServiceClass;

  constructor(
    prismaClient: typeof prisma = prisma,
    emailClient: EmailServiceClass = emailService,
    notificationClient: NotificationServiceClass = notificationServiceSingleton,
  ) {
    this.prisma = prismaClient;
    this.email = emailClient;
    this.notifications = notificationClient;
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
   *
   * `uploadedFile` is the raw Multer payload from the request (thinned down to
   * the three fields the storage service needs). When present it is uploaded
   * to the private bucket CONCURRENTLY with the read-only pre-checks, instead
   * of the previous fully serial upload-then-check flow. `idDocumentPath` in
   * `data` is still honored for callers that supply a pre-uploaded document
   * (unit tests) — the real controller never sets it.
   */
  async submitApplication(
    userId: string,
    data: SellerApplicationInput,
    uploadedFile?: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    // Cheap, synchronous, local validation runs first — nothing remote starts
    // before the payload itself is known to be well-formed.
    const input = this.applicationInput(data);

    const hasUploadedFile = Boolean(uploadedFile);
    const hasPreUploadedPath = Boolean(data.idDocumentPath);

    // All three independent operations start immediately:
    //  - current-agreement acceptance check (read-only remote call)
    //  - the caller's existing application row (read-only remote call)
    //  - the private-storage upload of the identity document (when supplied)
    // The document upload never races the create/update; the row is only ever
    // written after the upload has succeeded, so an application can never
    // exist without its document. See the try/catch below for the no-orphan
    // guarantee when anything after the upload fails.
    const existingPromise = this.prisma.sellerApplication.findUnique({
      where: { userId },
    });
    const agreementPromise = this.assertAgreementAccepted(userId);
    const uploadedPromise: Promise<SellerDocumentUpload | null> = hasUploadedFile
      ? sellerDocumentStorageService.uploadSellerDocument(
          userId,
          uploadedFile!.buffer,
          uploadedFile!.originalname,
          uploadedFile!.mimetype,
        )
      : Promise.resolve(null);

    try {
      const [existing] = await Promise.all([existingPromise, agreementPromise]);
      this.assertNotDuplicatePending(existing);

      const uploaded = await uploadedPromise;
      const documentPath = uploaded?.path ?? data.idDocumentPath;
      const documentMimeType = uploaded?.mimetype ?? data.idDocumentMimeType;
      const hasNewDocument = Boolean(documentPath);

      // An identity document is mandatory for a new application. A rejected
      // applicant may keep their previously uploaded document on resubmission.
      if (!hasNewDocument && !existing?.idDocumentPath) {
        throw new ValidationError(
          'Please upload a clear photo or scan of your ID, passport, or driver\'s license.',
        );
      }

      const documentFields = hasNewDocument
        ? { idDocumentPath: documentPath!, idDocumentMimeType: documentMimeType ?? null }
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
        // Superseded document is removed only after the row is safely updated.
        if (hasNewDocument && existing.idDocumentPath && existing.idDocumentPath !== documentPath) {
          await sellerDocumentStorageService.deleteSellerDocument(existing.idDocumentPath);
        }
        // A resubmission re-enters the review queue just like a first
        // submission, so admins get alerted for it too.
        await this.notifyAdminsOfPendingApplication(input.storeName);
        return this.withoutDocumentPath(updated);
      }

      const created = await this.prisma.sellerApplication.create({
        data: { userId, ...input, ...documentFields, status: 'PENDING' },
        select: { ...applicationSelect, idDocumentPath: true },
      });
      await this.notifyAdminsOfPendingApplication(created.storeName);
      return this.withoutDocumentPath(created);
    } catch (error) {
      // A failure anywhere after the upload started must never orphan the
      // freshly uploaded private document. Wait for the upload to settle (it
      // may still be in flight) and then remove its object from storage.
      if (hasUploadedFile) {
        const uploaded = await uploadedPromise.catch(() => null);
        if (uploaded?.path) {
          await sellerDocumentStorageService.deleteSellerDocument(uploaded.path);
        }
      }
      throw error;
    }
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
   * Fan out a `SELLER_APPLICATION_STATUS` notification to every admin when an
   * application enters (or re-enters) the PENDING review queue.
   *
   * Runs after the application row is safely persisted, and never throws: a
   * failed in-app alert must not roll back a submission the applicant already
   * completed, so the error is logged instead. The inserts are independent, so
   * they run concurrently rather than once per admin in sequence.
   */
  private async notifyAdminsOfPendingApplication(storeName: string) {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });

      await Promise.all(
        admins.map((admin) =>
          this.notifications.create({
            userId: admin.id,
            type: NotificationType.SELLER_APPLICATION_STATUS,
            title: 'New Seller Application Submitted',
            body: `A new seller application for "${storeName}" is awaiting your review.`,
          }),
        ),
      );
    } catch (error) {
      console.error(
        `[SellerService] Could not notify admins about a new seller application for "${storeName}":`,
        error instanceof Error ? error.message : error,
      );
    }
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
        logoUrl: true,
        bannerUrl: true,
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
        logoUrl: true,
        bannerUrl: true,
      },
    });
  }

  /**
   * PUT/DELETE /seller/profile/:kind — set or remove the logo/banner on the
   * caller's own store profile. Works for APPROVED and SUSPENDED sellers
   * (suspension gates product management, not the seller's own store edits).
   * The storage path is private; only the public URL is ever returned.
   */
  async updateShopMedia(
    userId: string,
    kind: ShopMediaKind,
    media: { path: string; url: string },
  ) {
    const existing = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundError('Seller profile not found.');
    }

    const pathField = kind === 'logo' ? 'logoPath' : 'bannerPath';
    const urlField = kind === 'logo' ? 'logoUrl' : 'bannerUrl';
    const previousPath = existing[pathField];

    const updated = await this.prisma.sellerProfile.update({
      where: { userId },
      data: {
        [urlField]: media.url,
        [pathField]: media.path,
      },
      select: {
        id: true,
        storeName: true,
        storeDescription: true,
        status: true,
        suspendedAt: true,
        createdAt: true,
        updatedAt: true,
        logoUrl: true,
        bannerUrl: true,
      },
    });

    // The superseded object is removed only after the row is safely updated,
    // and cleanup is best-effort — a failed delete must never fail the upload.
    if (previousPath && previousPath !== media.path) {
      await sellerShopMediaStorageService.deleteShopMedia(previousPath);
    }

    return updated;
  }

  async removeShopMedia(userId: string, kind: ShopMediaKind) {
    const existing = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundError('Seller profile not found.');
    }

    const pathField = kind === 'logo' ? 'logoPath' : 'bannerPath';
    const urlField = kind === 'logo' ? 'logoUrl' : 'bannerUrl';
    const previousPath = existing[pathField];

    const updated = await this.prisma.sellerProfile.update({
      where: { userId },
      data: {
        [urlField]: null,
        [pathField]: null,
      },
      select: {
        id: true,
        storeName: true,
        storeDescription: true,
        status: true,
        suspendedAt: true,
        createdAt: true,
        updatedAt: true,
        logoUrl: true,
        bannerUrl: true,
      },
    });

    if (previousPath) {
      await sellerShopMediaStorageService.deleteShopMedia(previousPath);
    }

    return updated;
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
      // ROLE SEPARATION — approval is the only event that promotes a buyer to
      // a seller-only account. It lives in the same transaction as the profile
      // so the role and the seller identity can never disagree. A PENDING or
      // REJECTED applicant stays CUSTOMER and keeps buying.
      this.prisma.user.update({
        where: { id: application.userId },
        data: { role: 'SELLER' },
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

    // ROLE SEPARATION — a suspended store is not a seller-only account any
    // more, so the role is demoted to CUSTOMER in the same transaction. The
    // profile and its history survive; activateSeller promotes it again.
    const [suspended] = await this.prisma.$transaction([
      this.prisma.sellerProfile.update({
        where: { id: profile.id },
        data: { status: 'SUSPENDED', suspendedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: profile.userId },
        data: { role: 'CUSTOMER' },
      }),
    ]);
    return suspended;
  }

  /** ADMIN — SUSPENDED → APPROVED on the seller profile. */
  async activateSeller(sellerId: string, adminId: string) {
    const profile = await this.prisma.sellerProfile.findUnique({ where: { id: sellerId } });
    if (!profile) {
      throw new NotFoundError('Seller profile not found.');
    }
    void adminId;
    this.assertApplicationTransition(profile.status as SellerStatus, 'APPROVED');

    // ROLE SEPARATION — reactivation restores the seller-only role.
    const [activated] = await this.prisma.$transaction([
      this.prisma.sellerProfile.update({
        where: { id: profile.id },
        data: { status: 'APPROVED', suspendedAt: null },
      }),
      this.prisma.user.update({
        where: { id: profile.userId },
        data: { role: 'SELLER' },
      }),
    ]);
    return activated;
  }

  /**
   * Seller payment methods (payout methods) — sellers manage their own
   * withdrawal methods. Only accessible to authenticated sellers.
   */

  /** GET /seller/payment-methods — list caller's payment methods. */
  async listPaymentMethods(userId: string) {
    const profile = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundError('Seller profile not found.');
    }
    return this.prisma.sellerPaymentMethod.findMany({
      where: { sellerId: profile.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        type: true,
        details: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /** POST /seller/payment-methods — add a new payment method. */
  async addPaymentMethod(
    userId: string,
    type: string,
    details: Record<string, any>,
    isDefault?: boolean,
  ) {
    const profile = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundError('Seller profile not found.');
    }

    // If this is the first method, make it default
    const existingCount = await this.prisma.sellerPaymentMethod.count({
      where: { sellerId: profile.id },
    });
    const shouldBeDefault = isDefault ?? existingCount === 0;

    // If setting as default, unset any existing default
    if (shouldBeDefault) {
      await this.prisma.sellerPaymentMethod.updateMany({
        where: { sellerId: profile.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.sellerPaymentMethod.create({
      data: {
        sellerId: profile.id,
        type: type as PaymentMethodType,
        details,
        isDefault: shouldBeDefault,
        isActive: true,
      },
      select: {
        id: true,
        type: true,
        details: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /** PUT /seller/payment-methods/:id — update a payment method. */
  async updatePaymentMethod(
    userId: string,
    paymentMethodId: string,
    data: { details?: Record<string, any>; isDefault?: boolean; isActive?: boolean },
  ) {
    const profile = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundError('Seller profile not found.');
    }

    const method = await this.prisma.sellerPaymentMethod.findFirst({
      where: { id: paymentMethodId, sellerId: profile.id },
    });
    if (!method) {
      throw new NotFoundError('Payment method not found.');
    }

    // If setting as default, unset any existing default
    if (data.isDefault === true) {
      await this.prisma.sellerPaymentMethod.updateMany({
        where: { sellerId: profile.id, isDefault: true, id: { not: paymentMethodId } },
        data: { isDefault: false },
      });
    }

    return this.prisma.sellerPaymentMethod.update({
      where: { id: paymentMethodId },
      data: {
        details: data.details ?? method.details,
        isDefault: data.isDefault ?? method.isDefault,
        isActive: data.isActive ?? method.isActive,
      },
      select: {
        id: true,
        type: true,
        details: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /** DELETE /seller/payment-methods/:id — delete a payment method. */
  async deletePaymentMethod(userId: string, paymentMethodId: string) {
    const profile = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundError('Seller profile not found.');
    }

    const method = await this.prisma.sellerPaymentMethod.findFirst({
      where: { id: paymentMethodId, sellerId: profile.id },
    });
    if (!method) {
      throw new NotFoundError('Payment method not found.');
    }

    const wasDefault = method.isDefault;

    await this.prisma.sellerPaymentMethod.delete({ where: { id: paymentMethodId } });

    // If deleted method was default, make another one default
    if (wasDefault) {
      const remaining = await this.prisma.sellerPaymentMethod.findFirst({
        where: { sellerId: profile.id },
        orderBy: { createdAt: 'asc' },
      });
      if (remaining) {
        await this.prisma.sellerPaymentMethod.update({
          where: { id: remaining.id },
          data: { isDefault: true },
        });
      }
    }
  }

  /**
   * GET /seller/sales — store-scoped sales report.
   *
   * Every figure is derived from the caller's own SellerProfile: the only
   * order lines read are those whose product is owned by this seller, and each
   * order contributes only the seller's own lines (unit price × quantity,
   * minus the service fee and domestic shipping captured on the line) — never
   * the customer's whole order total. Cancelled and refunded orders are
   * reported separately and excluded from revenue, order and unit counts.
   *
   * `startDate`/`endDate` are optional and inclusive; the window is capped at
   * MAX_SALES_RANGE_DAYS. A `null` percent change means there was no prior
   * period to compare against (the UI shows "—" rather than inventing 0%).
   */
  async getSalesReport(
    userId: string,
    range?: { startDate?: Date; endDate?: Date },
  ): Promise<SellerSalesReport> {
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
      select: { id: true, storeName: true },
    });
    if (!profile) {
      throw new NotFoundError('Seller profile not found.');
    }

    const endDate = startOfUtcDay(range?.endDate ?? new Date());
    const startDate = startOfUtcDay(
      range?.startDate ?? new Date(endDate.getTime() - (DEFAULT_SALES_RANGE_DAYS - 1) * DAY_MS),
    );
    if (startDate.getTime() > endDate.getTime()) {
      throw new ValidationError('startDate must be on or before endDate.');
    }
    if (endDate.getTime() - startDate.getTime() > (MAX_SALES_RANGE_DAYS - 1) * DAY_MS) {
      throw new ValidationError(`Date range must not exceed ${MAX_SALES_RANGE_DAYS} days.`);
    }

    const days = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
    // Same-length window immediately before the requested one.
    const previousEnd = new Date(startDate.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - (days - 1) * DAY_MS);

    const [current, previous] = await Promise.all([
      this.readSalesItems(profile.id, startDate, endOfUtcDay(endDate)),
      this.readSalesItems(profile.id, previousStart, previousEnd),
    ]);

    const currentAgg = aggregateSalesItems(current);
    const previousAgg = aggregateSalesItems(previous);

    // Zero-filled daily series so the chart always spans the whole window.
    const series: SellerSalesPoint[] = [];
    for (let index = 0; index < days; index += 1) {
      const key = utcDayKey(new Date(startDate.getTime() + index * DAY_MS));
      series.push(
        currentAgg.days.get(key) ?? {
          date: key,
          revenue: 0,
          netEarnings: 0,
          orders: 0,
          units: 0,
        },
      );
    }

    const topProducts = [...currentAgg.products.values()]
      .map(({ product, orderIds }) => ({ ...product, orderCount: orderIds.size }))
      .sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold)
      .slice(0, TOP_PRODUCTS_LIMIT);

    return {
      storeName: profile.storeName,
      currency: 'USD',
      range: { startDate: utcDayKey(startDate), endDate: utcDayKey(endDate), days },
      summary: currentAgg.totals,
      previous: {
        revenue: previousAgg.totals.revenue,
        orderCount: previousAgg.totals.orderCount,
      },
      change: {
        revenuePercent: percentChange(
          currentAgg.totals.revenue,
          previousAgg.totals.revenue,
        ),
        orderPercent: percentChange(
          currentAgg.totals.orderCount,
          previousAgg.totals.orderCount,
        ),
      },
      series,
      topProducts,
      recentOrders: currentAgg.orders.slice(0, RECENT_ORDERS_LIMIT),
    };
  }

  /** Seller-owned order lines created inside [from, to], flattened for the
   *  sales aggregation. Filtered by product ownership, not by customer. */
  private async readSalesItems(sellerId: string, from: Date, to: Date): Promise<SalesItemRow[]> {
    const rows = await this.prisma.orderItem.findMany({
      where: {
        product: { sellerId },
        order: { createdAt: { gte: from, lte: to } },
      },
      select: {
        orderId: true,
        quantity: true,
        priceAtPurchase: true,
        serviceFeeAtPurchase: true,
        domesticShippingAtPurchase: true,
        order: {
          select: {
            orderNumber: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
        product: { select: { id: true, name: true, image: true, images: true } },
      },
      orderBy: { order: { createdAt: 'asc' } },
    });

    return rows.map((row) => ({
      orderId: row.orderId,
      orderNumber: row.order.orderNumber,
      orderStatus: row.order.status,
      paymentStatus: row.order.paymentStatus,
      orderCreatedAt: row.order.createdAt,
      productId: row.product.id,
      productName: row.product.name,
      productImage: row.product.image || row.product.images[0] || null,
      quantity: row.quantity,
      priceAtPurchase: row.priceAtPurchase,
      serviceFeeAtPurchase: row.serviceFeeAtPurchase,
      domesticShippingAtPurchase: row.domesticShippingAtPurchase,
    }));
  }
}

export default new SellerService();
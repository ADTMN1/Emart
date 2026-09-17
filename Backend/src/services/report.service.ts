import prisma from '../config/database';
import { ValidationError } from '../utils/errors';
import { Prisma, OrderStatus } from '@prisma/client';
import { PAYMENT_STATUSES } from './payment.service';
/**
 * Sales reports / analytics (Phase 4).
 *
 * Definitions (derived from the existing system, not invented):
 *
 * REVENUE — aligned with the existing admin Dashboard `getStats` convention:
 * SUM(Order.total) over orders whose `status` is NOT IN (CANCELLED, REFUNDED).
 * Uses stored order totals (subtotal + serviceFees + domesticShipping +
 * internationalShipping + insurance) frozen at purchase time; never current
 * product prices.
 *
 * INCLUSION — every order status except CANCELLED and REFUNDED represents a
 * real sale in this store: customers can only cancel at PENDING/
 * PAYMENT_RECEIVED (order.service cancelOrder), and the existing Deposits
 * flow maps payment FAILED → order CANCELLED. So an order whose payment
 * failed while still status=PENDING is a live sale awaiting payment, and
 * paymentStatus does NOT gate revenue.
 *
 * HISTORICAL ACCURACY — product/category revenue uses
 * OrderItem.priceAtPurchase × quantity (frozen at purchase), so product price
 * edits never rewrite history. Product/category NAMES are resolved via the
 * current product→category relation (productSnapshot contains no categoryId),
 * so renaming/moving a product re-labels history but never re-prices it.
 *
 * DATES — period presets resolve to exact UTC boundaries; custom ranges are
 * YYYY-MM-DD strings interpreted as UTC midnight-to-midnight (inclusive `to`
 * day). Bounded to 366 days. `createdAt` defines the sales period. All day
 * bucketing uses to_char(... AT TIME ZONE 'UTC') so no server-local timezone
 * can leak into bucket keys.
 *
 * PERFORMANCE — trend/product/category aggregations run entirely in
 * PostgreSQL (parameterized raw SQL); Node only zero-fills trend buckets and
 * resolves names for the current page. No full-table fetches, no N+1 loops.
 */

const DAY_MS = 86400000;
const MAX_RANGE_DAYS = 366;

/** Order statuses excluded from "realized sales" (existing getStats convention). */
const REVENUE_EXCLUDED_STATUSES: OrderStatus[] = ['CANCELLED', 'REFUNDED'];

export interface ReportRange {
  start: Date;
  endExclusive: Date;
  /** Inclusive UTC calendar dates (YYYY-MM-DD) for trend bucketing. */
  dates: string[];
  label: string;
}

interface TrendOrderRow {
  day: string;
  orders: number;
  revenue: number;
}
interface TrendUnitsRow {
  day: string;
  units: number;
}
interface ProductRow {
  productId: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
}
interface CategoryRow {
  categoryId: string | null;
  unitsSold: number;
  revenue: number;
  orderCount: number;
}

/** Parameterized "counts as a sale" predicate shared by the raw queries. */
const salesPredicate = (start: Date, endExclusive: Date) => Prisma.sql`
  o."createdAt" >= ${start} AND o."createdAt" < ${endExclusive}
  AND o."status" NOT IN ('CANCELLED', 'REFUNDED')
`;

export class ReportService {
  /**
   * Resolve a validated query into an exact UTC [start, endExclusive) window.
   * Presets are computed from "now" at request time (server UTC clock).
   */
  resolveRange(query: { period?: string; from?: string; to?: string }): ReportRange {
    const period = query.period || 'today';
    const now = new Date();

    const dayWindow = (startUtc: Date, days: number, label: string): ReportRange => {
      const dates: string[] = [];
      for (let i = 0; i < days; i++) {
        dates.push(new Date(startUtc.getTime() + i * DAY_MS).toISOString().slice(0, 10));
      }
      return {
        start: startUtc,
        endExclusive: new Date(startUtc.getTime() + days * DAY_MS),
        dates,
        label,
      };
    };

    switch (period) {
      case 'today': {
        const start = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
        return dayWindow(start, 1, 'Today');
      }
      case 'last7':
        return dayWindow(new Date(Date.now() - 7 * DAY_MS), 7, 'Last 7 days');
      case 'last30':
        return dayWindow(new Date(Date.now() - 30 * DAY_MS), 30, 'Last 30 days');
      case 'thisMonth': {
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const days = Math.round((now.getTime() - start.getTime()) / DAY_MS) + 1;
        return dayWindow(start, days, 'This month');
      }
      case 'lastMonth': {
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        const days = Math.round((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - start.getTime()) / DAY_MS);
        return dayWindow(start, days, 'Last month');
      }
      case 'custom': {
        if (!query.from || !query.to) {
          throw new ValidationError('Custom period requires from and to dates.');
        }
        const start = new Date(`${query.from}T00:00:00.000Z`);
        if (Number.isNaN(start.getTime())) throw new ValidationError('Invalid from date.');
        const endExclusive = new Date(`${query.to}T00:00:00.000Z`);
        endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
        if (Number.isNaN(endExclusive.getTime())) throw new ValidationError('Invalid to date.');
        if (endExclusive <= start) throw new ValidationError('The end date must be on or after the start date.');
        const days = Math.round((endExclusive.getTime() - start.getTime()) / DAY_MS);
        if (days > MAX_RANGE_DAYS) {
          throw new ValidationError(`Date range is limited to ${MAX_RANGE_DAYS} days.`);
        }
        const dates: string[] = [];
        for (let i = 0; i < days; i++) {
          dates.push(new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10));
        }
        return { start, endExclusive, dates, label: `${query.from} → ${query.to}` };
      }
      default:
        throw new ValidationError(`Unknown period: ${period}`);
    }
  }

  /** A. Overview KPIs — three parallel database aggregates. */
  async getOverview(query: { period?: string; from?: string; to?: string }) {
    const range = this.resolveRange(query);
    const where = {
      createdAt: { gte: range.start, lt: range.endExclusive },
      status: { notIn: REVENUE_EXCLUDED_STATUSES },
    };

    const [orderAgg, itemAgg, paymentRows] = await Promise.all([
      prisma.order.aggregate({
        where,
        _count: { _all: true },
        _sum: { total: true },
        _avg: { total: true },
      }),
      prisma.orderItem.aggregate({
        where: { order: where },
        _sum: { quantity: true },
      }),
      prisma.order.groupBy({
        by: ['paymentStatus'],
        where,
        _count: { _all: true },
      }),
    ]);

    const paymentCounts = Object.fromEntries(PAYMENT_STATUSES.map((s) => [s, 0])) as Record<string, number>;
    for (const row of paymentRows) {
      paymentCounts[row.paymentStatus] = row._count._all;
    }

    return {
      period: range.label,
      from: range.start.toISOString(),
      to: range.endExclusive.toISOString(),
      totalOrders: orderAgg._count._all,
      revenue: orderAgg._sum.total ?? 0,
      averageOrderValue: orderAgg._avg.total ?? 0,
      unitsSold: itemAgg._sum.quantity ?? 0,
      paidOrders: paymentCounts.PAID ?? 0,
      pendingPaymentOrders: paymentCounts.PENDING ?? 0,
      failedPaymentOrders: paymentCounts.FAILED ?? 0,
      refundedOrders: paymentCounts.REFUNDED ?? 0,
    };
  }

  /**
   * B. Daily trend — grouped in PostgreSQL (to_char UTC day), zero-filled in
   * Node across the requested bucket list so charts get a continuous axis.
   */
  async getTrend(query: { period?: string; from?: string; to?: string }) {
    const range = this.resolveRange(query);

    const [orderRows, unitRows] = await Promise.all([
      prisma.$queryRaw<TrendOrderRow[]>`
        SELECT to_char(o."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS orders,
               COALESCE(SUM(o."total"), 0)::float AS revenue
        FROM orders o
        WHERE o."createdAt" >= ${range.start} AND o."createdAt" < ${range.endExclusive}
          AND o."status" NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY 1
      `,
      prisma.$queryRaw<TrendUnitsRow[]>`
        SELECT to_char(o."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
               COALESCE(SUM(oi."quantity"), 0)::int AS units
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        WHERE o."createdAt" >= ${range.start} AND o."createdAt" < ${range.endExclusive}
          AND o."status" NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY 1
      `,
    ]);

    const byDay = new Map<string, { revenue: number; orders: number; units: number }>();
    for (const date of range.dates) byDay.set(date, { revenue: 0, orders: 0, units: 0 });
    for (const row of orderRows) {
      const bucket = byDay.get(row.day);
      if (bucket) {
        bucket.revenue += row.revenue ?? 0;
        bucket.orders += row.orders ?? 0;
      }
    }
    for (const row of unitRows) {
      const bucket = byDay.get(row.day);
      if (bucket) bucket.units += row.units ?? 0;
    }

    return {
      period: range.label,
      from: range.start.toISOString(),
      to: range.endExclusive.toISOString(),
      days: range.dates.map((date) => ({ date, ...byDay.get(date)! })),
    };
  }

  /** C. Order-status breakdown for the range (includes cancelled/refunded here). */
  async getStatusBreakdown(query: { period?: string; from?: string; to?: string }) {
    const range = this.resolveRange(query);
    const rows = await prisma.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: range.start, lt: range.endExclusive } },
      _count: { _all: true },
    });
    return {
      period: range.label,
      breakdown: rows
        .map((r) => ({ status: r.status, count: r._count._all }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /** D. Payment-status breakdown for the range (no revenue-status filter). */
  async getPaymentBreakdown(query: { period?: string; from?: string; to?: string }) {
    const range = this.resolveRange(query);
    const rows = await prisma.order.groupBy({
      by: ['paymentStatus'],
      where: { createdAt: { gte: range.start, lt: range.endExclusive } },
      _count: { _all: true },
    });
    return {
      period: range.label,
      breakdown: rows
        .map((r) => ({ paymentStatus: r.paymentStatus, count: r._count._all }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /**
   * E. Top products — one grouped raw query (units, revenue = SUM(price ×
   * qty), distinct order count) with LIMIT/OFFSET pagination in the DB.
   */
  async getTopProducts(
    query: { period?: string; from?: string; to?: string },
    pagination: { page?: number; limit?: number }
  ) {
    const range = this.resolveRange(query);
    const page = Math.max(1, Math.floor(pagination.page || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(pagination.limit || 10)));
    const offset = (page - 1) * limit;

    const [rows, totalRows] = await Promise.all([
      prisma.$queryRaw<ProductRow[]>`
        SELECT oi."productId" AS "productId",
               COALESCE(SUM(oi."quantity"), 0)::int AS "unitsSold",
               COALESCE(SUM(oi."priceAtPurchase" * oi."quantity"), 0)::float AS revenue,
               COUNT(DISTINCT oi."orderId")::int AS "orderCount"
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        WHERE ${salesPredicate(range.start, range.endExclusive)}
        GROUP BY oi."productId"
        ORDER BY "unitsSold" DESC, revenue DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(DISTINCT oi."productId")::int AS n
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        WHERE ${salesPredicate(range.start, range.endExclusive)}
      `,
    ]);

    const ids = rows.map((r) => r.productId);
    const products = ids.length
      ? await prisma.product.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, sku: true, category: { select: { name: true } } },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    return {
      period: range.label,
      pagination: { page, limit, total: totalRows[0]?.n ?? 0 },
      products: rows.map((row) => {
        const p = productMap.get(row.productId);
        return {
          productId: row.productId,
          productName: p?.name ?? '(product removed)',
          sku: p?.sku ?? null,
          categoryName: p?.category?.name ?? '(uncategorized)',
          unitsSold: row.unitsSold ?? 0,
          revenue: row.revenue ?? 0,
          orderCount: row.orderCount ?? 0,
        };
      }),
    };
  }

  /**
   * F. Category performance — grouped in PostgreSQL through the current
   * product→category relation, paginated with LIMIT/OFFSET.
   */
  async getTopCategories(
    query: { period?: string; from?: string; to?: string },
    pagination: { page?: number; limit?: number }
  ) {
    const range = this.resolveRange(query);
    const page = Math.max(1, Math.floor(pagination.page || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(pagination.limit || 10)));
    const offset = (page - 1) * limit;

    const [rows, totalRows] = await Promise.all([
      prisma.$queryRaw<CategoryRow[]>`
        SELECT p."categoryId" AS "categoryId",
               COALESCE(SUM(oi."quantity"), 0)::int AS "unitsSold",
               COALESCE(SUM(oi."priceAtPurchase" * oi."quantity"), 0)::float AS revenue,
               COUNT(DISTINCT oi."orderId")::int AS "orderCount"
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        LEFT JOIN products p ON p.id = oi."productId"
        WHERE ${salesPredicate(range.start, range.endExclusive)}
        GROUP BY p."categoryId"
        ORDER BY "unitsSold" DESC, revenue DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(DISTINCT p."categoryId")::int AS n
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        LEFT JOIN products p ON p.id = oi."productId"
        WHERE ${salesPredicate(range.start, range.endExclusive)}
      `,
    ]);

    const ids = rows.map((r) => r.categoryId).filter((id): id is string => id !== null);
    const categories = ids.length
      ? await prisma.category.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : [];
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    return {
      period: range.label,
      pagination: { page, limit, total: totalRows[0]?.n ?? 0 },
      categories: rows.map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryId ? categoryMap.get(row.categoryId) ?? '(category removed)' : '(uncategorized)',
        unitsSold: row.unitsSold ?? 0,
        revenue: row.revenue ?? 0,
        orderCount: row.orderCount ?? 0,
      })),
    };
  }
}

export default new ReportService();

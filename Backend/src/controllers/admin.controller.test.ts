import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import prisma from '../config/database';
import adminController from './admin.controller';

/**
 * GET /admin/stats must stay compatible with the admin dashboard while no
 * longer serializing independent reads.
 *
 * The controller reaches the database through the `prisma` singleton, so the
 * tests swap its query methods for in-memory fakes and restore them afterwards.
 * The fakes also record call order so a regression back to serialized
 * `$transaction([...])` execution is caught.
 */

interface Call {
  name: string;
  startedAt: number;
  settledAt: number;
}

let restore: Array<() => void> = [];

afterEach(() => {
  for (const fn of restore) fn();
  restore = [];
});

function makeRes() {
  const captured: { status?: number; body?: any } = {};
  const res: any = {
    json(body: any) {
      captured.body = body;
      return res;
    },
    status(code: number) {
      captured.status = code;
      return res;
    },
  };
  return { res, captured };
}

/**
 * Installs fakes for the four reads the endpoint performs. `delayMs` makes each
 * read take real wall-clock time so concurrency is observable.
 */
function stubStatsQueries(opts: {
  products: Array<{ isAvailable: boolean; _count: { _all: number } }>;
  orders: Array<{ status: string; _count: { _all: number } }>;
  allTimeRevenue: number | null;
  lastMonthRevenue: number | null;
  delayMs?: number;
}) {
  const delayMs = opts.delayMs ?? 0;
  const calls: Call[] = [];

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const install = (obj: any, name: string, impl: (...args: any[]) => any) => {
    const original = obj[name];
    obj[name] = async (...args: any[]) => {
      // Real timestamps and a real delay: `Promise.all` issues all four reads
      // before the first one settles, so their windows overlap. Sequential
      // execution would place them end to end.
      const startedAt = Date.now();
      if (delayMs) await sleep(delayMs);
      const result = impl(...args);
      calls.push({ name, startedAt, settledAt: Date.now() });
      return result;
    };
    restore.push(() => {
      obj[name] = original;
    });
  };

  install(prisma.product, 'groupBy', () => opts.products);
  install(prisma.order, 'groupBy', () => opts.orders);
  install(prisma.order, 'aggregate', (args: any) => ({
    _sum: {
      total: args?.where?.createdAt ? opts.lastMonthRevenue : opts.allTimeRevenue,
    },
  }));

  return calls;
}

async function runStats() {
  const { res, captured } = makeRes();
  const errors: any[] = [];
  await adminController.getStats({} as any, res, (e: any) => errors.push(e));
  assert.deepEqual(errors, [], 'getStats must not forward an error');
  return captured.body;
}

test('getStats: response shape and values are unchanged', async () => {
  stubStatsQueries({
    products: [
      { isAvailable: true, _count: { _all: 7 } },
      { isAvailable: false, _count: { _all: 3 } },
    ],
    orders: [
      { status: 'PENDING', _count: { _all: 2 } },
      { status: 'CONFIRMED', _count: { _all: 5 } },
      { status: 'CANCELLED', _count: { _all: 1 } },
    ],
    allTimeRevenue: 1000,
    lastMonthRevenue: 250,
  });

  const body = await runStats();

  assert.equal(body.success, true);
  assert.deepEqual(Object.keys(body.data).sort(), [
    'activeProducts',
    'pendingOrders',
    'revenueChange',
    'totalOrders',
    'totalProducts',
    'totalRevenue',
  ]);
  // 7 available + 3 unavailable = 10; the old code counted each separately.
  assert.equal(body.data.totalProducts, 10);
  assert.equal(body.data.activeProducts, 7);
  assert.equal(body.data.totalOrders, 8);
  assert.equal(body.data.pendingOrders, 2);
  assert.equal(body.data.totalRevenue, 1000);
  // ((1000 - 250) / 250) * 100 — the pre-existing formula, unchanged.
  assert.equal(body.data.revenueChange, 300);
});

test('getStats: no status or availability bucket yields zero, not NaN', async () => {
  stubStatsQueries({
    products: [],
    orders: [{ status: 'CONFIRMED', _count: { _all: 4 } }],
    allTimeRevenue: 0,
    lastMonthRevenue: 0,
  });

  const body = await runStats();

  assert.equal(body.data.totalProducts, 0);
  assert.equal(body.data.activeProducts, 0);
  assert.equal(body.data.totalOrders, 4);
  assert.equal(body.data.pendingOrders, 0);
  assert.equal(body.data.totalRevenue, 0);
  assert.equal(body.data.revenueChange, 0);
});

test('getStats: null aggregate sums fall back to zero', async () => {
  stubStatsQueries({
    products: [{ isAvailable: true, _count: { _all: 1 } }],
    orders: [{ status: 'PENDING', _count: { _all: 1 } }],
    allTimeRevenue: null,
    lastMonthRevenue: null,
  });

  const body = await runStats();

  assert.equal(body.data.totalRevenue, 0);
  assert.equal(body.data.revenueChange, 0);
});

test('getStats: the four independent reads overlap instead of running in sequence', async () => {
  // Each read sleeps 80ms. Serialized execution spans ~320ms; concurrent
  // execution spans ~80ms because all four are issued before the first settles.
  const calls = stubStatsQueries({
    products: [{ isAvailable: true, _count: { _all: 1 } }],
    orders: [{ status: 'PENDING', _count: { _all: 1 } }],
    allTimeRevenue: 10,
    lastMonthRevenue: 10,
    delayMs: 80,
  });

  const startedAt = Date.now();
  await runStats();
  const elapsed = Date.now() - startedAt;

  assert.equal(calls.length, 4, 'expected exactly four reads');
  assert.ok(
    elapsed < 240,
    `reads must overlap: expected well under 4x80ms, took ${elapsed}ms`,
  );

  // The real concurrency signal: all four reads are *issued* at the same time,
  // so their start timestamps are clustered. Sequential execution would space
  // them one 80ms window apart.
  const starts = calls.map((c) => c.startedAt);
  const startSpread = Math.max(...starts) - Math.min(...starts);
  assert.ok(
    startSpread < 40,
    `all reads must be issued together, start spread was ${startSpread}ms`,
  );
});

test('getStats: does not use $transaction for these reads', async () => {
  stubStatsQueries({
    products: [{ isAvailable: true, _count: { _all: 1 } }],
    orders: [{ status: 'PENDING', _count: { _all: 1 } }],
    allTimeRevenue: 10,
    lastMonthRevenue: 10,
  });

  const originalTx = (prisma as any).$transaction;
  let txCalls = 0;
  (prisma as any).$transaction = (...args: any[]) => {
    txCalls += 1;
    return originalTx.apply(prisma, args);
  };
  restore.push(() => {
    (prisma as any).$transaction = originalTx;
  });

  await runStats();

  assert.equal(txCalls, 0, 'getStats must not open a read transaction');
});

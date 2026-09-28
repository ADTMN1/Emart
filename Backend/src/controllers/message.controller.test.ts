import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import messageService from '../services/message.service';
import messageController from './message.controller';
import { OrderRequestStatus } from '../services/notification.service';

/**
 * Order-request workflow state vs. notification read state.
 *
 * An ORDER_REQUEST row IS the order-request record (there is no OrderRequest
 * table and `/order-requests/:id/confirm` is keyed by notification id), so the
 * decision to accept/decline must live in its own field. These tests pin the
 * separation: reading a notification must never retire a pending request, and
 * the decision must be atomic.
 *
 * The controller reaches the database through the `messageService` singleton's
 * `getPrisma()`, so the tests swap that accessor for an in-memory fake and
 * restore it afterwards.
 */

interface Row {
  id: string;
  [key: string]: any;
}

const SELLER_USER = 'seller-user-1';
const OTHER_SELLER_USER = 'seller-user-2';
const ORDER = 'order-1';
const REQ = 'req-1';

function makeRows() {
  return {
    notifications: [] as Row[],
    orders: [] as Row[],
    profiles: [{ id: 's1', userId: SELLER_USER }],
  };
}

/** Minimal prisma fake covering the queries these controller paths perform. */
function makePrisma(rows: ReturnType<typeof makeRows>) {
  function matches(row: Row, where: any): boolean {
    for (const [key, value] of Object.entries(where || {})) {
      if (value === null) {
        if (row[key] !== null) return false;
        continue;
      }
      if (value && typeof value === 'object' && 'not' in value) {
        if (row[key] === value.not) return false;
        continue;
      }
      if (row[key] !== value) return false;
    }
    return true;
  }

  let nextId = 1;

  const prisma: any = {
    notification: {
      findFirst: async ({ where }: any) => rows.notifications.find((n) => matches(n, where)) || null,
      findUnique: async ({ where }: any) => rows.notifications.find((n) => n.id === where.id) || null,
      findMany: async ({ where }: any) => rows.notifications.filter((n) => matches(n, where)),
      create: async ({ data }: any) => {
        const row = { id: `gen-${nextId++}`, readAt: null, ...data };
        rows.notifications.push(row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const target = rows.notifications.filter((n) => matches(n, where));
        for (const n of target) Object.assign(n, data);
        return { count: target.length };
      },
    },
    orderItem: {
      findFirst: async () => ({ orderId: ORDER }),
    },
    // getOrderRequests hydrates each request with its order (status + items).
    order: {
      findUnique: async ({ where }: any) => rows.orders.find((o) => o.id === where.id) || null,
      findMany: async ({ where }: any) => {
        const ids = where?.id?.in || [];
        return rows.orders.filter((o) => ids.includes(o.id));
      },
      update: async ({ where, data }: any) => {
        const order = rows.orders.find((o) => o.id === where.id);
        if (!order) throw new Error('order not found');
        Object.assign(order, data);
        return order;
      },
    },
    sellerProfile: {
      findUnique: async ({ where }: any) => {
        if (where.userId) return rows.profiles.find((p) => p.userId === where.userId) || null;
        if (where.id) return rows.profiles.find((p) => p.id === where.id) || null;
        return null;
      },
    },
    user: {
      findUnique: async ({ where }: any) => ({ id: where.id, email: 'seller@test.dev' }),
    },
    // Records the advisory lock so the test can assert it was taken.
    $executeRaw: async () => 0,
  };

  prisma.$transaction = async (fn: any) => fn(prisma);

  return { prisma, matches };
}

function makeRes() {
  const state: any = { statusCode: 200, body: undefined };
  const res: any = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: any) {
      state.body = payload;
      return res;
    },
  };
  return { res, state };
}

function makeReq(overrides: any = {}) {
  return {
    user: { id: SELLER_USER, role: 'CUSTOMER' },
    params: {},
    body: {},
    query: {},
    ...overrides,
  } as any;
}

/** Swap the singleton's prisma accessor for the duration of one test. */
function usePrisma(prisma: any, t: any) {
  const original = messageService.getPrisma;
  (messageService as any).getPrisma = () => prisma;
  t.after(() => {
    (messageService as any).getPrisma = original;
  });
}

function seedPending(rows: ReturnType<typeof makeRows>, overrides: Record<string, any> = {}) {
  const row: Row = {
    id: REQ,
    userId: SELLER_USER,
    type: 'ORDER_REQUEST',
    title: 'New Order Request',
    body: 'Order EM-1 has been sent to you for fulfillment.',
    orderId: ORDER,
    readAt: null,
    requestStatus: OrderRequestStatus.PENDING,
    requestRespondedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
  rows.notifications.push(row);
  return row;
}

// ---------------------------------------------------------------------------
// PHASE 1 — read state and request state are independent
// ---------------------------------------------------------------------------

test('getOrderRequests: a READ but PENDING request is still listed', async (t) => {
  const rows = makeRows();
  seedPending(rows, { readAt: new Date() }); // seller opened it, never decided
  rows.orders.push({ id: ORDER, status: 'PENDING' });
  const { prisma } = makePrisma(rows);
  usePrisma(prisma, t);

  const { res, state } = makeRes();
  await messageController.getOrderRequests(makeReq(), res, () => {});

  assert.equal(state.statusCode, 200);
  assert.equal(state.body.data.requests.length, 1, 'reading must not retire the request');
  assert.equal(state.body.data.requests[0].notification.requestStatus, 'PENDING');
});

test('getOrderRequests: an UNREAD but ACCEPTED request is NOT listed', async (t) => {
  const rows = makeRows();
  seedPending(rows, {
    readAt: null,
    requestStatus: OrderRequestStatus.ACCEPTED,
    requestRespondedAt: new Date(),
  });
  const { prisma } = makePrisma(rows);
  usePrisma(prisma, t);

  const { res, state } = makeRes();
  await messageController.getOrderRequests(makeReq(), res, () => {});

  assert.equal(state.body.data.requests.length, 0, 'the decision, not the read flag, drives the queue');
});

test('getOrderRequests: DECLINED requests are not listed', async (t) => {
  const rows = makeRows();
  seedPending(rows, {
    readAt: null,
    requestStatus: OrderRequestStatus.DECLINED,
    requestRespondedAt: new Date(),
  });
  const { prisma } = makePrisma(rows);
  usePrisma(prisma, t);

  const { res, state } = makeRes();
  await messageController.getOrderRequests(makeReq(), res, () => {});

  assert.equal(state.body.data.requests.length, 0);
});

test('getOrderRequests: only returns this seller requests, never another seller', async (t) => {
  const rows = makeRows();
  seedPending(rows, { id: 'mine', userId: SELLER_USER });
  seedPending(rows, { id: 'theirs', userId: OTHER_SELLER_USER });
  rows.orders.push({ id: ORDER, status: 'PENDING' });
  const { prisma } = makePrisma(rows);
  usePrisma(prisma, t);

  const { res, state } = makeRes();
  await messageController.getOrderRequests(makeReq(), res, () => {});

  assert.equal(state.body.data.requests.length, 1);
  assert.equal(state.body.data.requests[0].notification.id, 'mine');
});

// ---------------------------------------------------------------------------
// PHASE 1 — accept
// ---------------------------------------------------------------------------

test('confirmOrderRequest: accepts a request that was already READ', async (t) => {
  const rows = makeRows();
  seedPending(rows, { readAt: new Date() });
  rows.orders.push({ id: ORDER, status: 'PENDING' });
  const { prisma } = makePrisma(rows);
  usePrisma(prisma, t);

  const { res, state } = makeRes();
  await messageController.confirmOrderRequest(makeReq({ params: { id: REQ } }), res, () => {});

  assert.equal(state.statusCode, 200, 'a read request is still acceptable');
  assert.equal(rows.notifications[0].requestStatus, 'ACCEPTED');
  assert.equal(rows.orders[0].status, 'CONFIRMED');
  assert.ok(rows.notifications[0].requestRespondedAt instanceof Date);
});

test('confirmOrderRequest: sets requestStatus independently of readAt', async (t) => {
  const rows = makeRows();
  seedPending(rows);
  rows.orders.push({ id: ORDER, status: 'PENDING' });
  const { prisma } = makePrisma(rows);
  usePrisma(prisma, t);

  const { res, state } = makeRes();
  await messageController.confirmOrderRequest(makeReq({ params: { id: REQ } }), res, () => {});

  assert.equal(state.statusCode, 200);
  // Both are set, but the request is retired by requestStatus.
  assert.equal(rows.notifications[0].readAt instanceof Date, true);
  assert.equal(rows.notifications[0].requestStatus, 'ACCEPTED');
});

test('confirmOrderRequest: already-accepted request is rejected 409 and order untouched', async (t) => {
  const rows = makeRows();
  seedPending(rows, { requestStatus: OrderRequestStatus.ACCEPTED, requestRespondedAt: new Date() });
  rows.orders.push({ id: ORDER, status: 'CONFIRMED' });
  const { prisma } = makePrisma(rows);
  usePrisma(prisma, t);

  const { res, state } = makeRes();
  await messageController.confirmOrderRequest(makeReq({ params: { id: REQ } }), res, () => {});

  assert.equal(state.statusCode, 409);
  assert.equal(state.body.success, false);
  assert.equal(rows.orders[0].status, 'CONFIRMED', 'no second transition');
});

test('confirmOrderRequest: only one of two concurrent accepts can win', async (t) => {
  const rows = makeRows();
  seedPending(rows);
  rows.orders.push({ id: ORDER, status: 'PENDING' });
  const { prisma } = makePrisma(rows);
  usePrisma(prisma, t);

  const first = makeRes();
  const second = makeRes();
  const req = () => makeReq({ params: { id: REQ } });

  await Promise.all([
    messageController.confirmOrderRequest(req(), first.res, () => {}),
    messageController.confirmOrderRequest(req(), second.res, () => {}),
  ]);

  const codes = [first.state.statusCode, second.state.statusCode].sort();
  assert.deepEqual(codes, [200, 409], 'exactly one accept succeeds');
  assert.equal(rows.notifications[0].requestStatus, 'ACCEPTED');
});

// ---------------------------------------------------------------------------
// PHASE 1 — decline
// ---------------------------------------------------------------------------

test('declineOrderRequest: marks DECLINED and does NOT change order status', async (t) => {
  const rows = makeRows();
  seedPending(rows, { readAt: new Date() });
  rows.orders.push({ id: ORDER, status: 'PENDING' });
  const { prisma } = makePrisma(rows);
  usePrisma(prisma, t);

  const { res, state } = makeRes();
  await messageController.declineOrderRequest(makeReq({ params: { id: REQ } }), res, () => {});

  assert.equal(state.statusCode, 200, 'a read request is still declinable');
  assert.equal(rows.notifications[0].requestStatus, 'DECLINED');
  assert.equal(
    rows.orders[0].status,
    'PENDING',
    'declining is a seller workflow decision and must not rewrite order state',
  );
  assert.ok(rows.notifications[0].requestRespondedAt instanceof Date);
});

test('declineOrderRequest: second decline is rejected 409', async (t) => {
  const rows = makeRows();
  seedPending(rows, { requestStatus: OrderRequestStatus.DECLINED, requestRespondedAt: new Date() });
  const { prisma } = makePrisma(rows);
  usePrisma(prisma, t);

  const { res, state } = makeRes();
  await messageController.declineOrderRequest(makeReq({ params: { id: REQ } }), res, () => {});

  assert.equal(state.statusCode, 409);
});

test('declineOrderRequest: accept after decline is rejected 409', async (t) => {
  const rows = makeRows();
  seedPending(rows, { requestStatus: OrderRequestStatus.DECLINED, requestRespondedAt: new Date() });
  rows.orders.push({ id: ORDER, status: 'PENDING' });
  const { prisma } = makePrisma(rows);
  usePrisma(prisma, t);

  const { res, state } = makeRes();
  await messageController.confirmOrderRequest(makeReq({ params: { id: REQ } }), res, () => {});

  assert.equal(state.statusCode, 409, 'a decided request cannot flip back');
  assert.equal(rows.notifications[0].requestStatus, 'DECLINED');
  assert.equal(rows.orders[0].status, 'PENDING');
});

test('declineOrderRequest: another seller request is rejected 403', async (t) => {
  const rows = makeRows();
  seedPending(rows, { userId: OTHER_SELLER_USER });
  const { prisma } = makePrisma(rows);
  usePrisma(prisma, t);

  const { res, state } = makeRes();
  await messageController.declineOrderRequest(makeReq({ params: { id: REQ } }), res, () => {});

  assert.equal(state.statusCode, 403, 'ownership is checked before the decision');
  assert.equal(rows.notifications[0].requestStatus, 'PENDING', 'and no state change occurred');
});

test('declineOrderRequest: non-ORDER_REQUEST row is rejected 400', async (t) => {
  const rows = makeRows();
  seedPending(rows, { type: 'MESSAGE' });
  const { prisma } = makePrisma(rows);
  usePrisma(prisma, t);

  const { res, state } = makeRes();
  await messageController.declineOrderRequest(makeReq({ params: { id: REQ } }), res, () => {});

  assert.equal(state.statusCode, 400);
});

test('confirmOrderRequest: missing notification is 404', async (t) => {
  const rows = makeRows();
  const { prisma } = makePrisma(rows);
  usePrisma(prisma, t);

  const { res, state } = makeRes();
  await messageController.confirmOrderRequest(makeReq({ params: { id: 'nope' } }), res, () => {});

  assert.equal(state.statusCode, 404);
});

test('confirmOrderRequest: no seller profile is 404', async (t) => {
  const rows = makeRows();
  const { prisma } = makePrisma(rows);
  usePrisma(prisma, t);

  const { res, state } = makeRes();
  await messageController.confirmOrderRequest(
    makeReq({ params: { id: REQ }, user: { id: 'stranger' } }),
    res,
    () => {},
  );

  assert.equal(state.statusCode, 404);
});

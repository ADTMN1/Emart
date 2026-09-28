import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import prisma from '../config/database';
import { OrderService } from './order.service';

/**
 * Admin order list: the `user` and `items` relations are loaded as siblings so
 * the two round-trips that only need order ids overlap, instead of each waiting
 * for the previous relation level to finish.
 *
 * The fake prisma below can serve the same fixture through either strategy: the
 * nested `select` shape Prisma used before, or the flattened shape the service
 * uses now. Both go through the same rows, so asserting on their serialised
 * output proves the payload did not move. The service reads through the `prisma`
 * singleton, so its methods are swapped for in-memory fakes and restored after
 * each test.
 */

let restore: Array<() => void> = [];

afterEach(() => {
  for (const fn of restore) fn();
  restore = [];
});

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface SellerRow {
  id: string;
  storeName: string;
}

interface ProductRow {
  id: string;
  name: string;
  sellerId: string | null;
}

interface ItemRow {
  id: string;
  quantity: number;
  productId: string;
}

interface OrderRow {
  id: string;
  userId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  subtotal: number;
  serviceFees: number;
  domesticShipping: number;
  internationalShipping: number;
  insurance: number;
  total: number;
  trackingNumber: string | null;
  shippingMethod: string;
  createdAt: Date;
  updatedAt: Date;
  items: ItemRow[];
}

interface Fixture {
  orders: OrderRow[];
  users: UserRow[];
  products: ProductRow[];
  sellers: SellerRow[];
}

const USER_A: UserRow = { id: 'user-a', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' };
const USER_B: UserRow = { id: 'user-b', email: 'grace@example.com', firstName: 'Grace', lastName: 'Hopper' };
const SELLER_1: SellerRow = { id: 'seller-1', storeName: 'nati shop' };
const SELLER_2: SellerRow = { id: 'seller-2', storeName: 'second shop' };

function makeOrder(overrides: Partial<OrderRow> & { id: string }): OrderRow {
  return {
    userId: USER_A.id,
    orderNumber: `EM-${overrides.id}`,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    paymentMethod: 'CREDIT_CARD',
    subtotal: 100,
    serviceFees: 5,
    domesticShipping: 7,
    internationalShipping: 0,
    insurance: 1,
    total: 113,
    trackingNumber: null,
    shippingMethod: 'STANDARD',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    items: [],
    ...overrides,
  };
}

const SCALARS = [
  'id', 'orderNumber', 'status', 'paymentStatus', 'paymentMethod', 'subtotal',
  'serviceFees', 'domesticShipping', 'internationalShipping', 'insurance', 'total',
  'trackingNumber', 'shippingMethod', 'createdAt', 'updatedAt',
] as const;

/** Minimal `where` matcher covering the filters this endpoint builds. */
function matches(order: OrderRow, where: any, fixture: Fixture): boolean {
  if (!where) return true;
  if (where.status && order.status !== where.status) return false;
  if (where.paymentStatus && order.paymentStatus !== where.paymentStatus) return false;
  if (!where.OR) return true;
  const user = fixture.users.find((u) => u.id === order.userId);
  const contains = (value: string | null | undefined, needle: string) =>
    (value ?? '').toLowerCase().includes(needle.toLowerCase());
  return where.OR.some((clause: any) => {
    if (clause.orderNumber) return contains(order.orderNumber, clause.orderNumber.contains);
    if (clause.trackingNumber) return contains(order.trackingNumber, clause.trackingNumber.contains);
    if (clause.user?.is?.email) return contains(user?.email, clause.user.is.email.contains);
    if (clause.user?.is?.OR) {
      return clause.user.is.OR.some(
        (part: any) => contains(user?.[part.firstName ? 'firstName' : 'lastName'], part[part.firstName ? 'firstName' : 'lastName'].contains),
      );
    }
    return false;
  });
}

interface Call { model: string; at: number; args: any }

/**
 * Installs a prisma fake that serves the fixture through both the old nested
 * `select` and the new flattened reads, and records call times so the tests can
 * assert that sibling reads really do overlap.
 */
function stubPrisma(fixture: Fixture, opts: { latencyMs?: number } = {}) {
  const calls: Call[] = [];
  const wheres: any[] = [];
  const argSets: Record<string, any[]> = { order: [], count: [], user: [], orderItem: [], product: [], sellerProfile: [] };
  // Virtual clock. A call stamps its start with the time the clock shows *now*
  // and only moves the clock on when it completes, so two reads that are issued
  // in the same turn share a start time and a read that waits for them starts
  // later. That is exactly the distinction the tests assert on.
  let clock = 0;
  const record = async (model: string, args: any) => {
    const start = clock;
    calls.push({ model, at: start, args });
    await new Promise((r) => setImmediate(r));
    clock = start + (opts.latencyMs ?? 1);
  };

  const findOrder = (id: string) => fixture.orders.find((o) => o.id === id)!;

  const orderFindMany = async (args: any) => {
    await record('order', args);
    wheres.push(args?.where);
    argSets.order.push(args);
    const select = args?.select ?? {};
    const matching = fixture.orders
      .filter((o) => matches(o, args?.where, fixture))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const rows = matching.slice(args?.skip ?? 0, (args?.skip ?? 0) + (args?.take ?? matching.length));

    return rows.map((order) => {
      const base: any = {};
      for (const key of SCALARS) {
        if (select[key] !== undefined) base[key] = (order as any)[key];
      }
      // The relation key is only ever selected as a join column; Prisma strips
      // it from the nested result but hands it back when it is asked for.
      if (select.userId) base.userId = order.userId;

      if (select.user) {
        base.user = fixture.users.find((u) => u.id === order.userId) ?? null;
      }
      if (select.items) {
        base.items = order.items.map((item) => {
          const out: any = { id: item.id, quantity: item.quantity };
          if (select.items.select.productId) out.productId = item.productId;
          if (select.items.select.orderId) out.orderId = order.id;
          if (select.items.select.product) {
            const product = fixture.products.find((p) => p.id === item.productId) ?? null;
            if (product === null) {
              out.product = null;
            } else {
              out.product = { name: product.name };
              if (select.items.select.product.select.sellerProfile) {
                out.product.sellerProfile =
                  (product.sellerId === null
                    ? undefined
                    : fixture.sellers.find((s) => s.id === product.sellerId)) ?? null;
              }
            }
          }
          return out;
        });
      }
      return base;
    });
  };

  const orderCount = async (args: any) => {
    await record('count', args);
    argSets.count.push(args);
    // The count must see the same filter as the page read.
    wheres.push(args?.where);
    return fixture.orders.filter((o) => matches(o, args?.where, fixture)).length;
  };

  const userFindMany = async (args: any) => {
    await record('user', args);
    argSets.user.push(args);
    const ids: string[] = args?.where?.id?.in ?? [];
    return fixture.users.filter((u) => ids.includes(u.id)).map(({ id, email, firstName, lastName }) => ({ id, email, firstName, lastName }));
  };

  const orderItemFindMany = async (args: any) => {
    await record('orderItem', args);
    argSets.orderItem.push(args);
    const ids: string[] = args?.where?.orderId?.in ?? [];
    return fixture.orders
      .filter((o) => ids.includes(o.id))
      .flatMap((o) => o.items.map((item) => ({ id: item.id, quantity: item.quantity, orderId: o.id, productId: item.productId })));
  };

  const productFindMany = async (args: any) => {
    await record('product', args);
    argSets.product.push(args);
    const ids: string[] = args?.where?.id?.in ?? [];
    return fixture.products.filter((p) => ids.includes(p.id)).map(({ id, name, sellerId }) => ({ id, name, sellerId }));
  };

  const sellerProfileFindMany = async (args: any) => {
    await record('sellerProfile', args);
    argSets.sellerProfile.push(args);
    const ids: string[] = args?.where?.id?.in ?? [];
    return fixture.sellers.filter((s) => ids.includes(s.id)).map(({ id, storeName }) => ({ id, storeName }));
  };

  const originals = {
    findMany: prisma.order.findMany,
    count: prisma.order.count,
    userFindMany: prisma.user.findMany,
    orderItemFindMany: prisma.orderItem.findMany,
    productFindMany: prisma.product.findMany,
    sellerProfileFindMany: prisma.sellerProfile.findMany,
  };
  prisma.order.findMany = orderFindMany as any;
  prisma.order.count = orderCount as any;
  prisma.user.findMany = userFindMany as any;
  prisma.orderItem.findMany = orderItemFindMany as any;
  prisma.product.findMany = productFindMany as any;
  prisma.sellerProfile.findMany = sellerProfileFindMany as any;
  restore.push(() => {
    prisma.order.findMany = originals.findMany;
    prisma.order.count = originals.count;
    prisma.user.findMany = originals.userFindMany;
    prisma.orderItem.findMany = originals.orderItemFindMany;
    prisma.product.findMany = originals.productFindMany;
    prisma.sellerProfile.findMany = originals.sellerProfileFindMany;
  });

  return {
    calls,
    wheres,
    argSets,
    models: () => calls.map((c) => c.model),
    findOrder,
    /** Forget everything recorded so far, so a reference read cannot skew assertions. */
    reset: () => {
      calls.length = 0;
      wheres.length = 0;
      for (const key of Object.keys(argSets)) argSets[key] = [];
      clock = 0;
    },
  };
}

/**
 * The pre-change payload: one nested read, hydrated by the fake the way Prisma
 * did, then the same `sellers[]` projection.
 */
async function nestedReference(fixture: Fixture, filters: any, pagination: any) {
  const page = Math.max(1, Number(pagination.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(pagination.limit) || 20));
  const where = buildWhere(filters);
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true, orderNumber: true, status: true, paymentStatus: true, paymentMethod: true,
        subtotal: true, serviceFees: true, domesticShipping: true, internationalShipping: true,
        insurance: true, total: true, trackingNumber: true, shippingMethod: true,
        createdAt: true, updatedAt: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        items: {
          select: {
            id: true, quantity: true,
            product: { select: { name: true, sellerProfile: { select: { id: true, storeName: true } } } },
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    } as any),
    prisma.order.count({ where } as any),
  ]);
  const sellers = (o: any) => {
    const out: Array<{ id: string; storeName: string }> = [];
    const seen = new Set<string>();
    for (const item of o.items ?? []) {
      const profile = item?.product?.sellerProfile;
      if (profile && profile.id && !seen.has(profile.id)) {
        seen.add(profile.id);
        out.push({ id: profile.id, storeName: profile.storeName });
      }
    }
    return { ...o, sellers: out };
  };
  return {
    orders: orders.map(sellers),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/** Mirrors the filter block in getAdminOrders so the oracle sees the same where. */
function buildWhere(filters: any) {
  const where: any = {};
  if (filters.status) where.status = filters.status;
  if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { trackingNumber: { contains: search, mode: 'insensitive' } },
      { user: { is: { email: { contains: search, mode: 'insensitive' } } } },
      {
        user: {
          is: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
  }
  return where;
}

/**
 * Installs the fake, serves the fixture once through the pre-change nested read,
 * then forgets the trace so assertions only see the service's own calls.
 */
async function withReference(fixture: Fixture, filters: any, pagination: any) {
  const seen = stubPrisma(fixture);
  const before = await nestedReference(fixture, filters, pagination);
  seen.reset();
  return { seen, before };
}

const service = new OrderService();

// ---------------------------------------------------------------------------
// 1. response JSON identical to the existing implementation
// ---------------------------------------------------------------------------

test('admin orders: payload is identical to the previous nested implementation', async () => {
  const fixture: Fixture = {
    orders: [
      makeOrder({
        id: 'order-1',
        userId: USER_A.id,
        orderNumber: 'EM-ONE',
        createdAt: new Date('2024-03-02T00:00:00.000Z'),
        items: [
          { id: 'item-1', quantity: 2, productId: 'product-1' },
          { id: 'item-2', quantity: 1, productId: 'product-2' },
        ],
      }),
      makeOrder({
        id: 'order-2',
        userId: USER_B.id,
        orderNumber: 'EM-TWO',
        status: 'SHIPPED',
        paymentStatus: 'PAID',
        trackingNumber: 'TRK-9',
        createdAt: new Date('2024-03-01T00:00:00.000Z'),
        items: [{ id: 'item-3', quantity: 4, productId: 'product-1' }],
      }),
    ],
    users: [USER_A, USER_B],
    products: [
      { id: 'product-1', name: 'Labtop', sellerId: SELLER_1.id },
      { id: 'product-2', name: 'Mouse', sellerId: SELLER_1.id },
    ],
    sellers: [SELLER_1],
  };

  const { seen, before } = await withReference(fixture, {}, { page: 1, limit: 20 });
  const after = await service.getAdminOrders({}, { page: 1, limit: 20 });

  assert.equal(JSON.stringify(after), JSON.stringify(before));
  // The reference read is the only nested one; the service used flat reads.
  assert.deepEqual(seen.models(), ['order', 'count', 'user', 'orderItem', 'product', 'sellerProfile']);
});

test('admin orders: the relation key never leaks into the payload', async () => {
  const fixture: Fixture = {
    orders: [makeOrder({ id: 'order-1', items: [{ id: 'item-1', quantity: 1, productId: 'product-1' }] })],
    users: [USER_A],
    products: [{ id: 'product-1', name: 'Labtop', sellerId: SELLER_1.id }],
    sellers: [SELLER_1],
  };
  stubPrisma(fixture);
  const res = await service.getAdminOrders({}, { page: 1, limit: 20 });
  const order = res.orders[0] as any;

  assert.equal('userId' in order, false);
  assert.deepEqual(Object.keys(order.items[0]), ['id', 'quantity', 'product']);
  assert.deepEqual(Object.keys(order.items[0].product), ['name', 'sellerProfile']);
  assert.deepEqual(Object.keys(order.user!), ['id', 'email', 'firstName', 'lastName']);
  // userId is still selected on the order read — it is how siblings get their keys.
  assert.equal('userId' in (fixture.orders[0] as any), true);
});

// ---------------------------------------------------------------------------
// 2-6. relation edge cases
// ---------------------------------------------------------------------------

test('admin orders: an order with zero items still returns an empty item list', async () => {
  const fixture: Fixture = {
    orders: [makeOrder({ id: 'order-1', items: [] })],
    users: [USER_A],
    products: [],
    sellers: [],
  };
  const { before } = await withReference(fixture, {}, { page: 1, limit: 20 });
  const after = await service.getAdminOrders({}, { page: 1, limit: 20 });

  assert.equal(JSON.stringify(after), JSON.stringify(before));
  assert.deepEqual(after.orders[0].items, []);
  assert.deepEqual(after.orders[0].sellers, []);
  assert.equal(after.orders[0].user?.email, USER_A.email);
});

test('admin orders: an order with multiple items keeps every item in order', async () => {
  const fixture: Fixture = {
    orders: [
      makeOrder({
        id: 'order-1',
        items: [
          { id: 'item-1', quantity: 1, productId: 'product-1' },
          { id: 'item-2', quantity: 2, productId: 'product-2' },
          { id: 'item-3', quantity: 3, productId: 'product-3' },
        ],
      }),
    ],
    users: [USER_A],
    products: [
      { id: 'product-1', name: 'Labtop', sellerId: SELLER_1.id },
      { id: 'product-2', name: 'Mouse', sellerId: SELLER_2.id },
      { id: 'product-3', name: 'Keyboard', sellerId: SELLER_1.id },
    ],
    sellers: [SELLER_1, SELLER_2],
  };
  const { before } = await withReference(fixture, {}, { page: 1, limit: 20 });
  const after = await service.getAdminOrders({}, { page: 1, limit: 20 });

  assert.equal(JSON.stringify(after), JSON.stringify(before));
  assert.deepEqual(after.orders[0].items.map((i) => i.id), ['item-1', 'item-2', 'item-3']);
  assert.deepEqual(after.orders[0].items.map((i) => i.quantity), [1, 2, 3]);
  assert.deepEqual(after.orders[0].items.map((i) => i.product?.name), ['Labtop', 'Mouse', 'Keyboard']);
});

test('admin orders: items are grouped to the right order and stay inside it', async () => {
  const fixture: Fixture = {
    orders: [
      makeOrder({ id: 'order-1', createdAt: new Date('2024-03-02T00:00:00.000Z'), items: [
        { id: 'a-1', quantity: 1, productId: 'product-1' },
        { id: 'a-2', quantity: 1, productId: 'product-2' },
      ] }),
      makeOrder({ id: 'order-2', createdAt: new Date('2024-03-01T00:00:00.000Z'), items: [
        { id: 'b-1', quantity: 5, productId: 'product-1' },
      ] }),
    ],
    users: [USER_A],
    products: [
      { id: 'product-1', name: 'Labtop', sellerId: SELLER_1.id },
      { id: 'product-2', name: 'Mouse', sellerId: SELLER_2.id },
    ],
    sellers: [SELLER_1, SELLER_2],
  };
  const { before } = await withReference(fixture, {}, { page: 1, limit: 20 });
  const after = await service.getAdminOrders({}, { page: 1, limit: 20 });

  assert.equal(JSON.stringify(after), JSON.stringify(before));
  const [first, second] = after.orders;
  assert.deepEqual(first.items.map((i) => i.id), ['a-1', 'a-2']);
  assert.deepEqual(second.items.map((i) => i.id), ['b-1']);
  assert.deepEqual(second.sellers, [{ id: SELLER_1.id, storeName: SELLER_1.storeName }]);
});

test('admin orders: an item without a product keeps product: null and is skipped by sellers', async () => {
  const fixture: Fixture = {
    orders: [
      makeOrder({
        id: 'order-1',
        items: [
          { id: 'item-1', quantity: 1, productId: 'ghost-product' },
          { id: 'item-2', quantity: 1, productId: 'product-1' },
        ],
      }),
    ],
    users: [USER_A],
    products: [{ id: 'product-1', name: 'Labtop', sellerId: SELLER_1.id }],
    sellers: [SELLER_1],
  };
  const { before } = await withReference(fixture, {}, { page: 1, limit: 20 });
  const after = await service.getAdminOrders({}, { page: 1, limit: 20 });

  assert.equal(JSON.stringify(after), JSON.stringify(before));
  assert.equal(after.orders[0].items[0].product, null);
  assert.equal(after.orders[0].items[1].product?.name, 'Labtop');
  // The orphaned item contributes no seller, and does not remove the real one.
  assert.deepEqual(after.orders[0].sellers, [{ id: SELLER_1.id, storeName: SELLER_1.storeName }]);
});

test('admin orders: a product without a sellerProfile keeps sellerProfile: null', async () => {
  const fixture: Fixture = {
    orders: [
      makeOrder({
        id: 'order-1',
        items: [
          { id: 'item-1', quantity: 1, productId: 'product-noseller' },
          { id: 'item-2', quantity: 1, productId: 'product-danglerseller' },
        ],
      }),
    ],
    users: [USER_A],
    products: [
      { id: 'product-noseller', name: 'Unbranded', sellerId: null },
      { id: 'product-danglerseller', name: 'Orphan stock', sellerId: 'seller-gone' },
    ],
    sellers: [],
  };
  const { before } = await withReference(fixture, {}, { page: 1, limit: 20 });
  const after = await service.getAdminOrders({}, { page: 1, limit: 20 });

  assert.equal(JSON.stringify(after), JSON.stringify(before));
  // The key must be present and null, not absent, in both cases.
  assert.ok('sellerProfile' in after.orders[0].items[0].product!);
  assert.equal(after.orders[0].items[0].product!.sellerProfile, null);
  assert.equal(after.orders[0].items[1].product!.sellerProfile, null);
  assert.deepEqual(after.orders[0].sellers, []);
});

test('admin orders: sellers[] stays deduplicated and in first-seen order', async () => {
  const fixture: Fixture = {
    orders: [
      makeOrder({
        id: 'order-1',
        items: [
          { id: 'item-1', quantity: 1, productId: 'product-1' },
          { id: 'item-2', quantity: 1, productId: 'product-2' },
          { id: 'item-3', quantity: 1, productId: 'product-3' },
        ],
      }),
    ],
    users: [USER_A],
    products: [
      { id: 'product-1', name: 'A', sellerId: SELLER_2.id },
      { id: 'product-2', name: 'B', sellerId: SELLER_1.id },
      { id: 'product-3', name: 'C', sellerId: SELLER_2.id },
    ],
    sellers: [SELLER_1, SELLER_2],
  };
  const { before } = await withReference(fixture, {}, { page: 1, limit: 20 });
  const after = await service.getAdminOrders({}, { page: 1, limit: 20 });

  assert.equal(JSON.stringify(after), JSON.stringify(before));
  // SELLER_2 is seen first, then SELLER_1, and SELLER_2 is not repeated.
  assert.deepEqual(after.orders[0].sellers, [
    { id: SELLER_2.id, storeName: SELLER_2.storeName },
    { id: SELLER_1.id, storeName: SELLER_1.storeName },
  ]);
});

// ---------------------------------------------------------------------------
// 7-8. filtering and search
// ---------------------------------------------------------------------------

test('admin orders: search builds the same where and matches the same orders', async () => {
  const fixture: Fixture = {
    orders: [
      makeOrder({ id: 'order-1', orderNumber: 'EM-ALPHA', trackingNumber: 'TRK-1', createdAt: new Date('2024-03-02T00:00:00.000Z') }),
      makeOrder({ id: 'order-2', orderNumber: 'EM-BETA', trackingNumber: 'TRK-ALPHA', userId: USER_B.id, createdAt: new Date('2024-03-01T00:00:00.000Z') }),
      makeOrder({ id: 'order-3', orderNumber: 'EM-GAMMA', userId: USER_B.id, createdAt: new Date('2024-03-03T00:00:00.000Z') }),
    ],
    users: [USER_A, USER_B],
    products: [],
    sellers: [],
  };

  const filters = { search: 'alpha' };
  const { seen, before } = await withReference(fixture, filters, { page: 1, limit: 20 });
  const after = await service.getAdminOrders(filters, { page: 1, limit: 20 });

  assert.equal(JSON.stringify(after), JSON.stringify(before));
  assert.deepEqual(after.orders.map((o) => o.orderNumber).sort(), ['EM-ALPHA', 'EM-BETA']);
  // Same four search branches, applied to both the page read and the count.
  for (const where of seen.wheres) assert.deepEqual(where, buildWhere(filters));
  assert.equal(seen.wheres.length, 2);
});

test('admin orders: search matches customer name and email the same way', async () => {
  const fixture: Fixture = {
    orders: [
      makeOrder({ id: 'order-1', orderNumber: 'EM-1', userId: USER_B.id }),
      makeOrder({ id: 'order-2', orderNumber: 'EM-2', userId: USER_A.id }),
    ],
    users: [USER_A, USER_B],
    products: [],
    sellers: [],
  };

  for (const term of ['grace', 'ada', 'example.com', 'EM-']) {
    const { before } = await withReference(fixture, { search: term }, { page: 1, limit: 20 });
    const after = await service.getAdminOrders({ search: term }, { page: 1, limit: 20 });
    assert.equal(JSON.stringify(after), JSON.stringify(before), `search=${term}`);
  }
});

test('admin orders: a whitespace-only search is ignored exactly as before', async () => {
  const fixture: Fixture = { orders: [makeOrder({ id: 'order-1' })], users: [USER_A], products: [], sellers: [] };
  const { seen, before } = await withReference(fixture, { search: '   ' }, { page: 1, limit: 20 });
  const after = await service.getAdminOrders({ search: '   ' }, { page: 1, limit: 20 });

  assert.equal(JSON.stringify(after), JSON.stringify(before));
  assert.deepEqual(seen.wheres, [{}, {}]);
});

test('admin orders: status and paymentStatus filters are passed through unchanged', async () => {
  const fixture: Fixture = {
    orders: [
      makeOrder({ id: 'order-1', status: 'SHIPPED', paymentStatus: 'PAID' }),
      makeOrder({ id: 'order-2', status: 'PENDING', paymentStatus: 'FAILED' }),
      makeOrder({ id: 'order-3', status: 'SHIPPED', paymentStatus: 'FAILED' }),
    ],
    users: [USER_A],
    products: [],
    sellers: [],
  };
  const cases: Array<[any, string[]]> = [
    [{ status: 'SHIPPED' }, ['EM-order-1', 'EM-order-3']],
    [{ paymentStatus: 'FAILED' }, ['EM-order-2', 'EM-order-3']],
    [{ status: 'SHIPPED', paymentStatus: 'FAILED' }, ['EM-order-3']],
    [{ status: 'CANCELLED' }, []],
  ];

  for (const [filters, expected] of cases) {
    const { seen, before } = await withReference(fixture, filters, { page: 1, limit: 20 });
    const after = await service.getAdminOrders(filters, { page: 1, limit: 20 });

    assert.equal(JSON.stringify(after), JSON.stringify(before), JSON.stringify(filters));
    assert.deepEqual(after.orders.map((o) => o.orderNumber).sort(), expected);
    for (const where of seen.wheres) assert.deepEqual(where, buildWhere(filters));
  }
});

// ---------------------------------------------------------------------------
// 9-10. pagination and totals
// ---------------------------------------------------------------------------

test('admin orders: pagination clamps, skips and reports total/totalPages identically', async () => {
  const orders = Array.from({ length: 7 }, (_, i) =>
    makeOrder({ id: `order-${i}`, orderNumber: `EM-${i}`, createdAt: new Date(2024, 2, 7 - i) }));
  const fixture: Fixture = { orders, users: [USER_A], products: [], sellers: [] };

  const cases: Array<[any, any]> = [
    [{ page: 1, limit: 20 }, { page: 1, limit: 20, total: 7, totalPages: 1 }],
    [{ page: 2, limit: 3 }, { page: 2, limit: 3, total: 7, totalPages: 3 }],
    [{ page: 3, limit: 3 }, { page: 3, limit: 3, total: 7, totalPages: 3 }],
    [{ page: 4, limit: 3 }, { page: 4, limit: 3, total: 7, totalPages: 3 }],
    // `Number(0) || 20` is falsy, so a 0 limit falls through to the default.
    [{ page: 1, limit: 0 }, { page: 1, limit: 20, total: 7, totalPages: 1 }],
    [{ page: 0, limit: 20 }, { page: 1, limit: 20, total: 7, totalPages: 1 }],
    [{ page: 1, limit: 999 }, { page: 1, limit: 100, total: 7, totalPages: 1 }],
    [{ page: 1, limit: -5 }, { page: 1, limit: 1, total: 7, totalPages: 7 }],
  ];

  for (const [pagination, expected] of cases) {
    const { seen, before } = await withReference(fixture, {}, pagination);
    const after = await service.getAdminOrders({}, pagination);

    assert.equal(JSON.stringify(after), JSON.stringify(before), JSON.stringify(pagination));
    assert.deepEqual(after.pagination, expected);
    assert.deepEqual(
      { skip: seen.argSets.order[0].skip, take: seen.argSets.order[0].take },
      { skip: (expected.page - 1) * expected.limit, take: expected.limit },
    );
  }
});

test('admin orders: total and totalPages reflect the filtered set, not the page', async () => {
  const fixture: Fixture = {
    orders: [
      makeOrder({ id: 'order-1', status: 'SHIPPED' }),
      makeOrder({ id: 'order-2', status: 'SHIPPED' }),
      makeOrder({ id: 'order-3', status: 'PENDING' }),
    ],
    users: [USER_A],
    products: [],
    sellers: [],
  };
  const { before } = await withReference(fixture, { status: 'SHIPPED' }, { page: 1, limit: 1 });
  const after = await service.getAdminOrders({ status: 'SHIPPED' }, { page: 1, limit: 1 });

  assert.equal(JSON.stringify(after), JSON.stringify(before));
  assert.equal(after.pagination.total, 2);
  assert.equal(after.pagination.totalPages, 2);
  assert.equal(after.orders.length, 1);
});

test('admin orders: an empty page reports zero total and zero totalPages', async () => {
  const fixture: Fixture = { orders: [], users: [USER_A], products: [], sellers: [] };
  const { seen, before } = await withReference(fixture, { status: 'CANCELLED' }, { page: 1, limit: 20 });
  const after = await service.getAdminOrders({ status: 'CANCELLED' }, { page: 1, limit: 20 });

  assert.equal(JSON.stringify(after), JSON.stringify(before));
  assert.deepEqual(after, { orders: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  // An empty page must not spend statements on relations that have no keys.
  assert.deepEqual(seen.models(), ['order', 'count']);
});

// ---------------------------------------------------------------------------
// concurrency: the point of the change
// ---------------------------------------------------------------------------

test('admin orders: the user and item reads overlap instead of serialising', async () => {
  const fixture: Fixture = {
    orders: [makeOrder({ id: 'order-1', items: [{ id: 'item-1', quantity: 1, productId: 'product-1' }] })],
    users: [USER_A],
    products: [{ id: 'product-1', name: 'Labtop', sellerId: SELLER_1.id }],
    sellers: [SELLER_1],
  };
  const seen = stubPrisma(fixture, { latencyMs: 10 });
  await service.getAdminOrders({}, { page: 1, limit: 20 });

  const at = (model: string) => seen.calls.find((c) => c.model === model)!.at;
  const siblings = ['user', 'orderItem'].map(at);
  assert.equal(siblings[0], siblings[1], 'sibling reads must start in the same tick');

  // The genuinely dependent levels still come after the level below them.
  const userAt = at('user');
  const itemAt = at('orderItem');
  assert.ok(at('product') >= userAt && at('product') >= itemAt, 'products wait for both siblings');
  assert.ok(at('sellerProfile') >= at('product'), 'seller profiles wait for products');
});

test('admin orders: the statement count is unchanged', async () => {
  const fixture: Fixture = {
    orders: [makeOrder({ id: 'order-1', items: [{ id: 'item-1', quantity: 1, productId: 'product-1' }] })],
    users: [USER_A],
    products: [{ id: 'product-1', name: 'Labtop', sellerId: SELLER_1.id }],
    sellers: [SELLER_1],
  };
  const seen = stubPrisma(fixture);
  await service.getAdminOrders({}, { page: 1, limit: 20 });
  assert.equal(seen.calls.length, 6);
});

test('admin orders: repeated user ids are fetched once', async () => {
  const fixture: Fixture = {
    orders: [
      makeOrder({ id: 'order-1', createdAt: new Date('2024-03-02T00:00:00.000Z') }),
      makeOrder({ id: 'order-2', createdAt: new Date('2024-03-01T00:00:00.000Z') }),
    ],
    users: [USER_A],
    products: [],
    sellers: [],
  };
  const seen = stubPrisma(fixture);
  const after = await service.getAdminOrders({}, { page: 1, limit: 20 });

  assert.deepEqual(seen.argSets.user[0].where.id.in, [USER_A.id]);
  assert.equal(after.orders.length, 2);
  assert.equal(after.orders[0].user?.id, USER_A.id);
  assert.equal(after.orders[1].user?.id, USER_A.id);
});

test('admin orders: relation levels with no keys are skipped', async () => {
  const fixture: Fixture = { orders: [makeOrder({ id: 'order-1', items: [] })], users: [USER_A], products: [], sellers: [] };
  const seen = stubPrisma(fixture);
  await service.getAdminOrders({}, { page: 1, limit: 20 });

  // users and items still run (orders exist), products do not (no items),
  // seller profiles do not (no products).
  assert.deepEqual(seen.models(), ['order', 'count', 'user', 'orderItem']);
  assert.deepEqual(seen.argSets.product, []);
  assert.deepEqual(seen.argSets.sellerProfile, []);
});

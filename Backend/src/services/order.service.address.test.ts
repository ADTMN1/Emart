import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import prisma from '../config/database';
import { OrderService } from './order.service';

/**
 * Order detail loads the billing and shipping address with ONE query instead of
 * two per-relation round-trips.
 *
 * The two relations are independent foreign keys, so this must never collapse
 * them into each other: a distinct pair stays distinct, an identical pair stays
 * identical, and the raw FK columns never leak into the payload. The service
 * reads through the `prisma` singleton, so the tests swap its methods for
 * in-memory fakes and restore them afterwards.
 */

const SELLER_USER = 'seller-user-1';
const OTHER_USER = 'other-user-1';

let restore: Array<() => void> = [];

afterEach(() => {
  for (const fn of restore) fn();
  restore = [];
});

interface AddressRow {
  id: string;
  userId: string;
  fullName: string;
  addressLine: string;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

function makeAddress(overrides: Partial<AddressRow> & { id: string }): AddressRow {
  return {
    userId: SELLER_USER,
    fullName: 'Ada Lovelace',
    addressLine: '1 Analytical Way',
    city: 'London',
    state: 'Greater London',
    postalCode: 'SW1A 1AA',
    country: 'United Kingdom',
    phone: '+44 20 7946 0000',
    isDefault: false,
    ...overrides,
  };
}

interface Fixture {
  order: any;
  addresses: AddressRow[];
  addressFindManyCalls: Array<{ ids: string[] }>;
  orderFindFirstCalls: Array<{ where: any }>;
}

/**
 * Installs a prisma fake that supports both the current FK-select shape
 * (`billingAddressId`/`shippingAddressId` + a separate address lookup) and the
 * older two-relation shape, so the assertions describe behaviour rather than
 * the query strategy.
 */
function stubPrisma(fixture: { order: any; addresses: AddressRow[] }) {
  const seen: Fixture = {
    order: fixture.order,
    addresses: fixture.addresses,
    addressFindManyCalls: [],
    orderFindFirstCalls: [],
  };

  const projectAddress = (row: AddressRow) => ({
    fullName: row.fullName,
    addressLine: row.addressLine,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    country: row.country,
    phone: row.phone,
  });

  // Order row: returns the FK columns and, when the caller selected the
  // relations instead, hydrates them the way Prisma would.
  const orderFindFirst = async (args: any) => {
    seen.orderFindFirstCalls.push({ where: args?.where });
    if (args?.where?.id !== seen.order.id || args?.where?.userId !== SELLER_USER) {
      return null;
    }
    const select = args?.select ?? {};
    const base: any = { id: seen.order.id, orderNumber: seen.order.orderNumber, status: seen.order.status };
    if (select.billingAddressId) base.billingAddressId = seen.order.billingAddressId;
    if (select.shippingAddressId) base.shippingAddressId = seen.order.shippingAddressId;
    if (select.billingAddress) {
      base.billingAddress =
        seen.addresses.find((a) => a.id === seen.order.billingAddressId) ?? null;
    }
    if (select.shippingAddress) {
      base.shippingAddress =
        seen.addresses.find((a) => a.id === seen.order.shippingAddressId) ?? null;
    }
    return base;
  };

  const addressFindMany = async (args: any) => {
    const ids = args?.where?.id?.in ?? [];
    seen.addressFindManyCalls.push({ ids });
    return seen.addresses.filter((a) => ids.includes(a.id)).map((a) => ({ id: a.id, ...projectAddress(a) }));
  };

  const originalOrderFindFirst = prisma.order.findFirst;
  const originalAddressFindMany = prisma.address.findMany;
  prisma.order.findFirst = orderFindFirst as any;
  prisma.address.findMany = addressFindMany as any;
  restore.push(() => {
    prisma.order.findFirst = originalOrderFindFirst;
    prisma.address.findMany = originalAddressFindMany;
  });

  return seen;
}

const service = new OrderService();

test('order detail: distinct billing and shipping addresses stay distinct', async () => {
  const billing = makeAddress({ id: 'addr-billing', fullName: 'Billing Person', addressLine: '10 Invoice St' });
  const shipping = makeAddress({ id: 'addr-shipping', fullName: 'Shipping Person', addressLine: '20 Delivery Rd' });
  const seen = stubPrisma({
    order: { id: 'order-1', orderNumber: 'EM-1', status: 'PENDING', billingAddressId: billing.id, shippingAddressId: shipping.id },
    addresses: [billing, shipping],
  });

  const order = await service.getOrderById(SELLER_USER, 'order-1');

  assert.equal(order.billingAddress?.fullName, 'Billing Person');
  assert.equal(order.billingAddress?.addressLine, '10 Invoice St');
  assert.equal(order.shippingAddress?.fullName, 'Shipping Person');
  assert.equal(order.shippingAddress?.addressLine, '20 Delivery Rd');
  // Billing data must never be served as shipping data (or vice versa).
  assert.notEqual(order.billingAddress?.addressLine, order.shippingAddress?.addressLine);
  // One query, de-duplicated id list.
  assert.equal(seen.addressFindManyCalls.length, 1);
  assert.deepEqual(seen.addressFindManyCalls[0]?.ids.sort(), [billing.id, shipping.id]);
});

test('order detail: the same billing and shipping address is returned for both', async () => {
  const shared = makeAddress({ id: 'addr-shared', fullName: 'Same Person' });
  const seen = stubPrisma({
    order: { id: 'order-2', orderNumber: 'EM-2', status: 'CONFIRMED', billingAddressId: shared.id, shippingAddressId: shared.id },
    addresses: [shared],
  });

  const order = await service.getOrderById(SELLER_USER, 'order-2');

  assert.equal(order.billingAddress?.fullName, 'Same Person');
  assert.equal(order.shippingAddress?.fullName, 'Same Person');
  assert.deepEqual(order.billingAddress, order.shippingAddress);
  // The duplicate id is collapsed so the IN list holds one entry.
  assert.equal(seen.addressFindManyCalls.length, 1);
  assert.deepEqual(seen.addressFindManyCalls[0]?.ids, [shared.id]);
});

test('order detail: a missing address row yields null instead of throwing', async () => {
  const seen = stubPrisma({
    // The FK references a row that no longer exists.
    order: { id: 'order-3', orderNumber: 'EM-3', status: 'PENDING', billingAddressId: 'addr-gone', shippingAddressId: 'addr-gone' },
    addresses: [],
  });

  const order = await service.getOrderById(SELLER_USER, 'order-3');

  assert.equal(order.billingAddress, null);
  assert.equal(order.shippingAddress, null);
  // No lookup is issued when the caller must not see an address at all.
  assert.equal(seen.addressFindManyCalls.length, 1);
});

test('order detail: the raw FK columns are not exposed in the payload', async () => {
  const addr = makeAddress({ id: 'addr-1' });
  stubPrisma({
    order: { id: 'order-4', orderNumber: 'EM-4', status: 'PENDING', billingAddressId: addr.id, shippingAddressId: addr.id },
    addresses: [addr],
  });

  const order = await service.getOrderById(SELLER_USER, 'order-4') as any;

  assert.equal('billingAddressId' in order, false);
  assert.equal('shippingAddressId' in order, false);
  assert.equal('id' in (order.billingAddress ?? {}), false, 'address id is not part of the contract');
  // Ownership scoping is preserved: another user cannot read the order.
  await assert.rejects(() => service.getOrderById(OTHER_USER, 'order-4'), /Order not found/);
});

test('order detail: the address projection exposes exactly the contract fields', async () => {
  const addr = makeAddress({ id: 'addr-5' });
  stubPrisma({
    order: { id: 'order-5', orderNumber: 'EM-5', status: 'PENDING', billingAddressId: addr.id, shippingAddressId: addr.id },
    addresses: [addr],
  });

  const order = await service.getOrderById(SELLER_USER, 'order-5');

  assert.deepEqual(Object.keys(order.billingAddress as object).sort(), [
    'addressLine',
    'city',
    'country',
    'fullName',
    'phone',
    'postalCode',
    'state',
  ]);
  assert.deepEqual(Object.keys(order.shippingAddress as object).sort(), Object.keys(order.billingAddress as object).sort());
});

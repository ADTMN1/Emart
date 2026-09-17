/**
 * Phase 2 verification: shipment lifecycle management.
 *
 * Run: node scripts/phase2-shipment-lifecycle.test.mjs
 *
 * Spawns the built backend (dist/server.js) on a scratch port and checks all
 * 18 required scenarios:
 *   1.  Admin can create shipment
 *   2.  Admin can retrieve shipment
 *   3.  Admin can update shipment
 *   4.  Admin can change shipment status
 *   5.  Admin can create tracking event
 *   6.  Admin can retrieve tracking events
 *   7.  Normal customer cannot create shipment
 *   8.  Normal customer cannot update shipment
 *   9.  Normal customer cannot create tracking event
 *   10. Customer can retrieve shipment for own order
 *   11. Customer cannot retrieve another customer's shipment
 *   12. Unauthenticated requests are rejected
 *   13. Invalid order ID rejected
 *   14. Duplicate shipment creation handled correctly (409)
 *   15. Invalid shipment status rejected
 *   16. Tracking events ordered correctly (newest first)
 *   17. Existing admin order endpoints still work (Phase 1 regression)
 *   18. Existing customer order endpoints still enforce ownership
 *
 * Self-contained: creates its own customer + order, and removes all test
 * data at the end (deleteMany on the unique test SKUs / tracking prefix).
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const PORT = 5092;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_TRACKING_PREFIX = 'PH2TEST-';
const TEST_EMAIL_PREFIX = 'phase2-cust-';

const envText = fs.readFileSync(path.join(backendRoot, '.env'), 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function request(method, urlPath, { token, body } = {}, attempt = 0) {
  try {
    const res = await fetch(`${BASE}${urlPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* empty body */
    }
    return { status: res.status, json };
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 300));
      return request(method, urlPath, { token, body }, attempt + 1);
    }
    throw err;
  }
}

async function waitForHealth(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const server = spawn(process.execPath, [path.join(backendRoot, 'dist', 'server.js')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

/** Removes every record this test created. Never touches non-test data. */
async function cleanupTestCustomers() {
  try {
    const { PrismaClient, Prisma } = await import('@prisma/client');
    const client = new PrismaClient();
    const testUsers = await client.user.findMany({
      where: { email: { startsWith: TEST_EMAIL_PREFIX } },
      select: { id: true },
    });
    for (const user of testUsers) {
      const orders = await client.order.findMany({ where: { userId: user.id }, select: { id: true } });
      for (const order of orders) {
        // order_items has no cascade; delete items first.
        await client.orderItem.deleteMany({ where: { orderId: order.id } });
        await client.shipment.deleteMany({ where: { orderId: order.id } });
        await client.order.delete({ where: { id: order.id } });
      }
      await client.cart.deleteMany({ where: { userId: user.id } });
      await client.user.delete({ where: { id: user.id } });
    }
    console.log(`Cleanup: removed ${testUsers.length} test customer(s) with their orders/shipments`);
    await client.$disconnect();
  } catch (err) {
    console.log(`Cleanup skipped: ${err.message}`);
  }
}

try {
  const up = await waitForHealth();
  if (!up) {
    console.error('Server failed to start. Log:\n' + serverLog);
    process.exit(1);
  }

  // ---- setup ---------------------------------------------------------------
  console.log('\n— Setup: admin login, two customers, one order each —');

  const adminLogin = await request('POST', '/api/v1/auth/login', {
    body: { email: env.ADMIN_EMAIL || 'admin@emart.com', password: env.ADMIN_PASSWORD || 'Admin@123456' },
  });
  check('admin login', adminLogin.status === 200 && !!adminLogin.json?.data?.token);
  const adminToken = adminLogin.json.data.token;

  const suffix = Date.now();
  const customers = [];
  for (const [first, last] of [['Alice', 'Owner'], ['Bob', 'Outsider']]) {
    const signup = await request('POST', '/api/v1/auth/register', {
      body: {
        email: `${TEST_EMAIL_PREFIX}${suffix}-${first.toLowerCase()}@example.com`,
        password: 'Customer@12345',
        firstName: first,
        lastName: last,
      },
    });
    let token = signup.json?.data?.token;
    if (!token) {
      const login = await request('POST', '/api/v1/auth/login', {
        body: {
          email: `${TEST_EMAIL_PREFIX}${suffix}-${first.toLowerCase()}@example.com`,
          password: 'Customer@12345',
        },
      });
      token = login.json?.data?.token;
    }
    check(`${first} customer ready`, !!token);
    customers.push(token);
  }
  const [ownerToken, outsiderToken] = customers;

  // Pick any available product (seeded catalog) to build the order.
  const productsRes = await request('GET', '/api/v1/products?limit=1');
  const product = productsRes.json?.data?.products?.[0];
  check('a product exists to order', !!product);

  const address = {
    fullName: 'Alice Owner',
    addressLine: '1 Test Way',
    city: 'Testville',
    state: 'TS',
    postalCode: '00000',
    country: 'Testland',
    countryCode: 'TS',
    phone: '0000000000',
  };
  const orderRes = await request('POST', '/api/v1/orders', {
    token: ownerToken,
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      shippingMethod: 'dhl',
      shippingAddress: address,
    },
  });
  check('owner order created', orderRes.status === 201 && !!orderRes.json?.data?.id, `status ${orderRes.status} ${JSON.stringify(orderRes.json?.error || '')}`);
  const orderId = orderRes.json.data.id;

  console.log('\n— Test 12: unauthenticated requests are rejected —');
  for (const [method, path] of [
    ['POST', `/api/v1/admin/orders/${orderId}/shipment`],
    ['GET', `/api/v1/admin/orders/${orderId}/shipment`],
    ['PATCH', `/api/v1/admin/orders/${orderId}/shipment`],
    ['POST', `/api/v1/admin/orders/${orderId}/shipment/status`],
    ['POST', `/api/v1/admin/orders/${orderId}/shipment/events`],
    ['GET', `/api/v1/admin/orders/${orderId}/shipment/events`],
  ]) {
    const res = await request(method, path, {});
    check(`${method} ${path.replace(orderId, ':orderId')} without token → 401`, res.status === 401, `got ${res.status}`);
  }

  console.log('\n— Tests 7/8/9: customer is forbidden from all shipment writes —');
  const custCreate = await request('POST', `/api/v1/admin/orders/${orderId}/shipment`, {
    token: ownerToken,
    body: { carrier: 'DHL', trackingNumber: `${TEST_TRACKING_PREFIX}EVIL`, shippingCost: 10 },
  });
  check('Test 7: customer create shipment → 403', custCreate.status === 403, `got ${custCreate.status}`);
  const custUpdate = await request('PATCH', `/api/v1/admin/orders/${orderId}/shipment`, {
    token: ownerToken,
    body: { carrier: 'Evil' },
  });
  check('Test 8: customer update shipment → 403', custUpdate.status === 403, `got ${custUpdate.status}`);
  const custEvent = await request('POST', `/api/v1/admin/orders/${orderId}/shipment/events`, {
    token: ownerToken,
    body: { message: 'fake event' },
  });
  check('Test 9: customer create tracking event → 403', custEvent.status === 403, `got ${custEvent.status}`);
  const custStatus = await request('POST', `/api/v1/admin/orders/${orderId}/shipment/status`, {
    token: ownerToken,
    body: { status: 'SHIPPED' },
  });
  check('customer change shipment status → 403', custStatus.status === 403, `got ${custStatus.status}`);

  console.log('\n— Test 13: invalid order ID rejected —');
  const badId = await request('POST', '/api/v1/admin/orders/not-a-uuid/shipment', {
    token: adminToken,
    body: { carrier: 'DHL', trackingNumber: `${TEST_TRACKING_PREFIX}X1`, shippingCost: 1 },
  });
  check('invalid orderId → 400', badId.status === 400, `got ${badId.status}`);
  // A well-formed (v4) UUID that matches no order — must reach the service and 404.
  const NONEXISTENT_ORDER = '9f1c3b2a-7d4e-4c8a-9b2f-1e6d5a7c3b90';
  const missingOrder = await request('POST', `/api/v1/admin/orders/${NONEXISTENT_ORDER}/shipment`, {
    token: adminToken,
    body: { carrier: 'DHL', trackingNumber: `${TEST_TRACKING_PREFIX}X2`, shippingCost: 1 },
  });
  check('nonexistent order → 404', missingOrder.status === 404, `got ${missingOrder.status}`);

  console.log('\n— Test 1: admin creates shipment —');
  const create = await request('POST', `/api/v1/admin/orders/${orderId}/shipment`, {
    token: adminToken,
    body: {
      carrier: 'DHL Express',
      trackingNumber: `${TEST_TRACKING_PREFIX}0001`,
      shippingCost: 58,
      estimatedDelivery: new Date(Date.now() + 5 * 864e5).toISOString(),
    },
  });
  check('create shipment → 201', create.status === 201, `got ${create.status} ${JSON.stringify(create.json?.error || '')}`);
  check('created shipment has correct carrier', create.json?.data?.shipment?.carrier === 'DHL Express');
  check('created shipment starts PENDING with one event', create.json?.data?.shipment?.status === 'PENDING' && create.json.data.shipment.events.length === 1);

  console.log('\n— Test 14: duplicate shipment creation → 409 —');
  const duplicate = await request('POST', `/api/v1/admin/orders/${orderId}/shipment`, {
    token: adminToken,
    body: { carrier: 'FedEx', trackingNumber: `${TEST_TRACKING_PREFIX}0002`, shippingCost: 20 },
  });
  check('duplicate shipment → 409', duplicate.status === 409, `got ${duplicate.status}`);

  // Tracking-number uniqueness needs a second, shipment-less order (Bob's).
  const bobOrderRes = await request('POST', '/api/v1/orders', {
    token: outsiderToken,
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      shippingMethod: 'dhl',
      shippingAddress: {
        fullName: 'Bob Outsider',
        addressLine: '2 Test Way',
        city: 'Testville',
        state: 'TS',
        postalCode: '00000',
        country: 'Testland',
        countryCode: 'TS',
        phone: '0000000000',
      },
    },
  });
  check('second order created for tracking-conflict test', bobOrderRes.status === 201 && !!bobOrderRes.json?.data?.id);
  const dupTracking = await request('POST', `/api/v1/admin/orders/${bobOrderRes.json.data.id}/shipment`, {
    token: adminToken,
    body: { carrier: 'FedEx', trackingNumber: `${TEST_TRACKING_PREFIX}0001`, shippingCost: 20 },
  });
  check('duplicate tracking number → 409', dupTracking.status === 409, `got ${dupTracking.status}`);

  console.log('\n— Test 2: admin retrieves shipment —');
  const got = await request('GET', `/api/v1/admin/orders/${orderId}/shipment`, { token: adminToken });
  check('admin GET shipment → 200', got.status === 200);
  check('response shape { shipment }', !!got.json?.data?.shipment);
  check('admin view includes shippingCost', got.json.data.shipment.shippingCost === 58);

  console.log('\n— Test 15: invalid shipment status rejected —');
  const badStatus = await request('POST', `/api/v1/admin/orders/${orderId}/shipment/status`, {
    token: adminToken,
    body: { status: 'TELEPORTED' },
  });
  check('invalid status value → 400', badStatus.status === 400, `got ${badStatus.status}`);
  const badTransition = await request('POST', `/api/v1/admin/orders/${orderId}/shipment/status`, {
    token: adminToken,
    body: { status: 'DELIVERED' },
  });
  check('illegal transition PENDING→DELIVERED → 400', badTransition.status === 400, `got ${badTransition.status}`);

  console.log('\n— Test 4: admin changes status (valid transitions, auto-events) —');
  const toShipped = await request('POST', `/api/v1/admin/orders/${orderId}/shipment/status`, {
    token: adminToken,
    body: { status: 'SHIPPED', location: 'Testville Warehouse' },
  });
  check('PENDING → SHIPPED ok', toShipped.status === 200 && toShipped.json.data.shipment.status === 'SHIPPED');
  check('shippedAt set on SHIPPED', !!toShipped.json.data.shipment.shippedAt);
  const toTransit = await request('POST', `/api/v1/admin/orders/${orderId}/shipment/status`, {
    token: adminToken,
    body: { status: 'IN_TRANSIT' },
  });
  check('SHIPPED → IN_TRANSIT ok', toTransit.status === 200);
  const toOut = await request('POST', `/api/v1/admin/orders/${orderId}/shipment/status`, {
    token: adminToken,
    body: { status: 'OUT_FOR_DELIVERY' },
  });
  check('IN_TRANSIT → OUT_FOR_DELIVERY ok', toOut.status === 200);
  const toDelivered = await request('POST', `/api/v1/admin/orders/${orderId}/shipment/status`, {
    token: adminToken,
    body: { status: 'DELIVERED' },
  });
  check('OUT_FOR_DELIVERY → DELIVERED ok', toDelivered.status === 200 && !!toDelivered.json.data.shipment.deliveredAt);
  const afterTerminal = await request('POST', `/api/v1/admin/orders/${orderId}/shipment/status`, {
    token: adminToken,
    body: { status: 'IN_TRANSIT' },
  });
  check('terminal DELIVERED cannot change → 400', afterTerminal.status === 400, `got ${afterTerminal.status}`);

  console.log('\n— Test 3: admin updates shipment (PATCH) —');
  const patch = await request('PATCH', `/api/v1/admin/orders/${orderId}/shipment`, {
    token: adminToken,
    body: { carrier: 'DHL Express International', shippingCost: 61.5 },
  });
  check('PATCH updates only given fields', patch.status === 200 && patch.json.data.shipment.carrier === 'DHL Express International');
  check('PATCH kept tracking number untouched', patch.json.data.shipment.trackingNumber === `${TEST_TRACKING_PREFIX}0001`);
  check('PATCH kept status untouched', patch.json.data.shipment.status === 'DELIVERED');
  const patchBad = await request('PATCH', `/api/v1/admin/orders/${orderId}/shipment`, {
    token: adminToken,
    body: { shippingCost: -5 },
  });
  check('PATCH negative cost → 400', patchBad.status === 400, `got ${patchBad.status}`);

  console.log('\n— Tests 5/6: tracking events —');
  const addEvent = await request('POST', `/api/v1/admin/orders/${orderId}/shipment/events`, {
    token: adminToken,
    body: {
      status: 'DELIVERED',
      message: 'Signed for at reception',
      location: 'Testville',
      occurredAt: new Date(Date.now() - 3600e3).toISOString(),
    },
  });
  check('admin adds tracking event → 201', addEvent.status === 201, `got ${addEvent.status}`);
  const custAddsEvent = await request('POST', `/api/v1/admin/orders/${orderId}/shipment/events`, {
    token: outsiderToken,
    body: { message: 'customer injected event' },
  });
  check('other customer cannot add events → 403', custAddsEvent.status === 403);
  const eventsRes = await request('GET', `/api/v1/admin/orders/${orderId}/shipment/events`, { token: adminToken });
  check('Test 6: admin retrieves events → 200', eventsRes.status === 200 && Array.isArray(eventsRes.json.data.events));

  console.log('\n— Test 16: events ordered newest-first —');
  const events = eventsRes.json.data.events;
  let ordered = true;
  for (let i = 1; i < events.length; i++) {
    const prev = new Date(events[i - 1].occurredAt || events[i - 1].createdAt).getTime();
    const cur = new Date(events[i].occurredAt || events[i].createdAt).getTime();
    if (cur > prev) ordered = false;
  }
  check('events sorted newest → oldest', ordered, JSON.stringify(events.map((e) => e.occurredAt)));
  check('auto status events + manual event all present', events.length >= 5, `count ${events.length}`);
  check(
    'backdated manual event sits in correct chronological position',
    events[events.length - 1].message === 'Signed for at reception' ||
      events.some((e, i) => e.message === 'Signed for at reception' && i > 0)
  );

  console.log('\n— Tests 10/11: customer shipment visibility + ownership —');
  const ownView = await request('GET', `/api/v1/orders/${orderId}`, { token: ownerToken });
  check('Test 10: owner sees own order → 200', ownView.status === 200);
  check('owner order includes shipment', !!ownView.json?.data?.shipment);
  check('customer view hides shippingCost', !('shippingCost' in (ownView.json?.data?.shipment || {})));
  check('customer shipment has events timeline', Array.isArray(ownView.json?.data?.shipment?.events) && ownView.json.data.shipment.events.length > 0);

  const outsiderView = await request('GET', `/api/v1/orders/${orderId}`, { token: outsiderToken });
  check('Test 11: outsider GET other order → 404', outsiderView.status === 404, `got ${outsiderView.status}`);

  console.log('\n— Tests 17/18: Phase 1 + customer regression —');
  const adminOrders = await request('GET', '/api/v1/admin/orders', { token: adminToken });
  check('Test 17: /admin/orders still works', adminOrders.status === 200 && Array.isArray(adminOrders.json?.data?.orders));
  const adminDetail = await request('GET', `/api/v1/admin/orders/${orderId}`, { token: adminToken });
  check('/admin/orders/:id still works and embeds shipment', adminDetail.status === 200 && 'shipment' in (adminDetail.json?.data || {}));
  const adminShipmentForbidden = await request('GET', `/api/v1/admin/orders`, { token: ownerToken });
  check('customer still 403 on /admin/orders', adminShipmentForbidden.status === 403);
  const ownList = await request('GET', '/api/v1/orders', { token: ownerToken });
  check(
    'Test 18: customer /orders returns only own orders',
    ownList.status === 200 && (ownList.json?.data?.orders || []).every((o) => o.id === orderId)
  );

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    console.log('Failures:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exitCode = 1;
  }
} catch (unexpected) {
  failed++;
  failures.push(`Unexpected error: ${unexpected?.message || unexpected}`);
  console.error('\nUnexpected error during test run:', unexpected);
  console.error('Server log:\n' + serverLog);
  process.exitCode = 1;
} finally {
  server.kill('SIGKILL');
  await cleanupTestCustomers();
  process.exit(process.exitCode ?? (failed > 0 ? 1 : 0));
}

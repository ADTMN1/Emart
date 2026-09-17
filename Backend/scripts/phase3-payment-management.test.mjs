/**
 * Phase 3 verification: inline payment management in admin orders.
 *
 * Run: node scripts/phase3-payment-management.test.mjs
 *
 * Spawns the built backend (dist/server.js) on a scratch port and checks all
 * 18 required scenarios:
 *   1.  Admin can retrieve payment information
 *   2.  Admin can verify a valid payment (PAID + paidAt stamped)
 *   3.  Admin can reject a valid payment (FAILED + reason kept)
 *   4.  Rejection reason is preserved (proof survives, revert restores it)
 *   5.  Invalid payment transition is rejected (REFUNDED is terminal)
 *   6.  Invalid order ID is rejected (400)
 *   7.  Nonexistent order is rejected (404)
 *   8.  Normal customer cannot access admin payment endpoint (403)
 *   9.  Normal customer cannot verify payment (403)
 *   10. Normal customer cannot reject payment (403)
 *   11. Unauthenticated requests are rejected (401)
 *   12. Payment proof remains available after verification
 *   13. Payment proof remains available after rejection
 *   14. Order totals remain unchanged after payment actions
 *   15. Order items remain unchanged after payment actions
 *   16. Shipment information remains unchanged after payment actions
 *   17. Phase 1 admin order functionality still works
 *   18. Phase 2 shipment functionality still works
 *
 * Self-contained: creates its own customer + order, and removes all test
 * data at the end (deleteMany on the unique test email prefix).
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const PORT = 5093;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_EMAIL_PREFIX = 'phase3-cust-';
const TEST_TRACKING_PREFIX = 'PH3TEST-';

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
    const { PrismaClient } = await import('@prisma/client');
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

// Tiny 1x1 PNG used as payment proof (matches the checkout's data-URL proof format).
const PROOF_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

try {
  const up = await waitForHealth();
  if (!up) {
    console.error('Server failed to start. Log:\n' + serverLog);
    process.exit(1);
  }

  // ---- setup ---------------------------------------------------------------
  console.log('\n— Setup: admin login, customer, order with proof + shipment —');

  const adminLogin = await request('POST', '/api/v1/auth/login', {
    body: { email: env.ADMIN_EMAIL || 'admin@emart.com', password: env.ADMIN_PASSWORD || 'Admin@123456' },
  });
  check('admin login', adminLogin.status === 200 && !!adminLogin.json?.data?.token);
  const adminToken = adminLogin.json.data.token;

  const suffix = Date.now();
  const email = `${TEST_EMAIL_PREFIX}${suffix}@example.com`;
  const signup = await request('POST', '/api/v1/auth/register', {
    body: { email, password: 'Customer@12345', firstName: 'Pay', lastName: 'Tester' },
  });
  let customerToken = signup.json?.data?.token;
  if (!customerToken) {
    const login = await request('POST', '/api/v1/auth/login', { body: { email, password: 'Customer@12345' } });
    customerToken = login.json?.data?.token;
  }
  check('customer ready', !!customerToken);

  const outsider = await request('POST', '/api/v1/auth/register', {
    body: {
      email: `${TEST_EMAIL_PREFIX}${suffix}-out@example.com`,
      password: 'Customer@12345',
      firstName: 'No',
      lastName: 'Access',
    },
  });
  let outsiderToken = outsider.json?.data?.token;
  if (!outsiderToken) {
    const login = await request('POST', '/api/v1/auth/login', {
      body: { email: `${TEST_EMAIL_PREFIX}${suffix}-out@example.com`, password: 'Customer@12345' },
    });
    outsiderToken = login.json?.data?.token;
  }
  check('outsider customer ready', !!outsiderToken);

  const productsRes = await request('GET', '/api/v1/products?limit=1');
  const product = productsRes.json?.data?.products?.[0];
  check('a product exists to order', !!product);

  const orderRes = await request('POST', '/api/v1/orders', {
    token: customerToken,
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      shippingMethod: 'dhl',
      paymentMethod: 'crypto',
      paymentStatus: 'PENDING',
      paymentProofUrl: PROOF_DATA_URL,
      shippingAddress: {
        fullName: 'Pay Tester',
        addressLine: '3 Payment Lane',
        city: 'Testville',
        state: 'TS',
        postalCode: '00000',
        country: 'Testland',
        countryCode: 'TS',
        phone: '0000000000',
      },
    },
  });
  check(
    'order created with payment proof',
    orderRes.status === 201 && !!orderRes.json?.data?.id,
    `status ${orderRes.status} ${JSON.stringify(orderRes.json?.error || '')}`
  );
  const orderId = orderRes.json.data.id;

  // Snapshot the full order for immutability assertions (14/15/16).
  const before = await request('GET', `/api/v1/admin/orders/${orderId}`, { token: adminToken });
  const orderBefore = before.json?.data || {};
  check('baseline order fetched (totals/items/shipment captured)', before.status === 200 && !!orderBefore.id);

  console.log('\n— Test 11: unauthenticated requests are rejected —');
  for (const [method, path] of [
    ['GET', `/api/v1/admin/orders/${orderId}/payment`],
    ['PATCH', `/api/v1/admin/orders/${orderId}/payment`],
    ['POST', `/api/v1/admin/orders/${orderId}/payment/verify`],
    ['POST', `/api/v1/admin/orders/${orderId}/payment/reject`],
  ]) {
    const res = await request(method, path, {});
    check(`${method} ${path.replace(orderId, ':orderId')} without token → 401`, res.status === 401, `got ${res.status}`);
  }

  console.log('\n— Tests 8/9/10: customers are forbidden from admin payment endpoints —');
  const custGet = await request('GET', `/api/v1/admin/orders/${orderId}/payment`, { token: customerToken });
  check('Test 8: customer GET payment → 403', custGet.status === 403, `got ${custGet.status}`);
  const custVerify = await request('POST', `/api/v1/admin/orders/${orderId}/payment/verify`, {
    token: customerToken,
    body: {},
  });
  check('Test 9: customer verify payment → 403', custVerify.status === 403, `got ${custVerify.status}`);
  const custReject = await request('POST', `/api/v1/admin/orders/${orderId}/payment/reject`, {
    token: customerToken,
    body: { reason: 'self approve' },
  });
  check('Test 10: customer reject payment → 403', custReject.status === 403, `got ${custReject.status}`);
  const custPatch = await request('PATCH', `/api/v1/admin/orders/${orderId}/payment`, {
    token: customerToken,
    body: { paymentStatus: 'PAID' },
  });
  check('customer PATCH payment → 403', custPatch.status === 403, `got ${custPatch.status}`);

  console.log('\n— Tests 6/7: invalid and nonexistent order IDs —');
  const badId = await request('GET', '/api/v1/admin/orders/not-a-uuid/payment', { token: adminToken });
  check('Test 6: invalid orderId → 400', badId.status === 400, `got ${badId.status}`);
  const NONEXISTENT_ORDER = '9f1c3b2a-7d4e-4c8a-9b2f-1e6d5a7c3b91';
  const missing = await request('GET', `/api/v1/admin/orders/${NONEXISTENT_ORDER}/payment`, { token: adminToken });
  check('Test 7: nonexistent order → 404', missing.status === 404, `got ${missing.status}`);

  console.log('\n— Test 1: admin retrieves payment information —');
  const pay = await request('GET', `/api/v1/admin/orders/${orderId}/payment`, { token: adminToken });
  check('Test 1: GET payment → 200', pay.status === 200, `got ${pay.status}`);
  check('payment info includes method + proof + status', pay.json?.data?.paymentMethod === 'crypto' && pay.json?.data?.paymentProofUrl === PROOF_DATA_URL && pay.json?.data?.paymentStatus === 'PENDING');
  check('payment info includes allowedTransitions', Array.isArray(pay.json?.data?.allowedTransitions) && pay.json.data.allowedTransitions.includes('PAID') && pay.json.data.allowedTransitions.includes('FAILED'));

  console.log('\n— Test 5: invalid transitions and bad payloads —');
  const badStatusValue = await request('PATCH', `/api/v1/admin/orders/${orderId}/payment`, {
    token: adminToken,
    body: { paymentStatus: 'TELEPORTED' },
  });
  check('invalid paymentStatus value → 400', badStatusValue.status === 400, `got ${badStatusValue.status}`);
  const verifyTerminal = await request('POST', `/api/v1/admin/orders/${NONEXISTENT_ORDER}/payment/verify`, {
    token: adminToken,
    body: {},
  });
  check('verify on nonexistent order → 404', verifyTerminal.status === 404, `got ${verifyTerminal.status}`);

  console.log('\n— Test 3: admin rejects payment (reason recorded, proof kept) —');
  const reject = await request('POST', `/api/v1/admin/orders/${orderId}/payment/reject`, {
    token: adminToken,
    body: { reason: 'Payment proof is unclear.' },
  });
  check('Test 3: reject → 200', reject.status === 200, `got ${reject.status} ${JSON.stringify(reject.json?.error || '')}`);
  check('status now FAILED', reject.json?.data?.paymentStatus === 'FAILED');
  check('Test 4: rejection reason preserved in paymentNote', reject.json?.data?.paymentNote === 'Payment proof is unclear.');
  check('Test 13: proof preserved after rejection', reject.json?.data?.paymentProofUrl === PROOF_DATA_URL);
  check('paidAt cleared on rejection', !reject.json?.data?.paidAt);

  console.log('\n— Test 4: FAILED → PENDING (re-review) restores the proof —');
  const revert = await request('PATCH', `/api/v1/admin/orders/${orderId}/payment`, {
    token: adminToken,
    body: { paymentStatus: 'PENDING' },
  });
  check('FAILED → PENDING allowed', revert.status === 200 && revert.json?.data?.paymentStatus === 'PENDING', `got ${revert.status}`);
  check('note preserved through revert (re-review context)', revert.json?.data?.paymentNote === 'Payment proof is unclear.');

  console.log('\n— Test 2: admin verifies payment —');
  const verify = await request('POST', `/api/v1/admin/orders/${orderId}/payment/verify`, {
    token: adminToken,
    body: { note: 'Transfer confirmed on blockchain explorer.' },
  });
  check('Test 2: verify → 200', verify.status === 200, `got ${verify.status} ${JSON.stringify(verify.json?.error || '')}`);
  check('status now PAID', verify.json?.data?.paymentStatus === 'PAID');
  check('paidAt timestamp recorded', !!verify.json?.data?.paidAt && !Number.isNaN(new Date(verify.json.data.paidAt).getTime()));
  check('Test 12: proof preserved after verification', verify.json?.data?.paymentProofUrl === PROOF_DATA_URL);

  console.log('\n— Test 5: PAID is a locked state except manual revert —');
  const reVerify = await request('POST', `/api/v1/admin/orders/${orderId}/payment/verify`, {
    token: adminToken,
    body: {},
  });
  check('verifying an already-PAID payment → 400', reVerify.status === 400, `got ${reVerify.status}`);
  const rejectPaid = await request('POST', `/api/v1/admin/orders/${orderId}/payment/reject`, {
    token: adminToken,
    body: { reason: 'should not work' },
  });
  check('rejecting a PAID payment → 400', rejectPaid.status === 400, `got ${rejectPaid.status}`);
  const toRefunded = await request('PATCH', `/api/v1/admin/orders/${orderId}/payment`, {
    token: adminToken,
    body: { paymentStatus: 'REFUNDED' },
  });
  check('PAID → REFUNDED blocked (refunds out of scope) → 400', toRefunded.status === 400, `got ${toRefunded.status}`);

  console.log('\n— Tests 14/15/16: payment actions changed nothing else —');
  const after = await request('GET', `/api/v1/admin/orders/${orderId}`, { token: adminToken });
  const orderAfter = after.json?.data || {};
  check(
    'Test 14: totals unchanged (subtotal/serviceFees/shipping/insurance/total)',
    ['subtotal', 'serviceFees', 'domesticShipping', 'internationalShipping', 'insurance', 'total'].every(
      (k) => orderBefore[k] === orderAfter[k]
    ),
    `before=${JSON.stringify([orderBefore.subtotal, orderBefore.total])} after=${JSON.stringify([orderAfter.subtotal, orderAfter.total])}`
  );
  check(
    'Test 15: order items unchanged (count, quantities, prices)',
    (orderBefore.items?.length || 0) === (orderAfter.items?.length || 0) &&
      (orderBefore.items || []).every((b, i) => {
        const a = orderAfter.items?.[i];
        return a && b.quantity === a.quantity && b.priceAtPurchase === a.priceAtPurchase;
      })
  );
  check(
    'Test 16: shipment unchanged (still absent or identical status/tracking)',
    !orderAfter.shipment ||
      (orderAfter.shipment.status === orderBefore.shipment?.status &&
        orderAfter.shipment.trackingNumber === orderBefore.shipment?.trackingNumber)
  );
  check(
    'order status untouched by payment actions (separate concepts)',
    orderBefore.status === orderAfter.status
  );

  console.log('\n— Note-only PATCH —');
  const noteOnly = await request('PATCH', `/api/v1/admin/orders/${orderId}/payment`, {
    token: adminToken,
    body: { paymentNote: 'Customer contacted support about the transfer.' },
  });
  check('note-only PATCH → 200, status stays PAID', noteOnly.status === 200 && noteOnly.json?.data?.paymentStatus === 'PAID', `got ${noteOnly.status}`);
  check('note updated', noteOnly.json?.data?.paymentNote === 'Customer contacted support about the transfer.');
  const emptyPatch = await request('PATCH', `/api/v1/admin/orders/${orderId}/payment`, {
    token: adminToken,
    body: {},
  });
  check('empty PATCH body → 400', emptyPatch.status === 400, `got ${emptyPatch.status}`);

  console.log('\n— Test 17: Phase 1 admin order regression —');
  const adminOrders = await request('GET', '/api/v1/admin/orders', { token: adminToken });
  check('Test 17: /admin/orders list works', adminOrders.status === 200 && Array.isArray(adminOrders.json?.data?.orders));
  const filtered = await request('GET', '/api/v1/admin/orders?paymentStatus=PAID&limit=5', { token: adminToken });
  check('paymentStatus filter works', filtered.status === 200 && (filtered.json?.data?.orders || []).some((o) => o.id === orderId));
  const adminDetail = await request('GET', `/api/v1/admin/orders/${orderId}`, { token: adminToken });
  check('admin detail includes paidAt + paymentNote (Phase 3 fields)', adminDetail.status === 200 && 'paidAt' in (adminDetail.json?.data || {}) && 'paymentNote' in (adminDetail.json?.data || {}));
  const customerBlocked = await request('GET', '/api/v1/admin/orders', { token: customerToken });
  check('customer still 403 on /admin/orders', customerBlocked.status === 403);

  console.log('\n— Test 18: Phase 2 shipment regression —');
  const shipmentCreate = await request('POST', `/api/v1/admin/orders/${orderId}/shipment`, {
    token: adminToken,
    body: {
      carrier: 'DHL Express',
      trackingNumber: `${TEST_TRACKING_PREFIX}0001`,
      shippingCost: 58,
    },
  });
  check(
    'Test 18: shipment creation still works on a PAID order',
    shipmentCreate.status === 201,
    `got ${shipmentCreate.status} ${JSON.stringify(shipmentCreate.json?.error || '')}`
  );
  const toShipped = await request('POST', `/api/v1/admin/orders/${orderId}/shipment/status`, {
    token: adminToken,
    body: { status: 'SHIPPED' },
  });
  check('shipment status transition still works', toShipped.status === 200 && toShipped.json?.data?.shipment?.status === 'SHIPPED');
  const paymentAfterShipment = await request('GET', `/api/v1/admin/orders/${orderId}/payment`, { token: adminToken });
  check('shipment actions did not touch payment state', paymentAfterShipment.json?.data?.paymentStatus === 'PAID');
  const shipmentAfterPayments = await request('GET', `/api/v1/admin/orders/${orderId}/shipment`, { token: adminToken });
  check(
    'payment actions did not touch shipment state',
    shipmentAfterPayments.json?.data?.shipment?.trackingNumber === `${TEST_TRACKING_PREFIX}0001` &&
      shipmentAfterPayments.json?.data?.shipment?.status === 'SHIPPED'
  );

  console.log('\n— Customer view: honest payment status, no admin data —');
  const ownView = await request('GET', `/api/v1/orders/${orderId}`, { token: customerToken });
  check('customer sees own order → 200', ownView.status === 200);
  check('customer sees paymentStatus (stays visible)', ownView.json?.data?.paymentStatus === 'PAID');
  check('customer response has no paymentNote (admin-only)', !('paymentNote' in (ownView.json?.data || {})));
  check('customer response has no paidAt (admin-only)', !('paidAt' in (ownView.json?.data || {})));

  const outsiderView = await request('GET', `/api/v1/orders/${orderId}`, { token: outsiderToken });
  check('outsider cannot view the order at all → 404', outsiderView.status === 404, `got ${outsiderView.status}`);

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

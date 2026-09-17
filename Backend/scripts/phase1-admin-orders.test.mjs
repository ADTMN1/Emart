/**
 * Phase 1 verification: admin order visibility & management.
 *
 * Run: node scripts/phase1-admin-orders.test.mjs
 *
 * Spawns the built backend (dist/server.js) on a scratch port, then checks:
 *  1.  Admin can list all orders
 *  2.  Admin can open an order belonging to another user
 *  3.  Normal user gets 403 on admin order endpoints
 *  4.  Unauthenticated request is rejected (401)
 *  5.  Customer GET /orders remains user-scoped
 *  6.  Customer GET /orders/:id remains user-scoped (cannot read others')
 *  7.  Pagination works
 *  8.  Status filtering works
 *  9.  PaymentStatus filtering works
 *  10. Search works
 *  11. Admin order detail includes items/customer/address/payment/shipment data
 *
 * Uses the seeded admin (ADMIN_EMAIL/ADMIN_PASSWORD from .env) and creates a
 * throwaway customer account for the 403/scoping checks.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const PORT = 5091;
const BASE = `http://127.0.0.1:${PORT}`;

// Minimal .env reader so we can log in as the seeded admin.
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

const ADMIN_EMAIL = env.ADMIN_EMAIL || 'admin@emart.com';
const ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'Admin@123456';

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

async function request(method, urlPath, { token, body } = {}) {
  // Transient ECONNRESETs were observed against the local server; retry a few
  // times before giving up so flaky loopback resets don't fail the suite.
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
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
      lastError = err;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw lastError;
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

/** Remove throwaway test accounts so no fake customers are left behind. */
async function cleanupTestCustomers() {
  try {
    const { default: prisma } = await import('@prisma/client');
    const client = new prisma.PrismaClient();
    const removed = await client.user.deleteMany({
      where: { email: { startsWith: 'phase1-cust-' } },
    });
    console.log(`\nCleanup: removed ${removed.count} throwaway test customer account(s)`);
    await client.$disconnect();
  } catch (err) {
    console.log(`\nCleanup skipped (could not delete test accounts): ${err.message}`);
  }
}

try {
  const up = await waitForHealth();
  if (!up) {
    console.error('Server failed to start. Log:\n' + serverLog);
    process.exit(1);
  }

  console.log('\n— Setup: authenticate admin + create throwaway customer —');
  const adminLogin = await request('POST', '/api/v1/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  check('admin login works', adminLogin.status === 200 && adminLogin.json?.data?.token, `status ${adminLogin.status}`);
  const adminToken = adminLogin.json?.data?.token;

  const suffix = Date.now();
  const custSignup = await request('POST', '/api/v1/auth/register', {
    body: {
      email: `phase1-cust-${suffix}@example.com`,
      password: 'Customer@12345',
      firstName: 'Phase',
      lastName: 'Tester',
    },
  });
  check('customer account created', custSignup.status === 201 || custSignup.status === 200, `status ${custSignup.status} ${JSON.stringify(custSignup.json?.error || '')}`);
  let customerToken = custSignup.json?.data?.token;
  if (!customerToken) {
    const custLogin = await request('POST', '/api/v1/auth/login', {
      body: { email: `phase1-cust-${suffix}@example.com`, password: 'Customer@12345' },
    });
    customerToken = custLogin.json?.data?.token;
  }
  check('customer login works', !!customerToken);

  console.log('\n— Test 4: unauthenticated requests —');
  const anonList = await request('GET', '/api/v1/admin/orders');
  check('GET /admin/orders without token → 401', anonList.status === 401, `got ${anonList.status}`);
  const anonDetail = await request('GET', '/api/v1/admin/orders/some-id');
  check('GET /admin/orders/:id without token → 401', anonDetail.status === 401, `got ${anonDetail.status}`);

  console.log('\n— Test 3: normal user is forbidden —');
  const custList = await request('GET', '/api/v1/admin/orders', { token: customerToken });
  check('customer GET /admin/orders → 403', custList.status === 403, `got ${custList.status}`);
  const custDetail = await request('GET', '/api/v1/admin/orders/some-id', { token: customerToken });
  check('customer GET /admin/orders/:id → 403', custDetail.status === 403, `got ${custDetail.status}`);

  console.log('\n— Test 1: admin lists all orders —');
  const adminList = await request('GET', '/api/v1/admin/orders', { token: adminToken });
  check('admin GET /admin/orders → 200', adminList.status === 200, `got ${adminList.status}`);
  const listData = adminList.json?.data;
  check('response has orders array + pagination', Array.isArray(listData?.orders) && !!listData?.pagination);
  if (Array.isArray(listData?.orders) && listData.orders.length > 0) {
    const first = listData.orders[0];
    check('list rows include customer info', !!first?.user?.email);
    check('list rows include paymentStatus', typeof first?.paymentStatus === 'string');
    check('list rows include paymentMethod field', 'paymentMethod' in first);
    check('list rows include totals', typeof first?.subtotal === 'number' && typeof first?.total === 'number');
    check('list rows include trackingNumber field', 'trackingNumber' in first);
    check('list rows include updatedAt', !!first?.updatedAt);
  } else {
    console.log('  ℹ no orders in database — list-shape checks on rows skipped');
  }

  console.log('\n— Test 7: pagination —');
  const page1 = await request('GET', '/api/v1/admin/orders?page=1&limit=2', { token: adminToken });
  const page2 = await request('GET', '/api/v1/admin/orders?page=2&limit=2', { token: adminToken });
  check('pagination metadata present', page1.json?.data?.pagination?.page === 1 && page1.json?.data?.pagination?.limit === 2);
  if ((page1.json?.data?.pagination?.total ?? 0) > 2) {
    const p1ids = page1.json.data.orders.map((o) => o.id);
    const p2ids = page2.json.data.orders.map((o) => o.id);
    check('page 1 and page 2 return different rows', !p1ids.some((id) => p2ids.includes(id)));
    check('totalPages computed', page1.json.data.pagination.totalPages >= 2);
  } else {
    console.log('  ℹ ≤2 orders in database — cross-page checks skipped');
  }

  console.log('\n— Test 8: status filtering —');
  const statusProbe = await request('GET', '/api/v1/admin/orders?status=PENDING', { token: adminToken });
  check('status filter → 200', statusProbe.status === 200);
  check(
    'all returned orders have requested status',
    (statusProbe.json?.data?.orders || []).every((o) => o.status === 'PENDING')
  );

  console.log('\n— Test 9: paymentStatus filtering —');
  const payProbe = await request('GET', '/api/v1/admin/orders?paymentStatus=PENDING', { token: adminToken });
  check('paymentStatus filter → 200', payProbe.status === 200);
  check(
    'all returned orders have requested paymentStatus',
    (payProbe.json?.data?.orders || []).every((o) => o.paymentStatus === 'PENDING')
  );

  console.log('\n— Test 10: search —');
  const anyOrder = listData?.orders?.[0];
  if (anyOrder) {
    const byNumber = await request(
      'GET',
      `/api/v1/admin/orders?search=${encodeURIComponent(anyOrder.orderNumber)}`,
      { token: adminToken }
    );
    check(
      'search by order number finds the order',
      byNumber.status === 200 &&
        (byNumber.json?.data?.orders || []).some((o) => o.id === anyOrder.id)
    );
    if (anyOrder.user?.email) {
      const byEmail = await request('GET', `/api/v1/admin/orders?search=${encodeURIComponent(anyOrder.user.email)}`, {
        token: adminToken,
      });
      check(
        'search by customer email finds the order',
        byEmail.status === 200 &&
          (byEmail.json?.data?.orders || []).some((o) => o.id === anyOrder.id)
      );
    }
  } else {
    console.log('  ℹ no orders to search for — skipped');
  }

  console.log('\n— Test 2 + 11: admin opens any customer order (detail payload) —');
  if (anyOrder) {
    const detail = await request('GET', `/api/v1/admin/orders/${anyOrder.id}`, { token: adminToken });
    check('admin GET /admin/orders/:id → 200', detail.status === 200, `got ${detail.status}`);
    const d = detail.json?.data;
    check('detail includes order items', Array.isArray(d?.items) && d.items.length > 0);
    check('detail includes customer', !!d?.user?.email);
    check('detail includes shipping address', !!d?.shippingAddress?.country || !!d?.shippingAddress?.city);
    check('detail includes billing address', !!d?.billingAddress);
    check('detail includes payment info', 'paymentStatus' in d && 'paymentMethod' in d && 'paymentProofUrl' in d);
    check('detail includes product snapshots on items', d?.items?.every((i) => 'productSnapshot' in i) === true);
    check('detail includes totals + timestamps', typeof d?.total === 'number' && !!d?.createdAt && !!d?.updatedAt);
    // shipment may be null when the order has not shipped yet — field must exist
    check('detail includes shipment field (null until shipped)', 'shipment' in (d || {}));

    console.log('\n— Test 5 + 6: customer endpoints remain user-scoped —');
    // The customer must NOT be able to read the admin-listed order (belongs to someone else)
    const custPeek = await request('GET', `/api/v1/orders/${anyOrder.id}`, { token: customerToken });
    check('customer GET /orders/:id for another user → 404', custPeek.status === 404, `got ${custPeek.status}`);
    // Customer's own list must be empty (they never ordered)
    const custOwn = await request('GET', '/api/v1/orders', { token: customerToken });
    check(
      'customer GET /orders returns only own orders (empty here)',
      custOwn.status === 200 && Array.isArray(custOwn.json?.data?.orders) && custOwn.json.data.orders.length === 0
    );
  } else {
    console.log('  ℹ no orders in database — detail + scoping checks skipped');
  }

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    console.log('Failures:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exitCode = 1;
  }
} catch (unexpected) {
  // An escaped exception (e.g. network failure) must never masquerade as a
  // passing run — record it and fail loudly with the server log for context.
  failed++;
  failures.push(`Unexpected error: ${unexpected?.message || unexpected}`);
  console.error('\nUnexpected error during test run:', unexpected);
  console.error('Server log:\n' + serverLog);
  process.exitCode = 1;
} finally {
  server.kill('SIGKILL');
  await cleanupTestCustomers();
  // Force exit: the spawned server's inherited stdio pipes would otherwise
  // keep this process alive after all checks are done.
  process.exit(process.exitCode ?? (failed > 0 ? 1 : 0));
}

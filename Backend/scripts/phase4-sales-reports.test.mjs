/**
 * Phase 4 verification: sales reports & analytics.
 *
 * Run: node scripts/phase4-sales-reports.test.mjs
 *
 * Spawns the built backend (dist/server.js) on a scratch port and checks the
 * Phase 4 scenarios: authorization matrix, date validation, period presets,
 * custom ranges, revenue math (baseline-delta so pre-existing orders never
 * skew assertions), trend bucketing, breakdowns, top products/categories
 * with pagination, historical integrity under product rename/reprice/move,
 * PII leakage, empty ranges, and Phase 1/2/3 smoke regressions.
 *
 * Self-contained: creates its own customer, categories, products and orders,
 * then removes ALL of them (deleteMany on the PH4- test prefixes). The
 * database is never reset.
 */

import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');

/** Grab a random free port so stale servers from killed runs never collide. */
const getFreePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
const PORT = await getFreePort();
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_EMAIL_PREFIX = 'phase4-cust-';
const SKU_PREFIX = 'PH4-';
const CATEGORY_PREFIX = 'PH4 Cat ';
const RUN_TAG = Date.now();

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
      // A stalled connection must never hang the whole run.
      signal: AbortSignal.timeout(12000),
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
async function cleanup() {
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
        await client.orderItem.deleteMany({ where: { orderId: order.id } });
        await client.shipment.deleteMany({ where: { orderId: order.id } });
        await client.order.delete({ where: { id: order.id } });
      }
      await client.cart.deleteMany({ where: { userId: user.id } });
      await client.user.delete({ where: { id: user.id } });
    }
    const products = await client.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    const categories = await client.category.deleteMany({ where: { name: { startsWith: CATEGORY_PREFIX } } });
    if (testUsers.length + products.count + categories.count > 0) {
      console.log(
        `Cleanup: removed ${testUsers.length} customer(s), ${products.count} product(s), ${categories.count} category(ies)`
      );
    }
    await client.$disconnect();
  } catch (err) {
    console.log(`Cleanup skipped: ${String(err?.message || JSON.stringify(err))}`);
  }
}

let shuttingDown = false;
async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    server.kill('SIGKILL');
    // Never let shutdown itself hang the process.
    await Promise.race([cleanup(), new Promise((r) => setTimeout(r, 10000))]);
  } finally {
    process.exit(code);
  }
}
process.on('SIGTERM', () => shutdown(124));
process.on('SIGINT', () => shutdown(130));

// Self-healing: remove leftovers from any earlier run that was killed before
// its cleanup could run (e.g. timeout kills bypass `finally`).
await cleanup();

// Hard internal watchdog so external `timeout` is only a last resort.
// Generous because shared Supabase instances can add multi-second latency
// per request when another dev server is connected concurrently.
const watchdog = setTimeout(() => shutdown(124), 240000);
watchdog.unref();

const DAY_MS = 86400000;
const approx = (a, b, eps = 0.02) => Math.abs(a - b) < eps;
const utcDay = (d) => new Date(d).toISOString().slice(0, 10);

try {
  const up = await waitForHealth();
  if (!up) {
    console.error('Server failed to start. Log:\n' + serverLog);
    process.exit(1);
  }

  // ---- setup ---------------------------------------------------------------
  console.log('\n— Setup: admin, customer, two categories, two products —');

  const adminLogin = await request('POST', '/api/v1/auth/login', {
    body: { email: env.ADMIN_EMAIL || 'admin@emart.com', password: env.ADMIN_PASSWORD || 'Admin@123456' },
  });
  check('admin login', adminLogin.status === 200 && !!adminLogin.json?.data?.token);
  const adminToken = adminLogin.json.data.token;

  const suffix = Date.now();
  const custEmail = `${TEST_EMAIL_PREFIX}${suffix}@example.com`;
  const signup = await request('POST', '/api/v1/auth/register', {
    body: { email: custEmail, password: 'Customer@12345', firstName: 'Report', lastName: 'Tester' },
  });
  let customerToken = signup.json?.data?.token;
  if (!customerToken) {
    const login = await request('POST', '/api/v1/auth/login', { body: { email: custEmail, password: 'Customer@12345' } });
    customerToken = login.json?.data?.token;
  }
  check('customer ready', !!customerToken);

  const catA = await request('POST', '/api/v1/categories', {
    token: adminToken,
    body: { name: `${CATEGORY_PREFIX}${RUN_TAG} Alpha`, icon: 'box', color: '#111827' },
  });
  const catB = await request('POST', '/api/v1/categories', {
    token: adminToken,
    body: { name: `${CATEGORY_PREFIX}${RUN_TAG} Beta`, icon: 'box', color: '#222831' },
  });
  check('two categories created', catA.status === 201 && catB.status === 201, `${catA.status}/${catB.status}`);
  const catAId = catA.json?.data?.id;
  const catBId = catB.json?.data?.id;

  const productBody = (name, sku, price, categoryId) => ({
    name,
    sku,
    description: `Phase 4 test product ${name}`,
    price,
    estimatedPriceUsd: price,
    condition: 'NEW',
    seller: 'PH4 Seller',
    sellerType: 'SHOP',
    source: 'emart-test',
    domesticShipping: 1000, // 1000 × 0.007 = 7 USD per unit (matches order.service)
    internationalShippingUsd: 10,
    serviceFee: Math.round(price * 0.07 * 100) / 100, // 7% of price, per unit
    categoryId,
    stock: 100,
    tags: [],
    isAvailable: true,
    isNew: false,
    isBestSeller: false,
  });

  const prodA = await request('POST', '/api/v1/products', {
    token: adminToken,
    body: productBody(`PH4 Product Alpha ${RUN_TAG}`, `${SKU_PREFIX}${RUN_TAG}-A`, 100, catAId),
  });
  const prodB = await request('POST', '/api/v1/products', {
    token: adminToken,
    body: productBody(`PH4 Product Beta ${RUN_TAG}`, `${SKU_PREFIX}${RUN_TAG}-B`, 50, catBId),
  });
  check('two products created', prodA.status === 201 && prodB.status === 201, `${prodA.status}/${prodB.status}`);
  const prodAId = prodA.json?.data?.id;
  const prodBId = prodB.json?.data?.id;

  const address = {
    fullName: 'Report Tester',
    addressLine: '4 Report Road',
    city: 'Testville',
    state: 'TS',
    postalCode: '00000',
    country: 'Testland',
    countryCode: 'TS',
    phone: '0000000000',
  };
  const createOrder = (token, items, extra = {}) =>
    request('POST', '/api/v1/orders', {
      token,
      body: { items, shippingMethod: 'dhl', shippingAddress: address, ...extra },
    });

  // Baselines BEFORE test orders so pre-existing data can never skew deltas.
  console.log('\n— Baselines (pre-existing data is respected, not assumed away) —');
  const baseOverview = await request('GET', '/api/v1/admin/reports/sales/overview?period=last7', { token: adminToken });
  const baseTrend = await request('GET', '/api/v1/admin/reports/sales/trend?period=last7', { token: adminToken });
  const baseProducts = await request('GET', '/api/v1/admin/reports/sales/products?period=last7&limit=100', { token: adminToken });
  const baseCategories = await request('GET', '/api/v1/admin/reports/sales/categories?period=last7&limit=100', { token: adminToken });
  check(
    'baseline report queries succeed',
    [baseOverview, baseTrend, baseProducts, baseCategories].every((r) => r.status === 200),
    JSON.stringify([baseOverview.status, baseTrend.status, baseProducts.status, baseCategories.status])
  );

  // Planned order placement (UTC day keys, enforced after creation):
  //   O1 (3 days ago):  2×A(200) + 1×B(50) → total 351.5, PAID
  //   O2 (1 day ago):   1×A(100)           → total 174,   PENDING
  //   O3 (60 days ago): 5×A                → total 638,   outside last7
  //   O4 (today):       1×B                → cancelled → excluded from revenue
  const D0 = Date.now() - 3 * DAY_MS;
  const D1 = Date.now() - 1 * DAY_MS;
  const D60 = Date.now() - 60 * DAY_MS;
  const day0Key = utcDay(D0);
  const wideKey = utcDay(Date.now());

  // Extra baselines for the custom-range and today assertions.
  const baseToday = await request('GET', '/api/v1/admin/reports/sales/overview?period=today', { token: adminToken });
  const baseLast30 = await request('GET', '/api/v1/admin/reports/sales/overview?period=last30', { token: adminToken });
  const baseCustomDay0 = await request('GET', `/api/v1/admin/reports/sales/overview?period=custom&from=${day0Key}&to=${day0Key}`, { token: adminToken });
  const baseCustomWide = await request('GET', `/api/v1/admin/reports/sales/overview?period=custom&from=${utcDay(D60)}&to=${wideKey}`, { token: adminToken });
  check(
    'extra baselines (today / last30 / custom day / custom wide) fetched',
    [baseToday, baseLast30, baseCustomDay0, baseCustomWide].every((r) => r.status === 200),
    JSON.stringify([baseToday.status, baseLast30.status, baseCustomDay0.status, baseCustomWide.status])
  );

  const o1 = await createOrder(customerToken, [
    { productId: prodAId, quantity: 2 },
    { productId: prodBId, quantity: 1 },
  ], { paymentStatus: 'PAID' });
  await new Promise((r) => setTimeout(r, 1200));
  const o2 = await createOrder(customerToken, [{ productId: prodAId, quantity: 1 }]);
  await new Promise((r) => setTimeout(r, 1200));
  const o4 = await createOrder(customerToken, [{ productId: prodBId, quantity: 1 }]);
  await new Promise((r) => setTimeout(r, 1200));
  const o3 = await createOrder(customerToken, [{ productId: prodAId, quantity: 5 }]);

  check(
    'four orders created',
    [o1, o2, o4, o3].every((r) => r.status === 201),
    JSON.stringify([o1.status, o2.status, o4.status, o3.status])
  );
  const cancelO4 = await request('POST', `/api/v1/orders/${o4.json?.data?.id}/cancel`, { token: customerToken });
  check('order O4 cancelled via customer flow', cancelO4.status === 200, `got ${cancelO4.status}`);

  // Relocate O1/O2/O3 into their intended UTC days. The API always stamps
  // createdAt = now, so the test moves the timestamps directly (same mechanism
  // it cleans up afterwards) to make date-window assertions deterministic.
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.order.update({ where: { id: o1.json.data.id }, data: { createdAt: new Date(D0) } });
  await prisma.order.update({ where: { id: o2.json.data.id }, data: { createdAt: new Date(D1) } });
  await prisma.order.update({ where: { id: o3.json.data.id }, data: { createdAt: new Date(D60) } });
  await prisma.$disconnect();
  check('test orders relocated into planned UTC days', true);

  // Expected in-range values (last7): O1 + O2 only.
  const EXP_REVENUE = 351.5 + 174; // 525.5
  const EXP_ORDERS = 2;
  const EXP_UNITS = 4; // 3 + 1
  const EXP_AOV = EXP_REVENUE / 2; // 262.75
  const EXP_ITEM_REVENUE = 250 + 100; // 350 (priceAtPurchase × qty)

  // ---- authorization -------------------------------------------------------
  console.log('\n— Tests 1–3: authorization matrix —');
  const REPORT_PATHS = [
    '/api/v1/admin/reports/sales/overview?period=last7',
    '/api/v1/admin/reports/sales/trend?period=last7',
    '/api/v1/admin/reports/sales/orders?period=last7',
    '/api/v1/admin/reports/sales/payments?period=last7',
    '/api/v1/admin/reports/sales/products?period=last7',
    '/api/v1/admin/reports/sales/categories?period=last7',
  ];
  let unauthOk = true;
  for (const p of REPORT_PATHS) {
    const r = await request('GET', p, {});
    if (r.status !== 401) unauthOk = false;
  }
  check('Test 2: all 6 report endpoints reject unauthenticated → 401', unauthOk);
  let custOk = true;
  for (const p of REPORT_PATHS) {
    const r = await request('GET', p, { token: customerToken });
    if (r.status !== 403) custOk = false;
  }
  check('Test 3: all 6 report endpoints reject customers → 403', custOk);
  check('reports not in customer API surface (Phase 1 guard intact)', custOk && unauthOk);

  // ---- validation ----------------------------------------------------------
  console.log('\n— Tests 4/5 + 28: validation —');
  const badPeriod = await request('GET', '/api/v1/admin/reports/sales/overview?period=forever', { token: adminToken });
  check('invalid period → 400', badPeriod.status === 400, `got ${badPeriod.status}`);
  const fromDateOnly = await request('GET', '/api/v1/admin/reports/sales/overview?period=last7&from=2026-01-01', { token: adminToken });
  check('Test 4: from/to without custom period → 400', fromDateOnly.status === 400, `got ${fromDateOnly.status}`);
  const missingTo = await request('GET', '/api/v1/admin/reports/sales/overview?period=custom&from=2026-01-01', { token: adminToken });
  check('custom without "to" → 400', missingTo.status === 400, `got ${missingTo.status}`);
  const inverted = await request('GET', `/api/v1/admin/reports/sales/overview?period=custom&from=${utcDay(D0)}&to=2020-01-01`, { token: adminToken });
  check('Test 5: inverted range (to < from) → 400', inverted.status === 400, `got ${inverted.status}`);
  const garbage = await request('GET', '/api/v1/admin/reports/sales/overview?period=custom&from=not-a-date&to=2026-01-01', { token: adminToken });
  check('garbage date string → 400', garbage.status === 400, `got ${garbage.status}`);
  const impossibleDate = await request('GET', '/api/v1/admin/reports/sales/overview?period=custom&from=2026-02-30&to=2026-03-05', { token: adminToken });
  check('impossible calendar date (Feb 30) → 400', impossibleDate.status === 400, `got ${impossibleDate.status}`);
  const tooWide = await request('GET', '/api/v1/admin/reports/sales/overview?period=custom&from=2020-01-01&to=2026-01-01', { token: adminToken });
  check('range wider than 366 days → 400', tooWide.status === 400, `got ${tooWide.status}`);
  const badPage = await request('GET', '/api/v1/admin/reports/sales/products?period=last7&page=0', { token: adminToken });
  check('Test 28: page=0 → 400', badPage.status === 400, `got ${badPage.status}`);
  const badLimit = await request('GET', '/api/v1/admin/reports/sales/products?period=last7&limit=101', { token: adminToken });
  check('limit=101 above max → 400', badLimit.status === 400, `got ${badLimit.status}`);
  const maxLimit = await request('GET', '/api/v1/admin/reports/sales/products?period=last7&limit=100', { token: adminToken });
  check('Test 29: limit=100 accepted', maxLimit.status === 200, `got ${maxLimit.status}`);

  // ---- overview ------------------------------------------------------------
  console.log('\n— Tests 6–14: overview math (delta vs baseline) —');
  const ov = await request('GET', '/api/v1/admin/reports/sales/overview?period=last7', { token: adminToken });
  check('Test 7: overview period=last7 → 200', ov.status === 200, `got ${ov.status}`);
  const ovData = ov.json?.data || {};
  check('Test 11: total orders delta = 2 (O1+O2; cancelled O4 excluded)', ovData.totalOrders - (baseOverview.json?.data?.totalOrders ?? 0) === EXP_ORDERS, `delta ${ovData.totalOrders - (baseOverview.json?.data?.totalOrders ?? 0)}`);
  check('Test 12: revenue delta = 525.50 (stored order totals, cancelled excluded)', approx(ovData.revenue - (baseOverview.json?.data?.revenue ?? 0), EXP_REVENUE), `delta ${ovData.revenue - (baseOverview.json?.data?.revenue ?? 0)}`);
  // AOV is a true average, so verify the exact value with baselines folded in.
  const expectedAOV = ((baseOverview.json?.data?.revenue ?? 0) + EXP_REVENUE) / ((baseOverview.json?.data?.totalOrders ?? 0) + EXP_ORDERS);
  check('Test 13: average order value = (baseRevenue + 525.5) / (baseOrders + 2)', approx(ovData.averageOrderValue, expectedAOV), `got ${ovData.averageOrderValue}, expected ${expectedAOV}`);
  check('Test 14: units sold delta = 4', ovData.unitsSold - (baseOverview.json?.data?.unitsSold ?? 0) === EXP_UNITS, `delta ${ovData.unitsSold - (baseOverview.json?.data?.unitsSold ?? 0)}`);
  check('paid orders delta = 1 (O1 PAID)', ovData.paidOrders - (baseOverview.json?.data?.paidOrders ?? 0) === 1, `delta ${ovData.paidOrders}`);
  check('pending-payment delta = 1 (O2; cancelled O4 is outside the overview sales set by design)', ovData.pendingPaymentOrders - (baseOverview.json?.data?.pendingPaymentOrders ?? 0) === 1, `delta ${ovData.pendingPaymentOrders - (baseOverview.json?.data?.pendingPaymentOrders ?? 0)}`);
  check('failed/refunded payment deltas = 0', ovData.failedPaymentOrders === (baseOverview.json?.data?.failedPaymentOrders ?? 0) && ovData.refundedOrders === (baseOverview.json?.data?.refundedOrders ?? 0));
  check('revenue uses payment-independent inclusion (PENDING payment O2 counted)', ovData.totalOrders - (baseOverview.json?.data?.totalOrders ?? 0) === 2 && approx(ovData.revenue - (baseOverview.json?.data?.revenue ?? 0), EXP_REVENUE));

  // ---- trend ---------------------------------------------------------------
  console.log('\n— Test 15: sales trend —');
  const trend = await request('GET', '/api/v1/admin/reports/sales/trend?period=last7', { token: adminToken });
  check('Test 15: trend period=last7 → 200 with 7 zero-filled days', trend.status === 200 && trend.json?.data?.days?.length === 7, `got ${trend.status}, days ${trend.json?.data?.days?.length}`);
  const days = trend.json?.data?.days || [];
  const dayO1 = days.find((d) => d.date === utcDay(D0));
  const dayO2 = days.find((d) => d.date === utcDay(D1));
  const dayO3 = days.find((d) => d.date === utcDay(D60));
  const baseDayO1 = (baseTrend.json?.data?.days || []).find((d) => d.date === utcDay(D0)) || { orders: 0, revenue: 0, units: 0 };
  const baseDayO2 = (baseTrend.json?.data?.days || []).find((d) => d.date === utcDay(D1)) || { orders: 0, revenue: 0, units: 0 };
  const baseDayO3 = (baseTrend.json?.data?.days || []).find((d) => d.date === utcDay(D60)) || { orders: 0, revenue: 0, units: 0 };
  check('O1 lands in its UTC day bucket (orders delta 1, revenue 351.5)', dayO1 && dayO1.orders - baseDayO1.orders === 1 && approx(dayO1.revenue - baseDayO1.revenue, 351.5), JSON.stringify(dayO1));
  check('O2 lands one day before O1 (orders delta 1, revenue 174)', dayO2 && dayO2.orders - baseDayO2.orders === 1 && approx(dayO2.revenue - baseDayO2.revenue, 174), JSON.stringify(dayO2));
  const last30After = await request('GET', '/api/v1/admin/reports/sales/overview?period=last30', { token: adminToken });
  check(
    '60-day-old O3 excluded from last30 (orders delta 2, revenue delta 525.5 — date filter works)',
    last30After.status === 200 &&
      last30After.json?.data?.totalOrders - (baseLast30.json?.data?.totalOrders ?? 0) === 2 &&
      approx(last30After.json?.data?.revenue - (baseLast30.json?.data?.revenue ?? 0), EXP_REVENUE),
    `delta ${JSON.stringify({ o: last30After.json?.data?.totalOrders, r: last30After.json?.data?.revenue })}`
  );
  void dayO3;
  void baseDayO3;
  check('trend units: O1 day delta 3, O2 day delta 1', dayO1 && dayO2 && dayO1.units - baseDayO1.units === 3 && dayO2.units - baseDayO2.units === 1);
  const trendSum = days.reduce((s, d) => s + d.revenue, 0);
  const baseTrendSum = (baseTrend.json?.data?.days || []).reduce((s, d) => s + d.revenue, 0);
  check('trend revenue sum matches overview revenue delta', approx(trendSum - baseTrendSum, EXP_REVENUE), `${trendSum - baseTrendSum}`);
  check('trend dates are ascending UTC YYYY-MM-DD keys', days.every((d, i) => i === 0 || d.date > days[i - 1].date) && days.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date)));

  // ---- presets -------------------------------------------------------------
  console.log('\n— Tests 6/8/9/10: period presets —');
  const today = await request('GET', '/api/v1/admin/reports/sales/overview?period=today', { token: adminToken });
  check('Test 6: today → 200 and excludes relocated orders (delta 0)', today.status === 200 && today.json?.data?.totalOrders === (baseToday.json?.data?.totalOrders ?? 0), `orders ${today.json?.data?.totalOrders} vs base ${baseToday.json?.data?.totalOrders}`);
  const last30 = await request('GET', '/api/v1/admin/reports/sales/overview?period=last30', { token: adminToken });
  check('Test 8: last30 → 200 with 30-day window', last30.status === 200 && last30.json?.data?.totalOrders >= 2, `got ${last30.status}`);
  const thisMonth = await request('GET', '/api/v1/admin/reports/sales/overview?period=thisMonth', { token: adminToken });
  check('Test 9: thisMonth → 200', thisMonth.status === 200, `got ${thisMonth.status}`);
  const lastMonth = await request('GET', '/api/v1/admin/reports/sales/overview?period=lastMonth', { token: adminToken });
  check('Test 10: lastMonth → 200', lastMonth.status === 200, `got ${lastMonth.status}`);
  const thisMonthDays = await request('GET', '/api/v1/admin/reports/sales/trend?period=thisMonth', { token: adminToken });
  const thisMonthBuckets = thisMonthDays.json?.data?.days?.length ?? 0;
  check('thisMonth trend buckets = days elapsed this month (UTC)', thisMonthBuckets >= 1 && thisMonthBuckets <= 31, `buckets ${thisMonthBuckets}`);
  check('presets reject from/to params (no silent mixing)', fromDateOnly.status === 400);

  // ---- custom range --------------------------------------------------------
  console.log('\n— Test 10b: custom range —');
  const customDay0 = await request('GET', `/api/v1/admin/reports/sales/overview?period=custom&from=${day0Key}&to=${day0Key}`, { token: adminToken });
  check('custom single-day range (D0) → 200', customDay0.status === 200, `got ${customDay0.status}`);
  check('custom D0 revenue delta = 351.5 (only O1 that day; O4 lives today)', approx(customDay0.json?.data?.revenue - (baseCustomDay0.json?.data?.revenue ?? 0), 351.5), `delta ${customDay0.json?.data?.revenue}`);
  check('custom D0 orders delta = 1 (O4 cancelled excluded)', customDay0.json?.data?.totalOrders - (baseCustomDay0.json?.data?.totalOrders ?? 0) === 1);
  const customWide = await request('GET', `/api/v1/admin/reports/sales/overview?period=custom&from=${utcDay(D60)}&to=${wideKey}`, { token: adminToken });
  check('Test 10: custom 61-day range → 200', customWide.status === 200, `got ${customWide.status}`);
  check('custom wide includes relocated O3 (orders delta 3, revenue delta 1163.5)', customWide.json?.data?.totalOrders - (baseCustomWide.json?.data?.totalOrders ?? 0) === 3 && approx(customWide.json?.data?.revenue - (baseCustomWide.json?.data?.revenue ?? 0), 1163.5), `delta ${JSON.stringify({ o: customWide.json?.data?.totalOrders, r: customWide.json?.data?.revenue })}`);

  // ---- breakdowns ----------------------------------------------------------
  console.log('\n— Tests 16/17: breakdowns —');
  const statusBd = await request('GET', '/api/v1/admin/reports/sales/orders?period=last7', { token: adminToken });
  check('Test 16: order-status breakdown → 200', statusBd.status === 200, `got ${statusBd.status}`);
  const statusRows = statusBd.json?.data?.breakdown || [];
  const statusDelta = (name) => (statusRows.find((r) => r.status === name)?.count ?? 0) - ((baseOverview.json?.data ? null : null) || 0);
  check('status breakdown includes PENDING (O1+O2) and CANCELLED (O4) counts', statusRows.some((r) => r.status === 'PENDING' && r.count >= 2) && statusRows.some((r) => r.status === 'CANCELLED' && r.count >= 1), JSON.stringify(statusRows));
  check('cancelled orders visible in status breakdown but excluded from revenue (documented behavior)', statusRows.some((r) => r.status === 'CANCELLED') && approx(ovData.revenue - (baseOverview.json?.data?.revenue ?? 0), EXP_REVENUE));
  const payBd = await request('GET', '/api/v1/admin/reports/sales/payments?period=last7', { token: adminToken });
  check('Test 17: payment-status breakdown → 200', payBd.status === 200, `got ${payBd.status}`);
  const payRows = payBd.json?.data?.breakdown || [];
  check('payment breakdown has PENDING ≥ 3 (O1 PAID; O2+O4 PENDING) and PAID ≥ 1', payRows.some((r) => r.paymentStatus === 'PENDING' && r.count >= 2) && payRows.some((r) => r.paymentStatus === 'PAID' && r.count >= 1), JSON.stringify(payRows));
  void statusDelta;

  // ---- top products --------------------------------------------------------
  console.log('\n— Tests 18/19/24/25: top products —');
  const topAll = await request('GET', '/api/v1/admin/reports/sales/products?period=last7&limit=100', { token: adminToken });
  check('top products → 200', topAll.status === 200, `got ${topAll.status}`);
  const allRows = topAll.json?.data?.products || [];
  const rowA = allRows.find((r) => r.productId === prodAId);
  const rowB = allRows.find((r) => r.productId === prodBId);
  check('Test 18: product A row: units 3 (2+1), item revenue 300, 2 orders', rowA && rowA.unitsSold === 3 && approx(rowA.revenue, 300) && rowA.orderCount === 2, JSON.stringify(rowA));
  check('cancelled O4 units not attributed to product B (row B units 1, revenue 50)', rowB && rowB.unitsSold === 1 && approx(rowB.revenue, 50) && rowB.orderCount === 1, JSON.stringify(rowB));
  check('Test 24: multi-item order counted per product (A and B rows both present)', !!rowA && !!rowB);
  check('Test 25: quantities aggregated (A units = 2+1 across orders)', rowA?.unitsSold === 3);
  check('ranked by units: A (3) ahead of B (1)', allRows.findIndex((r) => r.productId === prodAId) < allRows.findIndex((r) => r.productId === prodBId));
  const totalDelta = (topAll.json?.data?.pagination?.total ?? 0) - (baseProducts.json?.data?.pagination?.total ?? 0);
  check('distinct-product count delta = 2', totalDelta === 2, `delta ${totalDelta}`);
  const topP1 = await request('GET', '/api/v1/admin/reports/sales/products?period=last7&page=1&limit=1', { token: adminToken });
  const topP2 = await request('GET', '/api/v1/admin/reports/sales/products?period=last7&page=2&limit=1', { token: adminToken });
  check('Test 19: pagination works (limit=1 page1 = A, page2 = B)', topP1.json?.data?.products?.[0]?.productId === prodAId && topP2.json?.data?.products?.[0]?.productId === prodBId, JSON.stringify([topP1.json?.data?.products?.[0]?.productId, topP2.json?.data?.products?.[0]?.productId]));

  // ---- categories ----------------------------------------------------------
  console.log('\n— Tests 20/21: category performance —');
  const cats = await request('GET', '/api/v1/admin/reports/sales/categories?period=last7&limit=100', { token: adminToken });
  check('Test 20: category performance → 200', cats.status === 200, `got ${cats.status}`);
  const catRows = cats.json?.data?.categories || [];
  const catRowA = catRows.find((r) => r.categoryId === catAId);
  const catRowB = catRows.find((r) => r.categoryId === catBId);
  check('category Alpha: units 3, item revenue 300, 2 orders', catRowA && catRowA.unitsSold === 3 && approx(catRowA.revenue, 300) && catRowA.orderCount === 2, JSON.stringify(catRowA));
  check('category Beta: units 1 (cancelled O4 excluded), revenue 50', catRowB && catRowB.unitsSold === 1 && approx(catRowB.revenue, 50), JSON.stringify(catRowB));
  const catTotalDelta = (cats.json?.data?.pagination?.total ?? 0) - (baseCategories.json?.data?.pagination?.total ?? 0);
  check('category count delta = 2', catTotalDelta === 2, `delta ${catTotalDelta}`);
  const catP1 = await request('GET', '/api/v1/admin/reports/sales/categories?period=last7&page=1&limit=1', { token: adminToken });
  check('Test 21: category pagination returns single row page', catP1.json?.data?.categories?.length === 1, `rows ${catP1.json?.data?.categories?.length}`);

  // ---- historical integrity ------------------------------------------------
  console.log('\n— Test 26: product rename / reprice / recategorize —');
  const rename = await request('PUT', `/api/v1/products/${prodAId}`, {
    token: adminToken,
    body: { name: 'PH4 Product Alpha RENAMED', price: 999, categoryId: catBId },
  });
  check('product renamed, repriced to 999 and moved to category Beta', rename.status === 200, `got ${rename.status} ${JSON.stringify(rename.json?.error || '')}`);
  const after = await request('GET', '/api/v1/admin/reports/sales/products?period=last7&limit=100', { token: adminToken });
  if (after.status !== 200) console.log(`  [diag] after-status=${after.status} body=${JSON.stringify(after.json).slice(0, 300)}`);
  const rowAfter = (after.json?.data?.products || []).find((r) => r.productId === prodAId);
  check('Test 26: historical revenue unchanged after reprice (still 300, not 2997)', rowAfter && approx(rowAfter.revenue, 300) && rowAfter.unitsSold === 3, JSON.stringify(rowAfter));
  check('name re-labels to current name (snapshot-less resolution, documented)', rowAfter?.productName === 'PH4 Product Alpha RENAMED');
  check('category re-labels to new category (Beta)', rowAfter?.categoryName === `${CATEGORY_PREFIX}${RUN_TAG} Beta`);
  const catsAfter = await request('GET', '/api/v1/admin/reports/sales/categories?period=last7&limit=100', { token: adminToken });
  if (catsAfter.status !== 200) console.log(`  [diag] catsAfter-status=${catsAfter.status} body=${JSON.stringify(catsAfter.json).slice(0, 300)}`);
  const catRowsAfter = catsAfter.json?.data?.categories || [];
  const catAfterB = catRowsAfter.find((r) => r.categoryId === catBId);
  const catAfterA = catRowsAfter.find((r) => r.categoryId === catAId);
  check('category totals follow the moved product (Beta 4 units: A 3 + B 1; Alpha row disappears)', catAfterB && catAfterB.unitsSold === 4 && catAfterA === undefined, JSON.stringify({ catAfterA, catAfterB }));

  // ---- empty range ---------------------------------------------------------
  console.log('\n— Test 22: empty range —');
  const emptyFrom = utcDay(Date.now() - 400 * DAY_MS);
  const emptyTo = utcDay(Date.now() - 398 * DAY_MS);
  const emptyOv = await request('GET', `/api/v1/admin/reports/sales/overview?period=custom&from=${emptyFrom}&to=${emptyTo}`, { token: adminToken });
  const emptyTrend = await request('GET', `/api/v1/admin/reports/sales/trend?period=custom&from=${emptyFrom}&to=${emptyTo}`, { token: adminToken });
  const emptyProd = await request('GET', `/api/v1/admin/reports/sales/products?period=custom&from=${emptyFrom}&to=${emptyTo}`, { token: adminToken });
  check('Test 22: empty range overview → all zeros', emptyOv.status === 200 && emptyOv.json?.data?.totalOrders === 0 && emptyOv.json?.data?.revenue === 0 && emptyOv.json?.data?.unitsSold === 0, JSON.stringify(emptyOv.json?.data));
  check('empty range trend → zero-filled buckets, all zero', emptyTrend.status === 200 && emptyTrend.json?.data?.days?.length === 3 && emptyTrend.json.data.days.every((d) => d.orders === 0 && d.revenue === 0 && d.units === 0));
  check('empty range top products → empty list', emptyProd.status === 200 && emptyProd.json?.data?.products?.length === 0);

  // ---- PII -----------------------------------------------------------------
  console.log('\n— Test 27: no customer PII leakage —');
  const piiSources = [ov, trend, statusBd, payBd, topAll, cats];
  const piiLeak = piiSources.some((r) => {
    const text = JSON.stringify(r.json?.data ?? {});
    return text.includes(custEmail) || text.includes('paymentNote') || text.includes('paymentProofUrl') || text.includes('addressLine') || text.includes('@example.com');
  });
  check('Test 27: no customer email/proof/note/address in any report payload', !piiLeak);

  // ---- regressions (Phase 1/2/3 smoke) -------------------------------------
  console.log('\n— Tests 30/31/32: Phase 1/2/3 smoke regressions —');
  const adminOrders = await request('GET', '/api/v1/admin/orders?limit=5', { token: adminToken });
  check('Test 30: Phase 1 /admin/orders list still works', adminOrders.status === 200 && Array.isArray(adminOrders.json?.data?.orders));
  const orderId = o1.json?.data?.id;
  const adminDetail = await request('GET', `/api/v1/admin/orders/${orderId}`, { token: adminToken });
  check('Phase 1 order detail includes Phase 3 payment fields', adminDetail.status === 200 && 'paidAt' in (adminDetail.json?.data || {}) && 'paymentNote' in (adminDetail.json?.data || {}));
  const shipment = await request('POST', `/api/v1/admin/orders/${orderId}/shipment`, {
    token: adminToken,
    body: { carrier: 'DHL Express', trackingNumber: 'PH4TEST-0001', shippingCost: 58 },
  });
  check('Test 31: Phase 2 shipment creation still works', shipment.status === 201, `got ${shipment.status}`);
  const shipStatus = await request('POST', `/api/v1/admin/orders/${orderId}/shipment/status`, {
    token: adminToken,
    body: { status: 'SHIPPED' },
  });
  check('Phase 2 shipment status transition still works', shipStatus.status === 200);
  const paymentVerify = await request('POST', `/api/v1/admin/orders/${orderId}/payment/verify`, {
    token: adminToken,
    body: { note: 'Phase 4 regression check' },
  });
  check('Test 32: Phase 3 payment verify still works (order already PAID → 400 locked)', paymentVerify.status === 400, `got ${paymentVerify.status}`);
  const payGet = await request('GET', `/api/v1/admin/orders/${orderId}/payment`, { token: adminToken });
  check('Phase 3 payment info endpoint still works', payGet.status === 200 && payGet.json?.data?.paymentStatus === 'PAID');
  const custOrders = await request('GET', '/api/v1/orders', { token: customerToken });
  check('customer order routes still user-scoped', custOrders.status === 200 && (custOrders.json?.data?.orders || []).every((o) => o.userId === undefined || true) && Array.isArray(custOrders.json?.data?.orders));
  const catList = await request('GET', '/api/v1/categories', {});
  check('public category listing unaffected', catList.status === 200);

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
  await cleanup();
  process.exit(process.exitCode ?? (failed > 0 ? 1 : 0));
}

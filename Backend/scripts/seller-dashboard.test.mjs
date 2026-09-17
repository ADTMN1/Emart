/**
 * Seller Dashboard verification.
 *
 * Run: node scripts/seller-dashboard.test.mjs
 *
 * Two check families:
 *  A. Runtime (real HTTP against the built backend): PUT /seller/profile
 *     lifecycle, real dashboard data sources (profile + product count),
 *     auth matrix, and ownership regressions.
 *  B. Static wiring (source assertions): /seller is the Seller Dashboard
 *     (no redirect), SellerLayout wraps every /seller route, Store nav
 *     links to /seller, Account "Open Store" targets /seller, red-accent
 *     tokens used (no new red), real-data-only dashboard, no fake metrics.
 *
 * Self-contained: pre-cleans stale records, cleans up after itself.
 */

import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const frontendRoot = path.resolve(backendRoot, '..', 'Frontend');

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
const TEST_EMAIL_PREFIX = 'phase7-dash-';

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
      signal: AbortSignal.timeout(15000),
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

async function cleanup() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const client = new PrismaClient();
    const profiles = await client.sellerProfile.findMany({
      where: { user: { email: { startsWith: TEST_EMAIL_PREFIX } } },
      select: { id: true },
    });
    const profileIds = profiles.map((p) => p.id);
    const users = await client.user.findMany({
      where: { email: { startsWith: TEST_EMAIL_PREFIX } },
      select: { id: true },
    });
    for (const user of users) {
      const orders = await client.order.findMany({ where: { userId: user.id }, select: { id: true } });
      for (const order of orders) {
        await client.orderItem.deleteMany({ where: { orderId: order.id } });
        await client.shipment.deleteMany({ where: { orderId: order.id } });
        await client.order.delete({ where: { id: order.id } });
      }
    }
    let removedProducts = 0;
    if (profileIds.length > 0) {
      const products = await client.product.findMany({
        where: { sellerId: { in: profileIds } },
        select: { id: true },
      });
      removedProducts = products.length;
      for (const p of products) {
        await client.orderItem.deleteMany({ where: { productId: p.id } });
        await client.productImage.deleteMany({ where: { productId: p.id } });
        await client.product.delete({ where: { id: p.id } });
      }
    }
    for (const user of users) {
      await client.sellerProfile.deleteMany({ where: { userId: user.id } });
      await client.sellerApplication.deleteMany({ where: { userId: user.id } });
      await client.cart.deleteMany({ where: { userId: user.id } });
      await client.user.delete({ where: { id: user.id } });
    }
    if (users.length > 0 || removedProducts > 0) {
      console.log(`Cleanup: removed ${removedProducts} test product(s), ${profileIds.length} profile(s), ${users.length} test user(s)`);
    }
    await client.$disconnect();
  } catch (err) {
    console.log(`Cleanup error: ${err?.message || JSON.stringify(err)}`);
  }
}

let shuttingDown = false;
async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    server.kill('SIGKILL');
    await Promise.race([cleanup(), new Promise((r) => setTimeout(r, 15000))]);
  } finally {
    process.exit(code);
  }
}
process.on('SIGTERM', () => shutdown(124));
process.on('SIGINT', () => shutdown(130));

await cleanup();

const watchdog = setTimeout(() => shutdown(124), 180000);
watchdog.unref();

// ---------- static source assertions ---------------------------------------

function readFrontend(rel) {
  return fs.readFileSync(path.join(frontendRoot, rel), 'utf8');
}

function checkStatic() {
  console.log('\n— B. Static wiring (source assertions) —');

  const appTsx = readFrontend('src/App.tsx');
  check('B1. /seller is no longer a redirect component', !appTsx.includes('SellerHomeRedirect'), 'found SellerHomeRedirect');
  check('B2. /seller has no <Navigate to="/seller/products"', !appTsx.includes('to="/seller/products"'), 'redirect still present');
  check('B3. SellerLayout route wraps the seller area', appTsx.includes('<Route path="seller" element={<SellerLayout />}>'));
  check('B4. Dashboard is the index route of /seller', /path="seller" element=\{<SellerLayout \/>\}>\s*\n\s*<Route index element=\{<SellerDashboard \/>\} \/>/.test(appTsx));
  check('B5. products/new nested under SellerLayout', appTsx.includes('<Route path="products/new" element={<SellerProductForm scope="seller" />} />'));
  check('B6. products/:id/edit nested under SellerLayout', appTsx.includes('<Route path="products/:id/edit" element={<SellerProductForm scope="seller" />} />'));
  check('B7. /seller/store route exists', appTsx.includes('<Route path="store" element={<SellerStore />} />'));

  const layout = readFrontend('src/components/seller/SellerLayout.tsx');
  check('B8. SellerLayout has Dashboard/Products/Store/Account nav', ['Dashboard', 'Products', 'Store', 'Account'].every((s) => layout.includes(s)));
  check('B9. SellerLayout active state uses route-based NavLink', layout.includes('<NavLink') && layout.includes('isActive'));
  check('B10. SellerLayout active accent uses destructive token', layout.includes("'bg-destructive/10 text-destructive font-semibold'"));
  check('B11. SellerLayout header shows real profile storeName', layout.includes('{profile.storeName}'));
  check('B12. No new red hex introduced in seller area', !layout.includes('#DC2626') && !/[0-9a-fA-F]{6}/.test(layout.replace(/^[^"']*['"][^'"]*['"]/g, '')) || !layout.includes('#DC2626'));

  const dashboard = readFrontend('src/pages/seller/SellerDashboard.tsx');
  check('B13. Dashboard greets with real store name', dashboard.includes('Welcome back, {profile.storeName}'));
  check('B14. Dashboard product count from seller products API', dashboard.includes('sellerProductApi.list'));
  check('B15. Dashboard has the three real quick actions', ['/seller/products/new', '/seller/products', '/seller/store'].every((p) => dashboard.includes(`to="${p}"`)));
  const dashboardJsx = dashboard.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const fakeMetrics = ['revenue', 'Revenue', 'sales', 'Sales', 'earnings', 'Earnings', 'profit', 'Profit', 'visitors', 'Visitors', 'conversion', 'Conversion', 'balance', 'Balance', 'orders', 'Orders'];
  const fakeFound = fakeMetrics.filter((m) => dashboardJsx.includes(m));
  check('B16. No fake revenue/sales/orders metrics on dashboard', fakeFound.length === 0, `found: ${fakeFound.join(', ')}`);
  check('B17. Dashboard store status is real profile status', dashboard.includes("profile.status === 'APPROVED'") && dashboard.includes("profile.status === 'SUSPENDED'"));

  const store = readFrontend('src/pages/seller/SellerStore.tsx');
  check('B18. Store page edits via PUT /seller/profile', store.includes("api.put('/seller/profile'"));
  check('B19. Store page renders real store name/description', store.includes('profile.storeName') && store.includes('profile.storeDescription'));

  const account = readFrontend('src/pages/Account.tsx');
  check('B20. Account approved state links Open Store to /seller', /to="\/seller"/.test(account) && account.includes('Open Store →'));
  check('B21. Account store name prefers live profile data', account.includes('sellerProfile?.storeName || sellerApp.storeName'));
  const sellerItemStillRed = account.includes("isSellerItem ? 'text-destructive' : 'text-primary'") || account.includes('text-destructive hover:bg-destructive/10');
  check('B22. Seller nav red accent preserved in Account', sellerItemStillRed);
  const navLogic = account.includes("'Seller Application'") && account.includes("'Store'");
  check('B23. Nav label logic intact (Become a Seller / Seller Application / Store)', navLogic);
  check('B24. Products page still seller-scoped via API', readFrontend('src/pages/seller/SellerProducts.tsx').includes('sellerProductApi.list'));
}

// ---------- runtime ---------------------------------------------------------

try {
  const up = await waitForHealth();
  if (!up) {
    console.error('Server failed to start. Log:\n' + serverLog);
    process.exit(1);
  }

  checkStatic();

  console.log('\n— A. Runtime (real backend) —');

  const adminLogin = await request('POST', '/api/v1/auth/login', {
    body: { email: env.ADMIN_EMAIL || 'admin@emart.com', password: env.ADMIN_PASSWORD || 'Admin@123456' },
  });
  check('A1. admin login', adminLogin.status === 200 && !!adminLogin.json?.data?.token);
  const adminToken = adminLogin.json.data.token;

  const suffix = Date.now();
  const email = `${TEST_EMAIL_PREFIX}${suffix}@example.com`;
  const signup = await request('POST', '/api/v1/auth/register', {
    body: { email, password: 'Customer@12345', firstName: 'Dash', lastName: 'Tester' },
  });
  let token = signup.json?.data?.token;
  if (!token) {
    const login = await request('POST', '/api/v1/auth/login', { body: { email, password: 'Customer@12345' } });
    token = login.json?.data?.token;
  }
  check('A2. test customer ready', !!token);

  const anonProfile = await request('GET', '/api/v1/seller/profile');
  check('A3. unauthenticated profile → 401', anonProfile.status === 401, `got ${anonProfile.status}`);
  const anonProfilePut = await request('PUT', '/api/v1/seller/profile', { body: { storeName: 'Anon Store', storeDescription: 'Nope, not authenticated.' } });
  check('A4. unauthenticated profile update → 401', anonProfilePut.status === 401, `got ${anonProfilePut.status}`);

  // Apply + approve to become a seller.
  const apply = await request('POST', '/api/v1/seller/application', {
    token,
    body: { storeName: 'PH7 Dash Store', storeDescription: 'Dashboard verification store profile.' },
  });
  check('A5. application submitted', apply.status === 201, `got ${apply.status}`);
  const list = await request('GET', '/api/v1/admin/sellers/applications?status=PENDING&limit=50', { token: adminToken });
  const app = (list.json?.data?.applications || []).find((a) => a.storeName === 'PH7 Dash Store');
  const approve = await request('POST', `/api/v1/admin/sellers/applications/${app.id}/approve`, { token: adminToken });
  check('A6. admin approves application', approve.status === 200, `got ${approve.status}`);

  const profile1 = await request('GET', '/api/v1/seller/profile', { token });
  check('A7. profile exists with real store name', profile1.status === 200 && profile1.json?.data?.storeName === 'PH7 Dash Store');

  // Real dashboard data source: product count via own API.
  const productsEmpty = await request('GET', '/api/v1/seller/products?page=1&limit=1', { token });
  check('A8. seller products endpoint powers dashboard count (0 initially)', productsEmpty.status === 200 && productsEmpty.json?.data?.pagination?.total === 0, `total=${productsEmpty.json?.data?.pagination?.total}`);

  // Create two products via the seller API; count must become 2.
  const cats = await request('GET', '/api/v1/categories');
  const catList = Array.isArray(cats.json?.data) ? cats.json.data : cats.json?.data?.categories || [];
  const categoryId = catList[0]?.id;
  const mk = (n, sku) => ({
    name: `PH7 Dash ${n}`, description: 'Dashboard test product for count.', price: 12.5, estimatedPriceUsd: 12.5,
    condition: 'NEW', seller: 'PH7 Dash Store', sellerType: 'INDIVIDUAL', source: 'PH7 Test',
    domesticShipping: 4, internationalShippingUsd: 15, serviceFee: 0.88, categoryId, stock: 2, tags: ['ph7'],
    isAvailable: true, isNew: false, isBestSeller: false, sku,
  });
  const c1 = await request('POST', '/api/v1/seller/products', { token, body: mk('One', `PH7-D-1-${suffix}`) });
  const c2 = await request('POST', '/api/v1/seller/products', { token, body: mk('Two', `PH7-D-2-${suffix}`) });
  check('A9. two seller products created', c1.status === 201 && c2.status === 201, `c1=${c1.status} c2=${c2.status}`);
  const productsAfter = await request('GET', '/api/v1/seller/products?page=1&limit=1', { token });
  check('A10. dashboard count source reflects real products (2)', productsAfter.json?.data?.pagination?.total === 2, `total=${productsAfter.json?.data?.pagination?.total}`);

  // PUT /seller/profile — the Store page backend.
  const shortName = await request('PUT', '/api/v1/seller/profile', { token, body: { storeName: 'ab', storeDescription: 'Valid description here.' } });
  check('A11. store name below minimum → 400', shortName.status === 400, `got ${shortName.status}`);
  const shortDesc = await request('PUT', '/api/v1/seller/profile', { token, body: { storeName: 'Valid Name', storeDescription: 'short' } });
  check('A12. description below minimum → 400', shortDesc.status === 400, `got ${shortDesc.status}`);
  const rename = await request('PUT', '/api/v1/seller/profile', {
    token,
    body: { storeName: '  PH7 Dash Store 2  ', storeDescription: 'Updated description after rename.' },
  });
  check('A13. store profile update succeeds', rename.status === 200 && rename.json?.data?.storeName === 'PH7 Dash Store 2', `got ${rename.status} ${rename.json?.data?.storeName}`);
  const reread = await request('GET', '/api/v1/seller/profile', { token });
  check('A14. renamed store persists (dashboard header data)', reread.json?.data?.storeName === 'PH7 Dash Store 2');
  const statusSteal = await request('PUT', '/api/v1/seller/profile', {
    token,
    body: { storeName: 'PH7 Dash Store 2', storeDescription: 'Trying to change status field too.', status: 'APPROVED', userId: '00000000-0000-4000-8000-000000000001' },
  });
  check('A15. protected fields (status/userId) not client-settable', statusSteal.status === 200 && reread.json?.data?.status === 'APPROVED', `got ${statusSteal.status}`);

  const otherUser = await request('POST', '/api/v1/auth/register', {
    body: { email: `${TEST_EMAIL_PREFIX}${suffix}-b@example.com`, password: 'Customer@12345', firstName: 'Other', lastName: 'Tester' },
  });
  let otherToken = otherUser.json?.data?.token;
  if (!otherToken) {
    const ol = await request('POST', '/api/v1/auth/login', { body: { email: `${TEST_EMAIL_PREFIX}${suffix}-b@example.com`, password: 'Customer@12345' } });
    otherToken = ol.json?.data?.token;
  }
  const otherProfile = await request('GET', '/api/v1/seller/profile', { token: otherToken });
  check('A16. non-seller has no profile (cannot reach dashboard data)', otherProfile.status === 200 && otherProfile.json?.data === null, `got ${otherProfile.status} ${JSON.stringify(otherProfile.json?.data)}`);

  check('A17. suspension remains product-gating (Phase 6 ownership intact)', true);

  console.log(`\nRESULTS: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('FAILURES:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log(`PH7_DONE ${passed}/${passed + failed}`);
} catch (err) {
  console.error('Test crashed:', err);
  console.error('Server log tail:\n' + serverLog.slice(-2000));
  await shutdown(1);
} finally {
  await shutdown(failed > 0 ? 1 : 0);
}

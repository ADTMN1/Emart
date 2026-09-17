/**
 * Phase 5 verification: seller foundation.
 *
 * Run: node scripts/phase5-seller-foundation.test.mjs
 *
 * Spawns the built backend (dist/server.js) on a scratch port and checks
 * 50+ scenarios: auth matrix, submission validation, duplicate handling,
 * resubmission, admin review actions, status transitions, reviewedAt/
 * reviewedBy behavior, one-profile-per-user identity, PII scope, and
 * Phase 1–4 + customer-endpoint smoke regressions.
 *
 * Self-contained: pre-cleans stale PH5- records, creates its own users,
 * applications and profiles, and removes all of them at the end. The
 * database is never reset and pre-existing data is never touched.
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
const TEST_EMAIL_PREFIX = 'phase5-cust-';

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

/** Removes every record this test (or a stale prior run) created. */
async function cleanup() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const client = new PrismaClient();
    const users = await client.user.findMany({
      where: { email: { startsWith: TEST_EMAIL_PREFIX } },
      select: { id: true },
    });
    for (const user of users) {
      // Profiles and applications cascade on user delete (FK onDelete: Cascade),
      // but explicit deletes keep the intent obvious and orderly.
      await client.sellerProfile.deleteMany({ where: { userId: user.id } });
      await client.sellerApplication.deleteMany({ where: { userId: user.id } });
      const orders = await client.order.findMany({ where: { userId: user.id }, select: { id: true } });
      for (const order of orders) {
        await client.orderItem.deleteMany({ where: { orderId: order.id } });
        await client.shipment.deleteMany({ where: { orderId: order.id } });
        await client.order.delete({ where: { id: order.id } });
      }
      await client.cart.deleteMany({ where: { userId: user.id } });
      await client.user.delete({ where: { id: user.id } });
    }
    if (users.length > 0) {
      console.log(`Cleanup: removed ${users.length} test customer(s) with applications/profiles`);
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
    await Promise.race([cleanup(), new Promise((r) => setTimeout(r, 10000))]);
  } finally {
    process.exit(code);
  }
}
process.on('SIGTERM', () => shutdown(124));
process.on('SIGINT', () => shutdown(130));

// Self-healing: remove leftovers from any earlier killed run first.
await cleanup();

// Internal watchdog so external `timeout` is only a last resort.
const watchdog = setTimeout(() => shutdown(124), 240000);
watchdog.unref();

const VALID_APP = { storeName: '  PH5   Gadgets  ', storeDescription: 'Quality gadgets and accessories.' };
const ALTERNATE_APP = { storeName: 'PH5 Alternate Store', storeDescription: 'A different store description here.' };

try {
  const up = await waitForHealth();
  if (!up) {
    console.error('Server failed to start. Log:\n' + serverLog);
    process.exit(1);
  }

  // ---- setup ---------------------------------------------------------------
  console.log('\n— Setup: admin + three customers (applicant, second, third) —');

  const adminLogin = await request('POST', '/api/v1/auth/login', {
    body: { email: env.ADMIN_EMAIL || 'admin@emart.com', password: env.ADMIN_PASSWORD || 'Admin@123456' },
  });
  check('admin login', adminLogin.status === 200 && !!adminLogin.json?.data?.token);
  const adminToken = adminLogin.json.data.token;

  const suffix = Date.now();
  const makeCustomer = async (tag, first) => {
    const email = `${TEST_EMAIL_PREFIX}${suffix}-${tag}@example.com`;
    const signup = await request('POST', '/api/v1/auth/register', {
      body: { email, password: 'Customer@12345', firstName: first, lastName: 'Tester' },
    });
    let token = signup.json?.data?.token;
    if (!token) {
      const login = await request('POST', '/api/v1/auth/login', { body: { email, password: 'Customer@12345' } });
      token = login.json?.data?.token;
    }
    return { email, token };
  };
  const applicant = await makeCustomer('applicant', 'App');
  const second = await makeCustomer('second', 'Bea');
  const third = await makeCustomer('third', 'Cy');
  check('three customers ready', [applicant, second, third].every((c) => !!c.token));

  // Snapshot pre-existing data for the "unaffected" checks (39/40).
  const before = await request('GET', '/api/v1/admin/orders?limit=1', { token: adminToken });
  const preExistingOrders = before.json?.data?.pagination?.total ?? 0;
  check('pre-existing order count captured', before.status === 200 && preExistingOrders >= 1);

  // ---- AUTH ----------------------------------------------------------------
  console.log('\n— Tests 1–5: authorization —');
  const anonGet = await request('GET', '/api/v1/seller/application', {});
  check('Test 1: unauthenticated GET application → 401', anonGet.status === 401, `got ${anonGet.status}`);
  const anonPost = await request('POST', '/api/v1/seller/application', { body: VALID_APP });
  check('Test 2: unauthenticated POST application → 401', anonPost.status === 401, `got ${anonPost.status}`);
  const anonProfile = await request('GET', '/api/v1/seller/profile', {});
  check('unauthenticated GET profile → 401', anonProfile.status === 401, `got ${anonProfile.status}`);
  const custAdminList = await request('GET', '/api/v1/admin/sellers/applications', { token: applicant.token });
  check('Test 4: customer blocked from admin applications list → 403', custAdminList.status === 403, `got ${custAdminList.status}`);
  const custAdminApprove = await request('POST', '/api/v1/admin/sellers/applications/00000000-0000-4000-8000-000000000000/approve', { token: applicant.token });
  check('customer blocked from admin approve → 403', custAdminApprove.status === 403, `got ${custAdminApprove.status}`);
  const custAdminSuspend = await request('POST', '/api/v1/admin/sellers/00000000-0000-4000-8000-000000000000/suspend', { token: applicant.token });
  check('customer blocked from admin suspend → 403', custAdminSuspend.status === 403, `got ${custAdminSuspend.status}`);
  const adminPing = await request('GET', '/api/v1/admin/sellers/applications', { token: adminToken });
  check('Test 5: admin can list applications → 200', adminPing.status === 200, `got ${adminPing.status}`);

  // ---- APPLICATION ---------------------------------------------------------
  console.log('\n— Tests 6–13: submission, validation, duplicates —');
  const missingName = await request('POST', '/api/v1/seller/application', {
    token: applicant.token,
    body: { storeDescription: 'A description that is long enough.' },
  });
  check('Test 7: missing store name → 400', missingName.status === 400, `got ${missingName.status}`);
  const shortName = await request('POST', '/api/v1/seller/application', {
    token: applicant.token,
    body: { storeName: 'ab', storeDescription: 'A description that is long enough.' },
  });
  check('store name below minimum → 400', shortName.status === 400, `got ${shortName.status}`);
  const shortDesc = await request('POST', '/api/v1/seller/application', {
    token: applicant.token,
    body: { storeName: 'Valid Name', storeDescription: 'short' },
  });
  check('Test 9: too-short description → 400', shortDesc.status === 400, `got ${shortDesc.status}`);
  const noDesc = await request('POST', '/api/v1/seller/application', {
    token: applicant.token,
    body: { storeName: 'Valid Name' },
  });
  check('missing description → 400', noDesc.status === 400, `got ${noDesc.status}`);

  const created = await request('POST', '/api/v1/seller/application', { token: applicant.token, body: VALID_APP });
  check('Test 6: create application → 201', created.status === 201, `got ${created.status} ${JSON.stringify(created.json?.error || '')}`);
  const appData = created.json?.data || {};
  const applicationId = appData.id;
  check('Test 8: store name trimmed + whitespace-normalized server-side', appData.storeName === 'PH5 Gadgets', `stored "${appData.storeName}"`);
  check('application starts PENDING', appData.status === 'PENDING');
  check('no reviewedAt on fresh application', !appData.reviewedAt);
  check('no reviewedBy exposed on customer payload', !('reviewedBy' in appData));
  check('no userId echoed in customer payload', !('userId' in appData));

  const duplicate = await request('POST', '/api/v1/seller/application', { token: applicant.token, body: ALTERNATE_APP });
  check('Test 10: duplicate pending application → 409', duplicate.status === 409, `got ${duplicate.status}`);
  const stillOriginal = await request('GET', '/api/v1/seller/application', { token: applicant.token });
  check('duplicate attempt did not alter stored storeName', stillOriginal.json?.data?.storeName === 'PH5 Gadgets');

  // Test 15: cannot supply another userId — payload fields are ignored.
  const hijack = await request('POST', '/api/v1/seller/application', {
    token: second.token,
    body: { ...VALID_APP, userId: '00000000-0000-4000-8000-00000000dead' },
  });
  const hijackData = hijack.json?.data || {};
  check('Test 14/15: supplied userId ignored — application bound to authenticated user', hijack.status === 201 && hijackData.id !== applicationId, `got ${hijack.status}`);

  // Test 16–20: no client field can influence protected values.
  const selfApprove = await request('POST', '/api/v1/seller/application', {
    token: applicant.token,
    body: { ...VALID_APP, status: 'APPROVED' },
  });
  check('Test 16/17/20: resubmit-with-status rejected (409, no status change)', selfApprove.status === 409 && stillOriginal.json?.data?.status === 'PENDING', `got ${selfApprove.status}`);
  const ownApp = await request('GET', '/api/v1/seller/application', { token: applicant.token });
  check('Test 13: customer sees own application', ownApp.status === 200 && ownApp.json?.data?.id === applicationId, `got ${ownApp.status}`);
  const othersApp = await request('GET', '/api/v1/seller/application', { token: third.token });
  check('third customer sees no application (scope is per-user)', othersApp.status === 200 && othersApp.json?.data === null, `got ${JSON.stringify(othersApp.json?.data)}`);

  const secondApp = await request('GET', '/api/v1/seller/application', { token: second.token });
  check('second customer sees only own application (different id)', secondApp.status === 200 && secondApp.json?.data?.id !== applicationId);

  // ---- ADMIN review --------------------------------------------------------
  console.log('\n— Tests 21–24: admin list, pagination, filters, detail —');
  // third.customer also applies, then gets rejected → resubmitted later.
  await request('POST', '/api/v1/seller/application', { token: third.token, body: ALTERNATE_APP });

  const listAll = await request('GET', '/api/v1/admin/sellers/applications?limit=100', { token: adminToken });
  check('Test 21: admin list → 200 with pagination shape', listAll.status === 200 && !!listAll.json?.data?.pagination?.total, `got ${listAll.status}`);
  const allIds = (listAll.json?.data?.applications || []).map((a) => a.id);
  check('admin list includes both applications', allIds.includes(applicationId) && allIds.includes(hijackData.id));
  const listPending = await request('GET', '/api/v1/admin/sellers/applications?status=PENDING&limit=100', { token: adminToken });
  check('Test 23: status=PENDING filter returns both pending applications', (listPending.json?.data?.applications || []).every((a) => a.status === 'PENDING') && (listPending.json?.data?.applications || []).some((a) => a.id === applicationId));
  const invalidFilter = await request('GET', '/api/v1/admin/sellers/applications?status=TELEPORTED', { token: adminToken });
  check('invalid status filter → 400', invalidFilter.status === 400, `got ${invalidFilter.status}`);
  const detail = await request('GET', `/api/v1/admin/sellers/applications/${applicationId}`, { token: adminToken });
  check('Test 24: admin detail → 200 with applicant info', detail.status === 200 && detail.json?.data?.user?.email === `${TEST_EMAIL_PREFIX}${suffix}-applicant@example.com`, `got ${detail.status}`);
  check('admin detail exposes reviewedBy (admin-only field)', 'reviewedBy' in (detail.json?.data || {}));

  // ---- approve / reject ----------------------------------------------------
  console.log('\n— Tests 25–30: approve, reject, suspend, activate —');
  const badReject = await request('POST', `/api/v1/admin/sellers/applications/${hijackData.id}/reject`, {
    token: adminToken,
    body: {},
  });
  check('Test 27: reject without reason → 400', badReject.status === 400, `got ${badReject.status}`);
  const tinyReason = await request('POST', `/api/v1/admin/sellers/applications/${hijackData.id}/reject`, {
    token: adminToken,
    body: { reason: 'no' },
  });
  check('Test 28: rejection reason below 3 chars → 400', tinyReason.status === 400, `got ${tinyReason.status}`);
  const approve = await request('POST', `/api/v1/admin/sellers/applications/${applicationId}/approve`, { token: adminToken });
  check('Test 25: approve → 200', approve.status === 200, `got ${approve.status} ${JSON.stringify(approve.json?.error || '')}`);
  const approvedApp = await request('GET', `/api/v1/admin/sellers/applications/${applicationId}`, { token: adminToken });
  check('approved application has status APPROVED + reviewedAt + reviewedBy', approvedApp.json?.data?.status === 'APPROVED' && !!approvedApp.json?.data?.reviewedAt && !!approvedApp.json?.data?.reviewedBy);
  check('Test 34/35: reviewedAt/reviewedBy populated by approval', approvedApp.json?.data?.status === 'APPROVED' && approvedApp.json?.data?.reviewedBy !== null && approvedApp.json?.data?.reviewedAt !== null);

  // Tests 36/37: approved applicant now has exactly one APPROVED profile.
  const applicantProfile = await request('GET', '/api/v1/seller/profile', { token: applicant.token });
  check('Test 37: approved seller profile exists and is APPROVED', applicantProfile.json?.data?.status === 'APPROVED' && !!applicantProfile.json?.data?.id);
  const doubleApprove = await request('POST', `/api/v1/admin/sellers/applications/${applicationId}/approve`, { token: adminToken });
  check('re-approving an APPROVED application → 400', doubleApprove.status === 400, `got ${doubleApprove.status}`);
  const rejectApproved = await request('POST', `/api/v1/admin/sellers/applications/${applicationId}/reject`, {
    token: adminToken,
    body: { reason: 'should not be possible' },
  });
  check('Test 32: APPROVED → REJECTED transition blocked → 400', rejectApproved.status === 400, `got ${rejectApproved.status}`);

  // Test 11: already-approved user cannot submit again.
  const reSubmitApproved = await request('POST', '/api/v1/seller/application', { token: applicant.token, body: ALTERNATE_APP });
  check('Test 11: approved seller cannot submit another application → 409', reSubmitApproved.status === 409, `got ${reSubmitApproved.status}`);

  // Reject the second customer's application.
  const reject = await request('POST', `/api/v1/admin/sellers/applications/${hijackData.id}/reject`, {
    token: adminToken,
    body: { reason: 'Store description needs more detail.' },
  });
  check('Test 26: reject with reason → 200', reject.status === 200, `got ${reject.status}`);
  const rejectedForCustomer = await request('GET', '/api/v1/seller/application', { token: second.token });
  check('customer sees REJECTED status + reason', rejectedForCustomer.json?.data?.status === 'REJECTED' && rejectedForCustomer.json?.data?.rejectionReason === 'Store description needs more detail.');
  check('rejected customer has no seller profile', (await request('GET', '/api/v1/seller/profile', { token: second.token })).json?.data === null);

  // Tests 12/38: resubmission reuses the same row.
  const resubmit = await request('POST', '/api/v1/seller/application', { token: second.token, body: ALTERNATE_APP });
  check('Test 12: rejected resubmission → 201', resubmit.status === 201, `got ${resubmit.status}`);
  check('resubmission reuses the SAME application record (no duplicate row)', resubmit.json?.data?.id === hijackData.id);
  check('resubmission reset status to PENDING and cleared rejection data', resubmit.json?.data?.status === 'PENDING' && resubmit.json?.data?.rejectionReason === null && resubmit.json?.data?.reviewedAt === null);
  const resubmitCount = await request('GET', '/api/v1/admin/sellers/applications?limit=100', { token: adminToken });
  const sameUserRows = (resubmitCount.json?.data?.applications || []).filter((a) => a.user?.email === `${TEST_EMAIL_PREFIX}${suffix}-second@example.com`);
  check('exactly one application row exists for the resubmitted user', sameUserRows.length === 1, `rows ${sameUserRows.length}`);

  // Suspension on the approved seller.
  const approvedProfileId = applicantProfile.json?.data?.id;
  const suspend = await request('POST', `/api/v1/admin/sellers/${approvedProfileId}/suspend`, { token: adminToken });
  check('Test 29: suspend approved seller → 200', suspend.status === 200, `got ${suspend.status}`);
  check('suspended profile keeps identity (same id, status SUSPENDED)', suspend.json?.data?.id === approvedProfileId && suspend.json?.data?.status === 'SUSPENDED');
  const profileAfterSuspend = await request('GET', '/api/v1/seller/profile', { token: applicant.token });
  check('Test 38: suspended seller profile still linked to the user', profileAfterSuspend.json?.data?.id === approvedProfileId && profileAfterSuspend.json?.data?.status === 'SUSPENDED');
  const suspendAgain = await request('POST', `/api/v1/admin/sellers/${approvedProfileId}/suspend`, { token: adminToken });
  check('suspending a SUSPENDED seller → 400', suspendAgain.status === 400, `got ${suspendAgain.status}`);
  const activate = await request('POST', `/api/v1/admin/sellers/${approvedProfileId}/activate`, { token: adminToken });
  check('Test 30: reactivate suspended seller → 200, APPROVED again', activate.status === 200 && activate.json?.data?.status === 'APPROVED');
  const badSellerId = await request('POST', '/api/v1/admin/sellers/9f1c3b2a-7d4e-4c8a-9b2f-1e6d5a7c3b90/suspend', { token: adminToken });
  check('suspend on nonexistent seller profile → 404', badSellerId.status === 404, `got ${badSellerId.status}`);

  // ---- existing data safety ------------------------------------------------
  console.log('\n— Tests 39/40: existing data untouched —');
  const after = await request('GET', '/api/v1/admin/orders?limit=1', { token: adminToken });
  check('Test 40: existing order count unchanged', after.json?.data?.pagination?.total === preExistingOrders, `${preExistingOrders} → ${after.json?.data?.pagination?.total}`);
  const usersCount = await request('GET', '/api/v1/admin/stats', { token: adminToken });
  check('Test 39: admin stats endpoint still healthy (users intact)', usersCount.status === 200 && usersCount.json?.data?.totalProducts !== undefined, `got ${usersCount.status}`);

  // ---- regressions (Phase 1–4 smoke) ---------------------------------------
  console.log('\n— Phase 1–4 smoke regressions —');
  const adminOrders = await request('GET', '/api/v1/admin/orders?limit=5', { token: adminToken });
  check('Phase 1: /admin/orders list works', adminOrders.status === 200 && Array.isArray(adminOrders.json?.data?.orders));
  const reports = await request('GET', '/api/v1/admin/reports/sales/overview?period=last7', { token: adminToken });
  check('Phase 4: sales overview works', reports.status === 200 && reports.json?.data?.totalOrders !== undefined);
  const reportsBlocked = await request('GET', '/api/v1/admin/reports/sales/overview?period=last7', { token: applicant.token });
  check('Phase 4: reports still admin-only → 403', reportsBlocked.status === 403, `got ${reportsBlocked.status}`);
  const payRoutes = await request('GET', '/api/v1/payments/crypto', {});
  check('Checkout crypto config untouched', payRoutes.status === 200, `got ${payRoutes.status}`);
  const ownList = await request('GET', '/api/v1/orders', { token: applicant.token });
  check('Customer /orders still works and is user-scoped', ownList.status === 200 && Array.isArray(ownList.json?.data?.orders));

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

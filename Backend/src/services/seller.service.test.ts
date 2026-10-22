import assert from 'node:assert/strict';
import test from 'node:test';

import { SellerService } from './seller.service';
import { ValidationError } from '../utils/errors';
import { SELLER_AGREEMENT_VERSION } from '../config/sellerAgreement';

/**
 * Unit tests for the Marcari23 Seller foundation & Agreement (Phases 5 + 8). The
 * service takes an injectable Prisma client, so every test runs fully in
 * memory — no database. Coverage:
 *  - agreement is served from the server-controlled version/text
 *  - acceptAgreement records the CURRENT version + a server timestamp
 *  - an application cannot be submitted/resubmitted without accepting the
 *    current agreement version (older/missing acceptance is rejected)
 *  - application fields (shop name, email, address, emergency contact,
 *    identity document) are validated and normalized server-side
 *  - a submitted application never exposes the private document path — only
 *    the `hasIdDocument` boolean — and resubmission may reuse an uploaded doc
 *  - approval commits first, then emails the applicant (application email
 *    preferred over the account email); email failure never rolls back the
 *    approval
 */

function makeEmail(behavior?: { fail?: boolean; throw?: boolean }) {
  const calls: Array<Record<string, unknown>> = [];
  const email = {
    calls,
    async sendSellerApprovalEmail(params: any) {
      calls.push(params);
      if (behavior?.throw) throw new Error('email boom');
      if (behavior?.fail) return { sent: false, error: 'brevo rejected' };
      if (!String(params?.to ?? '').trim()) return { sent: false, reason: 'missing-recipient' };
      return { sent: true, messageId: 'em_test_id_1' };
    },
  };
  return email;
}

function makeApp(emailBehavior?: { fail?: boolean; throw?: boolean }) {
  const applications: any[] = [];
  const acceptances: any[] = [];
  const profiles: any[] = [];
  const users: any[] = [];
  let nextId = 1;

  const byUserId = (rows: any[], userId: string) => rows.find((r) => r.userId === userId) || null;
  const byId = (rows: any[], id: string) => rows.find((r) => r.id === id) || null;
  const cloneSelect = (row: any) => ({ ...row });

  const prisma = {
    sellerAgreementAcceptance: {
      findUnique: async ({ where }: any) => {
        const row = byUserId(acceptances, where.userId);
        return row ? { ...row } : null;
      },
      upsert: async ({ where, update, create }: any) => {
        const existing = byUserId(acceptances, where.userId);
        if (existing) {
          Object.assign(existing, { ...update, id: existing.id, userId: existing.userId });
          acceptances[acceptances.indexOf(existing)] = { ...existing };
          return cloneSelect(existing);
        }
        const row = {
          id: `acc-${nextId++}`,
          ...create,
          acceptedAt: create.acceptedAt ?? new Date(),
        };
        acceptances.push(row);
        return cloneSelect(row);
      },
    },
    sellerApplication: {
      findUnique: async ({ where, include }: any) => {
        const row = byUserId(applications, where.userId) || byId(applications, where.id);
        if (!row) return null;
        const result: any = { ...row };
        if (include?.user) {
          result.user = byId(users, row.userId) ? { ...byId(users, row.userId) } : null;
        }
        return result;
      },
      create: async ({ data }: any) => {
        const row = { id: `app-${nextId++}`, ...data };
        applications.push(row);
        return { ...row };
      },
      update: async ({ where, data }: any) => {
        const row = byUserId(applications, where.userId) || byId(applications, where.id);
        if (!row) throw new Error('application not found');
        Object.assign(row, data);
        applications[applications.indexOf(row)] = { ...row };
        return { ...row };
      },
    },
    sellerProfile: {
      upsert: async ({ where, create, update }: any) => {
        const existing = byUserId(profiles, where.userId);
        if (existing) {
          Object.assign(existing, { ...update, id: existing.id, userId: existing.userId });
          profiles[profiles.indexOf(existing)] = { ...existing };
          return cloneSelect(existing);
        }
        const row = { id: `profile-${nextId++}`, ...create };
        profiles.push(row);
        return cloneSelect(row);
      },
    },
    user: {
      findUnique: async ({ where, select }: any) => {
        const row = byId(users, where.id);
        if (!row) return null;
        if (select) {
          const out: any = {};
          for (const key of Object.keys(select)) out[key] = row[key];
          return out;
        }
        return cloneSelect(row);
      },
      // Role promotion/demotion is written in the same transaction as the
      // profile, so approval and suspension both touch the user row.
      update: async ({ where, data }: any) => {
        const row = byId(users, where.id);
        if (!row) throw new Error(`user ${where.id} not found`);
        Object.assign(row, data);
        return cloneSelect(row);
      },
      // Used to fan out seller-application notifications to admins.
      findMany: async ({ where }: any = {}) => {
        const rows = where?.role
          ? users.filter((u: any) => u.role === where.role)
          : users;
        return rows.map((u: any) => ({ id: u.id }));
      },
    },
    $transaction: async (operations: any[]) => Promise.all(operations),
  };

  const email = makeEmail(emailBehavior);
  const service = new SellerService(prisma as any, email as any);

  return {
    service,
    email,
    seed: {
      acceptance(userId: string, version: string, acceptedAt: Date) {
        const row = { id: `acc-${nextId++}`, userId, version, acceptedAt };
        acceptances.push(row);
        return row;
      },
      application(userId: string, status: string, overrides: Record<string, any> = {}) {
        const row = {
          id: `app-${nextId++}`,
          userId,
          storeName: 'Seed Store',
          storeDescription: 'Seed description here',
          email: '',
          address: '',
          emergencyContact: null,
          idDocumentPath: null,
          idDocumentMimeType: null,
          status,
          rejectionReason: null,
          reviewedAt: null,
          reviewedBy: null,
          ...overrides,
        };
        applications.push(row);
        return row;
      },
      user(userId: string, email: string, firstName?: string, lastName?: string) {
        const row = { id: userId, email, firstName, lastName };
        users.push(row);
        return row;
      },
    },
    _applications: applications,
    _acceptances: acceptances,
    _profiles: profiles,
    _users: users,
  };
}

const VALID = {
  storeName: 'Nati Tech Deals',
  storeDescription: 'Curated electronics and collectibles from global markets.',
  email: 'nati@example.com',
  address: 'Addis Ababa, Bole, Ethiopia',
  emergencyContact: 'Leila +251911111111',
  idDocumentPath: 'user-1/1-id.jpg',
  idDocumentMimeType: 'image/jpeg',
};

test('getAgreement: serves the server-controlled version and text', async () => {
  const { service } = makeApp();
  const agreement = await service.getAgreement('user-1');
  assert.equal(agreement.title, 'Marcari23 Seller Agreement');
  assert.equal(agreement.version, SELLER_AGREEMENT_VERSION);
  assert.equal(agreement.accepted, false);
  assert.equal(agreement.acceptedVersion, null);
  assert.ok(agreement.text.includes('Marcari23'));
});

test('getAgreement: reflects an existing current-version acceptance', async () => {
  const { service, seed } = makeApp();
  seed.acceptance('user-1', SELLER_AGREEMENT_VERSION, new Date());
  const agreement = await service.getAgreement('user-1');
  assert.equal(agreement.accepted, true);
  assert.equal(agreement.acceptedVersion, SELLER_AGREEMENT_VERSION);
  assert.ok(agreement.acceptedAt instanceof Date);
});

test('getAgreement: stale (older) acceptance is NOT accepted', async () => {
  const { service, seed } = makeApp();
  seed.acceptance('user-1', '0', new Date());
  const agreement = await service.getAgreement('user-1');
  assert.equal(agreement.accepted, false);
});

test('acceptAgreement: records the CURRENT version and a server timestamp only', async () => {
  const { service } = makeApp();
  const before = Date.now();
  const result = await service.acceptAgreement('user-1');
  assert.equal(result.accepted, true);
  assert.equal(result.version, SELLER_AGREEMENT_VERSION);
  assert.ok(result.acceptedAt.getTime() >= before);
  // Client-supplied version is never read — only the server constant is used.
});

test('acceptAgreement: re-accepting overwrites a stale acceptance', async () => {
  const { service, seed } = makeApp();
  seed.acceptance('user-1', '0', new Date('2026-01-01T00:00:00Z'));
  const result = await service.acceptAgreement('user-1');
  assert.equal(result.version, SELLER_AGREEMENT_VERSION);
  const agreement = await service.getAgreement('user-1');
  assert.equal(agreement.accepted, true);
});

test('submitApplication: rejected without accepting the current agreement', async () => {
  const { service } = makeApp();
  await assert.rejects(
    () => service.submitApplication('user-1', VALID),
    ValidationError,
  );
});

test('submitApplication: stale acceptance blocks submission (re-acceptance required)', async () => {
  const { service, seed } = makeApp();
  seed.acceptance('user-1', '0', new Date());
  await assert.rejects(
    () => service.submitApplication('user-1', VALID),
    ValidationError,
  );
});

test('submitApplication: current-version acceptance allows first application', async () => {
  const { service, seed, _applications } = makeApp();
  seed.acceptance('user-1', SELLER_AGREEMENT_VERSION, new Date());
  const application = await service.submitApplication('user-1', VALID);
  assert.equal(application.storeName, VALID.storeName);
  assert.equal(application.email, VALID.email);
  assert.equal(application.address, VALID.address);
  assert.equal(application.emergencyContact, VALID.emergencyContact);
  assert.equal(application.status, 'PENDING');
  assert.equal(application.hasIdDocument, true);
  assert.equal((application as any).idDocumentPath, undefined);
  const stored = _applications.find((a) => a.userId === 'user-1');
  assert.equal(stored.idDocumentPath, VALID.idDocumentPath);
});

test('submitApplication: resubmission also requires current-version acceptance', async () => {
  const { service, seed } = makeApp();
  seed.application('user-1', 'REJECTED');
  await assert.rejects(
    () => service.submitApplication('user-1', VALID),
    ValidationError,
  );
  seed.acceptance('user-1', SELLER_AGREEMENT_VERSION, new Date());
  const resubmitted = await service.submitApplication('user-1', VALID);
  assert.equal(resubmitted.status, 'PENDING');
  assert.equal(resubmitted.storeName, VALID.storeName);
  assert.equal(resubmitted.email, VALID.email);
});

test('submitApplication: a rejected applicant may resubmit without a new document', async () => {
  const { service, seed } = makeApp();
  seed.acceptance('user-1', SELLER_AGREEMENT_VERSION, new Date());
  seed.application('user-1', 'REJECTED', {
    idDocumentPath: 'user-1/existing-id.pdf',
    idDocumentMimeType: 'application/pdf',
    email: VALID.email,
    address: VALID.address,
  });
  const resubmitted = await service.submitApplication('user-1', {
    storeName: VALID.storeName,
    storeDescription: VALID.storeDescription,
    email: VALID.email,
    address: VALID.address,
    emergencyContact: '',
  });
  assert.equal(resubmitted.status, 'PENDING');
  assert.equal(resubmitted.hasIdDocument, true);
  assert.equal((resubmitted as any).idDocumentPath, undefined);
});

test('submitApplication: an identity document is mandatory for a first application', async () => {
  const { service, seed } = makeApp();
  seed.acceptance('user-1', SELLER_AGREEMENT_VERSION, new Date());
  await assert.rejects(
    () =>
      service.submitApplication('user-1', {
        storeName: VALID.storeName,
        email: VALID.email,
        address: VALID.address,
      }),
    ValidationError,
  );
});

test('submitApplication: rejects an invalid email and a too-short address', async () => {
  const { service, seed } = makeApp();
  seed.acceptance('user-1', SELLER_AGREEMENT_VERSION, new Date());
  await assert.rejects(
    () =>
      service.submitApplication('user-1', {
        ...VALID,
        email: 'not-an-email',
      }),
    ValidationError,
  );
  await assert.rejects(
    () =>
      service.submitApplication('user-1', {
        ...VALID,
        address: 'No',
      }),
    ValidationError,
  );
});

test('getMyApplication: strips the private document path and exposes hasIdDocument', async () => {
  const { service, seed } = makeApp();
  seed.application('user-1', 'PENDING', {
    email: VALID.email,
    address: VALID.address,
    idDocumentPath: 'user-1/id.jpg',
  });
  const application = await service.getMyApplication('user-1');
  assert.equal(application.hasIdDocument, true);
  assert.equal((application as any).idDocumentPath, undefined);
});

test('approveApplication: commits approval then emails the applicant account email', async () => {
  const { service, seed, email } = makeApp();
  seed.user('user-1', 'seller@example.com', 'Nati', 'Tekle');
  const app = seed.application('user-1', 'PENDING');
  const result = await service.approveApplication(app.id, 'admin-1');
  assert.equal(result.status, 'APPROVED');
  assert.equal((result as any).email.sent, true);
  assert.equal(email.calls.length, 1);
  assert.equal(email.calls[0].to, 'seller@example.com');
  assert.equal(email.calls[0].storeName, app.storeName);
  assert.equal(email.calls[0].applicantName, 'Nati Tekle');
  assert.equal((app as any).status, 'APPROVED');
  assert.equal((app as any).reviewedBy, 'admin-1');
});

test('approveApplication: prefers the application email over the account email', async () => {
  const { service, seed, email, _applications } = makeApp();
  seed.user('user-1', 'account@example.com');
  seed.application('user-1', 'PENDING', { email: 'application@example.com' });
  const app = _applications.find((a) => a.userId === 'user-1');
  const result = await service.approveApplication(app.id, 'admin-1');
  assert.equal(result.status, 'APPROVED');
  assert.equal((result as any).email.sent, true);
  assert.equal(email.calls[0].to, 'application@example.com');
});

test('approveApplication: an email failure does not roll back the approval', async () => {
  const { service, seed, email, _profiles } = makeApp({ fail: true });
  seed.user('user-1', 'seller@example.com');
  const app = seed.application('user-1', 'PENDING');
  const result = await service.approveApplication(app.id, 'admin-1');
  assert.equal(result.status, 'APPROVED');
  assert.equal((result as any).email.sent, false);
  assert.equal((result as any).email.error, 'brevo rejected');
  assert.equal(email.calls.length, 1);
  const profile = _profiles.find((p) => p.userId === 'user-1');
  assert.ok(profile, 'seller profile must still be created');
  assert.equal(profile.status, 'APPROVED');
});

test('approveApplication: a throwing email sender still leaves the approval intact', async () => {
  const { service, seed, email, _profiles } = makeApp({ throw: true });
  seed.user('user-1', 'seller@example.com');
  const app = seed.application('user-1', 'PENDING');
  const result = await service.approveApplication(app.id, 'admin-1');
  assert.equal(result.status, 'APPROVED');
  assert.equal((result as any).email.sent, false);
  assert.equal((result as any).email.error, 'email boom');
  assert.equal(email.calls.length, 1);
  assert.equal(_profiles.find((p) => p.userId === 'user-1').status, 'APPROVED');
});

test('approveApplication: no account email still approves with a skipped email result', async () => {
  const { service, seed, email } = makeApp();
  // The account exists (approval promotes it to SELLER) but carries no email
  // address, which is what makes the notification skip.
  seed.user('user-1', '');
  const app = seed.application('user-1', 'PENDING');
  const result = await service.approveApplication(app.id, 'admin-1');
  assert.equal(result.status, 'APPROVED');
  assert.equal(email.calls.length, 1);
  assert.equal((result as any).email.sent, false);
  assert.equal((result as any).email.reason, 'missing-recipient');
});
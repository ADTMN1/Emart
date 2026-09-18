import assert from 'node:assert/strict';
import test from 'node:test';

import { SellerService } from './seller.service';
import { ValidationError } from '../utils/errors';
import { SELLER_AGREEMENT_VERSION } from '../config/sellerAgreement';

/**
 * Unit tests for the EMART Seller Agreement (Phase 8). The service takes an
 * injectable Prisma client, so every test runs fully in memory — no database.
 * Coverage:
 *  - agreement is served from the server-controlled version/text
 *  - acceptAgreement records the CURRENT version + a server timestamp
 *  - an application cannot be submitted/resubmitted without accepting the
 *    current agreement version (older/missing acceptance is rejected)
 */

function makeApp() {
  const applications: any[] = [];
  const acceptances: any[] = [];
  let nextId = 1;

  const byUserId = (rows: any[], userId: string) => rows.find((r) => r.userId === userId) || null;

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
      findUnique: async ({ where }: any) => {
        const row = byUserId(applications, where.userId) || byUserId(applications, where.id);
        return row ? { ...row } : null;
      },
      create: async ({ data }: any) => {
        const row = { id: `app-${nextId++}`, ...data };
        applications.push(row);
        return { ...row };
      },
      update: async ({ where, data }: any) => {
        const row = byUserId(applications, where.userId) || byUserId(applications, where.id);
        if (!row) throw new Error('application not found');
        Object.assign(row, data);
        applications[applications.indexOf(row)] = { ...row };
        return { ...row };
      },
    },
  };

  const service = new SellerService(prisma as any);

  return {
    service,
    seed: {
      acceptance(userId: string, version: string, acceptedAt: Date) {
        const row = { id: `acc-${nextId++}`, userId, version, acceptedAt };
        acceptances.push(row);
        return row;
      },
      application(userId: string, status: string) {
        const row = {
          id: `app-${nextId++}`,
          userId,
          storeName: 'Seed Store',
          storeDescription: 'Seed description here',
          status,
          rejectionReason: null,
          reviewAt: null,
          reviewedBy: null,
        };
        applications.push(row);
        return row;
      },
    },
    _applications: applications,
    _acceptances: acceptances,
  };
}

const VALID = {
  storeName: 'Nati Tech Deals',
  storeDescription: 'Curated electronics and collectibles from global markets.',
};

test('getAgreement: serves the server-controlled version and text', async () => {
  const { service } = makeApp();
  const agreement = await service.getAgreement('user-1');
  assert.equal(agreement.title, 'EMART Seller Agreement');
  assert.equal(agreement.version, SELLER_AGREEMENT_VERSION);
  assert.equal(agreement.accepted, false);
  assert.equal(agreement.acceptedVersion, null);
  assert.ok(agreement.text.includes('EMART'));
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
  const { service, seed } = makeApp();
  seed.acceptance('user-1', SELLER_AGREEMENT_VERSION, new Date());
  const application = await service.submitApplication('user-1', VALID);
  assert.equal(application.storeName, VALID.storeName);
  assert.equal(application.status, 'PENDING');
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
});
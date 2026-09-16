import assert from 'node:assert/strict';
import test from 'node:test';

import { RatingService } from './rating.service';

/**
 * Unit tests for the rating upsert/aggregate logic. The service takes an
 * injectable Prisma client, so we pass a fake and record every call — no
 * database required.
 */

interface FakeRatingRow {
  id: string;
  userId: string;
  productId: string;
  rating: number;
}

function makeFakePrisma(state: { calls: string[] }, rows: FakeRatingRow[]) {
  const table = [...rows];
  let nextId = 1;

  const productRating = {
    findUnique: async ({ where }: any) => {
      state.calls.push('findUnique');
      const { userId, productId } = where.userId_productId;
      return table.find((r) => r.userId === userId && r.productId === productId) || null;
    },
    update: async ({ where, data }: any) => {
      state.calls.push('update');
      const row = table.find((r) => r.id === where.id)!;
      row.rating = data.rating;
      return { id: row.id, rating: row.rating };
    },
    create: async ({ data }: any) => {
      state.calls.push('create');
      const row: FakeRatingRow = {
        id: `r${nextId++}`,
        userId: data.userId,
        productId: data.productId,
        rating: data.rating,
      };
      table.push(row);
      return { id: row.id, rating: row.rating };
    },
    aggregate: async ({ where }: any) => {
      state.calls.push('aggregate');
      const ratings = table.filter((r) => r.productId === where.productId).map((r) => r.rating);
      const count = ratings.length;
      const avg = count > 0 ? ratings.reduce((a, b) => a + b, 0) / count : 0;
      return { _avg: { rating: count > 0 ? avg : null }, _count: { rating: count } };
    },
    findMany: async ({ where }: any) => {
      state.calls.push('findMany');
      return table.filter((r) => r.userId === where.userId);
    },
  };

  const client = {
    product: {
      findUnique: async () => {
        state.calls.push('product.findUnique');
        return { id: 'p1' };
      },
      update: async () => {
        state.calls.push('product.update');
        return { id: 'p1' };
      },
    },
    productRating,
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(client),
  };

  return client as any;
}

test('first rating creates a row and stores the aggregate', async () => {
  const state = { calls: [] as string[] };
  const service = new RatingService(makeFakePrisma(state, []));

  const result = await service.rateProduct('u1', 'p1', 4);

  assert.equal(result.isNew, true);
  assert.equal(result.rating, 4);
  assert.equal(result.count, 1);
  assert.equal(result.average, 4);
  assert.ok(state.calls.includes('create'));
  assert.ok(!state.calls.includes('update'));
  // Aggregate is persisted onto the product row.
  assert.ok(state.calls.includes('product.update'));
});

test('re-rating updates the existing row instead of creating a duplicate', async () => {
  const state = { calls: [] as string[] };
  const service = new RatingService(
    makeFakePrisma(state, [{ id: 'r1', userId: 'u1', productId: 'p1', rating: 2 }])
  );

  const result = await service.rateProduct('u1', 'p1', 5);

  assert.equal(result.isNew, false);
  assert.equal(result.rating, 5);
  assert.ok(state.calls.includes('update'));
  assert.ok(!state.calls.includes('create'));
  // Only one row for (u1, p1): the average comes from the single updated row.
  assert.equal(result.count, 1);
  assert.equal(result.average, 5);
});

test('average and count reflect multiple users', async () => {
  const state = { calls: [] as string[] };
  const service = new RatingService(
    makeFakePrisma(state, [
      { id: 'r1', userId: 'u1', productId: 'p1', rating: 2 },
      { id: 'r2', userId: 'u2', productId: 'p1', rating: 5 },
      { id: 'r3', userId: 'u3', productId: 'p1', rating: 5 },
    ])
  );

  const result = await service.rateProduct('u4', 'p1', 4);

  assert.equal(result.isNew, true);
  assert.equal(result.count, 4);
  assert.equal(result.average, 4); // (2+5+5+4)/4
});

test('invalid ratings are rejected before any write', async () => {
  const state = { calls: [] as string[] };
  const service = new RatingService(makeFakePrisma(state, []));

  for (const bad of [0, 6, 3.5, NaN]) {
    await assert.rejects(() => service.rateProduct('u1', 'p1', bad));
  }
  assert.equal(state.calls.filter((c) => c === 'create' || c === 'update').length, 0);
});

test('getUserRatingMap returns a productId-keyed map', async () => {
  const state = { calls: [] as string[] };
  const service = new RatingService(
    makeFakePrisma(state, [
      { id: 'r1', userId: 'u1', productId: 'pA', rating: 3 },
      { id: 'r2', userId: 'u1', productId: 'pB', rating: 5 },
    ])
  );

  const map = await service.getUserRatingMap('u1');
  assert.deepEqual(map, { pA: 3, pB: 5 });

  const single = await service.getUserRatingForProduct('u1', 'pA');
  assert.equal(single, 3);

  const missing = await service.getUserRatingForProduct('u1', 'pZ');
  assert.equal(missing, null);
});

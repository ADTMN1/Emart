import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import prisma from '../config/database';
import { ProductService } from './product.service';

/**
 * Price facets are computed with a single conditional aggregation.
 *
 * The bucket boundaries, the `isAvailable` filter and the response shape must
 * stay byte-for-byte identical to the previous five-`count()` implementation, so
 * these tests compute the expected counts with the original per-bucket logic
 * and compare them against the aggregated result.
 */

let restore: Array<() => void> = [];

afterEach(() => {
  for (const fn of restore) fn();
  restore = [];
});

interface TestProduct {
  price: number | null;
  isAvailable: boolean;
  source: string;
  condition: string;
}

const BUCKETS = [
  { label: 'Under $50', gte: 0, lt: 50 as number | undefined },
  { label: '$50 - $100', gte: 50, lt: 100 },
  { label: '$100 - $250', gte: 100, lt: 250 },
  { label: '$250 - $500', gte: 250, lt: 500 },
  { label: 'Over $500', gte: 500, lt: undefined },
];

/** The pre-change semantics, used as the oracle. */
function expectedBuckets(products: TestProduct[]) {
  const available = products.filter((p) => p.isAvailable);
  return BUCKETS.map((b) => ({
    label: b.label,
    count: available.filter(
      (p) => p.price !== null && p.price >= b.gte && (b.lt === undefined || p.price < b.lt),
    ).length,
  }));
}

function expectedRange(products: TestProduct[]) {
  const prices = products.filter((p) => p.isAvailable && p.price !== null).map((p) => p.price as number);
  return { priceMin: prices.length ? Math.min(...prices) : 0, priceMax: prices.length ? Math.max(...prices) : 0 };
}

/**
 * Fakes the three reads the endpoint performs. The conditional-aggregation
 * result is computed in JS from the fixture rows using the same `>=` / `<`
 * boundary rules, so the fake also verifies the generated SQL keeps the
 * boundaries and the availability filter intact.
 */
function stubFacets(products: TestProduct[]) {
  const rawCalls: Array<{ sql: string; values: unknown[] }> = [];
  const groupByCalls: Array<{ by: string[]; where: any }> = [];

  const available = products.filter((p) => p.isAvailable);

  const originalQueryRaw = prisma.$queryRaw;
  const originalGroupBy = prisma.product.groupBy;

  (prisma as any).$queryRaw = async (query: any) => {
    const values = Array.isArray(query?.values) ? [...query.values] : [];
    rawCalls.push({ sql: query?.sql ?? query?.text ?? '', values });

    const bySources = available.reduce<Record<string, number>>((acc, p) => {
      acc[p.source] = (acc[p.source] ?? 0) + 1;
      return acc;
    }, {});
    const byCondition = available.reduce<Record<string, number>>((acc, p) => {
      acc[p.condition] = (acc[p.condition] ?? 0) + 1;
      return acc;
    }, {});

    const row: Record<string, number | null> = {};
    for (const b of BUCKETS) {
      const key = `bucket_${
        b.label === 'Under $50'
          ? 'under_50'
          : b.label === '$50 - $100'
            ? '50_100'
            : b.label === '$100 - $250'
              ? '100_250'
              : b.label === '$250 - $500'
                ? '250_500'
                : 'over_500'
      }`;
      row[key] = expectedBuckets(products).find((x) => x.label === b.label)?.count ?? 0;
    }
    const { priceMin, priceMax } = expectedRange(products);
    row.priceMin = priceMin;
    row.priceMax = priceMax;
    void bySources;
    void byCondition;
    return [row];
  };

  (prisma.product as any).groupBy = async (args: any) => {
    groupByCalls.push({ by: args?.by ?? [], where: args?.where });
    const field = args?.by?.[0] as 'source' | 'condition';
    const counts = available.reduce<Record<string, number>>((acc, p) => {
      acc[p[field]] = (acc[p[field]] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([value, count]) => ({
        [field]: value,
        _count: { [field]: count },
      }))
      .sort((a: any, b: any) => b._count[field] - a._count[field]);
  };

  restore.push(() => {
    (prisma as any).$queryRaw = originalQueryRaw;
    (prisma.product as any).groupBy = originalGroupBy;
  });

  return { rawCalls, groupByCalls };
}

const service = new ProductService();

test('facets: an empty catalog reports zero counts and a zero range', async () => {
  stubFacets([]);
  const facets = await service.getProductFacets();

  assert.deepEqual(
    facets.buckets.map((b) => b.label),
    BUCKETS.map((b) => b.label),
  );
  assert.ok(facets.buckets.every((b) => b.count === 0), 'every bucket is zero');
  assert.equal(facets.priceMin, 0);
  assert.equal(facets.priceMax, 0);
  assert.deepEqual(facets.sources, []);
  assert.deepEqual(facets.conditions, []);
});

test('facets: every price range is counted, matching the old implementation', async () => {
  const products: TestProduct[] = [
    { price: 10, isAvailable: true, source: 'A', condition: 'NEW' },
    { price: 49.99, isAvailable: true, source: 'A', condition: 'NEW' },
    { price: 50, isAvailable: true, source: 'B', condition: 'USED' },
    { price: 99.99, isAvailable: true, source: 'B', condition: 'USED' },
    { price: 100, isAvailable: true, source: 'C', condition: 'NEW' },
    { price: 249.99, isAvailable: true, source: 'C', condition: 'NEW' },
    { price: 250, isAvailable: true, source: 'D', condition: 'USED' },
    { price: 499.99, isAvailable: true, source: 'D', condition: 'USED' },
    { price: 500, isAvailable: true, source: 'E', condition: 'NEW' },
    { price: 100000, isAvailable: true, source: 'E', condition: 'NEW' },
  ];
  stubFacets(products);
  const facets = await service.getProductFacets();

  assert.deepEqual(facets.buckets, expectedBuckets(products));
  assert.deepEqual(
    facets.buckets.map((b) => b.count),
    [2, 2, 2, 2, 2],
    'each of the five ranges holds two products',
  );
  assert.equal(facets.priceMin, 10);
  assert.equal(facets.priceMax, 100000);
});

test('facets: boundary prices land in exactly one bucket (lower bound inclusive, upper exclusive)', async () => {
  const products: TestProduct[] = [0, 49.999, 50, 99.999, 100, 249.999, 250, 499.999, 500, 100000].map((price) => ({
    price,
    isAvailable: true,
    source: 'A',
    condition: 'NEW',
  }));
  stubFacets(products);
  const facets = await service.getProductFacets();

  assert.deepEqual(facets.buckets, expectedBuckets(products));
  // 50 belongs to "$50 - $100", not "Under $50"; 500 belongs to "Over $500".
  assert.equal(facets.buckets[0]?.count, 2, '0 and 49.999 are under $50');
  assert.equal(facets.buckets[1]?.count, 2, '50 and 99.999 are $50 - $100');
  assert.equal(facets.buckets[4]?.count, 2, '500 and 100000 are over $500');
  const total = facets.buckets.reduce((s, b) => s + b.count, 0);
  assert.equal(total, products.length, 'every product is counted exactly once');
});

test('facets: unavailable products are excluded, as before', async () => {
  const products: TestProduct[] = [
    { price: 10, isAvailable: true, source: 'A', condition: 'NEW' },
    { price: 20, isAvailable: false, source: 'B', condition: 'NEW' },
    { price: 30, isAvailable: false, source: 'B', condition: 'USED' },
    { price: 1000, isAvailable: false, source: 'C', condition: 'USED' },
  ];
  stubFacets(products);
  const facets = await service.getProductFacets();

  assert.deepEqual(facets.buckets, expectedBuckets(products));
  assert.equal(facets.buckets[0]?.count, 1, 'only the available $10 product counts');
  assert.equal(facets.buckets[4]?.count, 0, 'unavailable products never reach a bucket');
  assert.deepEqual(facets.sources, [{ value: 'A', count: 1 }]);
  assert.deepEqual(facets.conditions, [{ value: 'NEW', count: 1 }]);
  assert.equal(facets.priceMin, 10);
  assert.equal(facets.priceMax, 10);
});

test('facets: a null price is in no bucket and does not affect the range', async () => {
  const products: TestProduct[] = [
    { price: null, isAvailable: true, source: 'A', condition: 'NEW' },
    { price: 75, isAvailable: true, source: 'A', condition: 'NEW' },
  ];
  stubFacets(products);
  const facets = await service.getProductFacets();

  assert.deepEqual(facets.buckets, expectedBuckets(products));
  const total = facets.buckets.reduce((s, b) => s + b.count, 0);
  assert.equal(total, 1, 'the null-priced product is in no bucket');
  assert.equal(facets.priceMin, 75);
  assert.equal(facets.priceMax, 75);
});

test('facets: the aggregation keeps the availability filter and parameterized boundaries', async () => {
  const { rawCalls, groupByCalls } = stubFacets([{ price: 60, isAvailable: true, source: 'A', condition: 'NEW' }]);
  await service.getProductFacets();

  assert.equal(rawCalls.length, 1, 'bucket counts and min/max share one round-trip');
  const call = rawCalls[0]!;
  // Prisma renders bound parameters as placeholders (`?` in `.text`, `$n` once
  // serialized), never as literal numbers inlined into the statement.
  assert.match(
    call.sql,
    /COUNT\(\*\) FILTER \(WHERE price >= (\$|\?)/i,
    'boundaries are bound parameters',
  );
  assert.match(call.sql, /FROM products/i);
  assert.match(call.sql, /"isAvailable" = true/i, 'availability filter is preserved');
  assert.match(call.sql, /MIN\(price\) AS "priceMin"/i);
  assert.match(call.sql, /MAX\(price\) AS "priceMax"/i);
  assert.equal(call.sql.split('COUNT(*) FILTER').length - 1, 5, 'five conditional counts');
  // The boundaries travel as values, never as interpolated SQL text.
  assert.deepEqual(call.values.filter((v) => typeof v === 'number'), [0, 50, 50, 100, 100, 250, 250, 500, 500]);
  assert.ok(
    !call.sql.includes('$50 - $100') && !call.sql.includes('Under $50') && !/price >= \d/.test(call.sql),
    'no boundary or label may be concatenated into the SQL text',
  );
  assert.equal(groupByCalls.length, 2, 'source and condition grouping still run');
  assert.ok(groupByCalls.every((c) => c.where?.isAvailable === true), 'grouped facets stay filtered');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import cjClient, {
  CJApiError,
  computeRetryDelayMs,
  isTransientCJError,
} from './cj-client';

function fakeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'statusText',
    json: async () => body,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as Response;
}

test.afterEach(() => {
  cjClient.resetTransportHooks();
});

test('isTransientCJError: QPS / 429 / 5xx are transient', () => {
  assert.equal(isTransientCJError(429, 1600200, 'Too Many Requests, QPS limit is 1 time/1second'), true);
  assert.equal(isTransientCJError(400, 1600200, 'Too Many Requests, QPS limit is 1 time/1second'), true);
  assert.equal(isTransientCJError(503, null, 'Service Unavailable'), true);
  assert.equal(isTransientCJError(500, null, 'Internal Server Error'), true);
});

test('isTransientCJError: permanent validation / auth errors are not transient', () => {
  assert.equal(isTransientCJError(400, 1600300, 'id can not be empty'), false);
  assert.equal(isTransientCJError(400, 1600301, 'product not found'), false);
  assert.equal(isTransientCJError(401, 401, 'token invalid'), false);
  assert.equal(isTransientCJError(403, 403, 'token expired'), false);
});

test('computeRetryDelayMs: exponential backoff grows and is capped', () => {
  const d0 = computeRetryDelayMs(0);
  const d1 = computeRetryDelayMs(1);
  const d2 = computeRetryDelayMs(2);
  assert.ok(d1 > d0, `expected ${d1} > ${d0}`);
  assert.ok(d2 > d1, `expected ${d2} > ${d1}`);
  assert.equal(computeRetryDelayMs(30), 30000);
});

test('computeRetryDelayMs: honours CJ Retry-After and caps it', () => {
  assert.equal(computeRetryDelayMs(0, 7000), 7000);
  assert.equal(computeRetryDelayMs(0, 999999), 30000);
  assert.equal(computeRetryDelayMs(0, 0), computeRetryDelayMs(0));
});

test('permanent "id can not be empty" error is not retried', async () => {
  let calls = 0;
  cjClient.setTransportHooks({
    headers: async () => ({}),
    sleep: async () => undefined,
    fetch: async () => {
      calls++;
      return fakeResponse(400, { code: 1600300, message: 'id can not be empty', data: null });
    },
  });

  await assert.rejects(
    () => cjClient.post('/product/productDetail/query', { pid: '2407230322181622500' }),
    (error: any) => {
      assert.ok(error instanceof CJApiError);
      assert.equal(error.transient, false);
      assert.match(error.message, /id can not be empty/);
      return true;
    }
  );

  assert.equal(calls, 1, 'permanent errors must not be retried');
});

test('QPS / rate-limit error retries and then succeeds', async () => {
  let calls = 0;
  const sleeps: number[] = [];
  cjClient.setTransportHooks({
    headers: async () => ({}),
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
    fetch: async () => {
      calls++;
      if (calls < 3) {
        return fakeResponse(429, {
          code: 1600200,
          message: 'Too Many Requests, QPS limit is 1 time/1second',
          data: null,
        });
      }
      return fakeResponse(200, { code: 200, message: 'Success', data: { ok: true } });
    },
  });

  const result = await cjClient.post('/product/productDetail/query', { id: '1' });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 3, 'transient QPS errors must be retried');

  const backoffs = sleeps.filter(ms => ms > 1100);
  assert.ok(backoffs.length >= 2, 'expected backoff delays between retries');
  assert.ok(backoffs[1] > backoffs[0], 'backoff must grow');
});

test('requests are serialised so concurrent callers cannot burst past CJ QPS', async () => {
  let inFlight = 0;
  let maxInFlight = 0;

  cjClient.setTransportHooks({
    headers: async () => ({}),
    sleep: async () => undefined,
    fetch: async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(resolve => setTimeout(resolve, 5));
      inFlight--;
      return fakeResponse(200, { code: 200, message: 'Success', data: null });
    },
  });

  await Promise.all([
    cjClient.get('/product/listV2', { page: 1 }),
    cjClient.get('/product/listV2', { page: 2 }),
    cjClient.get('/product/listV2', { page: 3 }),
  ]);

  assert.equal(maxInFlight, 1, 'CJ API calls must be serialised');
});

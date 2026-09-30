import cjAuth from './cj-auth';
import { BadRequestError } from '../../../utils/errors';

const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';
const REQUEST_TIMEOUT_MS = 30000;
const MIN_REQUEST_INTERVAL_MS = 1100;
const MAX_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 1500;
const MAX_RETRY_DELAY_MS = 30000;

interface CJResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface CJTransportHooks {
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  headers?: () => Promise<Record<string, string>>;
  sleep?: (ms: number) => Promise<void>;
}

export class CJApiError extends BadRequestError {
  readonly status: number;
  readonly code: number | null;
  readonly transient: boolean;

  constructor(
    message: string,
    options: { status?: number; code?: number | null; transient?: boolean } = {}
  ) {
    super(message);
    this.status = options.status ?? 0;
    this.code = options.code ?? null;
    this.transient = options.transient ?? false;
  }
}

const TRANSIENT_MESSAGE_PATTERN =
  /too many requests|qps|rate.?limit|timeout|timed out|temporar|try again|internal server|bad gateway|service unavailable|network/i;

/**
 * Permanent errors (validation, auth, unknown product) must never be retried:
 * retrying them only burns CJ QPS quota and delays the whole import.
 */
export function isTransientCJError(status: number, code: number | null, message: string): boolean {
  if (status === 429 || status >= 500) return true;
  if (code === 1600200) return true;
  return TRANSIENT_MESSAGE_PATTERN.test(message || '');
}

export function computeRetryDelayMs(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs && retryAfterMs > 0) {
    return Math.min(retryAfterMs, MAX_RETRY_DELAY_MS);
  }
  const backoff = BASE_RETRY_DELAY_MS * 2 ** attempt;
  return Math.min(backoff, MAX_RETRY_DELAY_MS);
}

function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}

const defaultFetch = (url: string, init?: RequestInit): Promise<Response> => fetch(url, init);
const defaultHeaders = (): Promise<Record<string, string>> => cjAuth.getAuthHeaders();
const defaultSleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

class CJClient {
  private lastRequestTime = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private fetchImpl: NonNullable<CJTransportHooks['fetch']> = defaultFetch;
  private headersFn: NonNullable<CJTransportHooks['headers']> = defaultHeaders;
  private sleepFn: NonNullable<CJTransportHooks['sleep']> = defaultSleep;

  /** Test hook: inject a fake transport so no real CJ call is made. */
  setTransportHooks(hooks: CJTransportHooks): void {
    if (hooks.fetch) this.fetchImpl = hooks.fetch;
    if (hooks.headers) this.headersFn = hooks.headers;
    if (hooks.sleep) this.sleepFn = hooks.sleep;
  }

  resetTransportHooks(): void {
    this.fetchImpl = defaultFetch;
    this.headersFn = defaultHeaders;
    this.sleepFn = defaultSleep;
    this.lastRequestTime = 0;
    this.queue = Promise.resolve();
  }

  /**
   * CJ enforces QPS 1 req/sec account-wide. Concurrent callers must not be
   * allowed to pass the gap check at the same instant, so every request is
   * funnelled through a single promise chain and the chain is held for the
   * whole attempt (including backoff).
   */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  private async paceRequest(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await this.sleepFn(MIN_REQUEST_INTERVAL_MS - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.enqueue(() => this.requestWithRetry<T>(endpoint, options));
  }

  private async requestWithRetry<T>(endpoint: string, options: RequestInit): Promise<T> {
    let attempt = 0;

    for (;;) {
      await this.paceRequest();

      const headers = await this.headersFn();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      let response: Response;
      let body: CJResponse<T> | null = null;
      let networkFailure: Error | null = null;

      try {
        response = await this.fetchImpl(`${CJ_BASE_URL}${endpoint}`, {
          ...options,
          headers: {
            ...headers,
            ...(options.headers as Record<string, string> | undefined),
          },
          signal: controller.signal,
        });
        body = (await response.json()) as CJResponse<T>;
      } catch (error) {
        networkFailure = error as Error;
      } finally {
        clearTimeout(timeout);
      }

      if (networkFailure) {
        const isTimeout =
          networkFailure instanceof DOMException && networkFailure.name === 'AbortError';
        const error = new CJApiError(
          isTimeout ? 'CJ API request timed out' : `CJ API request failed: ${networkFailure.message}`,
          { transient: true }
        );
        if (attempt >= MAX_RETRIES) throw error;
        await this.sleepFn(computeRetryDelayMs(attempt));
        attempt++;
        continue;
      }

      const status = response!.status;
      const code = body?.code ?? null;
      const message = body?.message || response!.statusText || 'Unknown CJ error';

      if (response!.ok && code === 200) {
        return body!.data;
      }

      if (code === 401 || code === 403 || /token/i.test(message)) {
        console.warn('[CJ] Auth error, token may be invalid:', message);
      }

      const transient = isTransientCJError(status, code, message);
      const error = new CJApiError(`CJ API error: ${message}`, { status, code, transient });

      if (!transient) throw error;
      if (attempt >= MAX_RETRIES) throw error;

      const retryAfterMs = parseRetryAfterMs(response!.headers.get('retry-after'));
      await this.sleepFn(computeRetryDelayMs(attempt, retryAfterMs));
      attempt++;
    }
  }

  async get<T>(endpoint: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const query = searchParams.toString();
    return this.request<T>(`${endpoint}${query ? `?${query}` : ''}`);
  }

  async post<T>(endpoint: string, body: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}

export default new CJClient();

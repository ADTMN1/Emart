import { NextFunction, Request, Response } from 'express';

/** Short-lived browser/CDN cache for public catalog reads. */
export const PUBLIC_CACHE = 'public, max-age=60, stale-while-revalidate=300';

/** App-wide default: never store responses (set globally in server.ts). */
export const NO_STORE_CACHE = 'no-cache, no-store, must-revalidate';

/**
 * Marks the current response as a publicly cacheable catalog read. Must run
 * after same-route validation/guards so 4xx responses never carry the public
 * policy, and after the global no-store middleware so it can override it.
 * Non-2xx responses thrown later are re-locked to no-store by the error and
 * not-found handlers. GET-only by construction (matched per GET route).
 */
export function setPublicCache(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', PUBLIC_CACHE);
  res.removeHeader('Pragma');
  res.removeHeader('Expires');
  res.removeHeader('Surrogate-Control');
  next();
}

/** Restores the private no-store policy (for error/not-found responses). */
export function resetPrivateCache(res: Response): void {
  res.setHeader('Cache-Control', NO_STORE_CACHE);
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
}
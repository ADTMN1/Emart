import { Request, Response, NextFunction } from 'express';
import { TooManyRequestsError } from '../utils/errors';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Temporarily disable rate limiting when troubleshooting authentication.
// Set RATE_LIMIT_DISABLED=true in your environment to turn rate limiting off.
const RATE_LIMIT_DISABLED = (process.env.RATE_LIMIT_DISABLED || '').toLowerCase() === 'true';

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 10 * 60 * 1000);

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max number of requests per window
  message?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Rate limiting middleware
 * @param options - Rate limit configuration
 */
export const rateLimit = (options: RateLimitOptions) => {
  if (RATE_LIMIT_DISABLED) {
    // No-op middleware when disabled to avoid blocking auth attempts.
    return (_req: Request, _res: Response, next: NextFunction): void => next();
  }

  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    keyGenerator = (req: Request) => {
      // Use IP address as default key
      return req.ip || req.connection.remoteAddress || 'unknown';
    },
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    if (!store[key] || store[key].resetTime < now) {
      // Initialize or reset the counter
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    store[key].count++;

    if (store[key].count > max) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      throw new TooManyRequestsError(message);
    }

    next();
  };
};

// Predefined rate limiters for common scenarios
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  keyGenerator: (req: Request) => {
    // Rate limit by IP and email combination for auth endpoints
    const email = req.body.email || '';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `${ip}:${email}`;
  },
});

export const strictAuthRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many failed login attempts. Please try again in 1 hour or reset your password.',
  keyGenerator: (req: Request) => {
    const email = req.body.email || '';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `strict:${ip}:${email}`;
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many API requests. Please slow down.',
});

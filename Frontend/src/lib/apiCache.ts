/**
 * Simple in-memory API cache with TTL support
 * Prevents duplicate requests and provides instant cached responses
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

interface CacheOptions {
  /** Time to live in milliseconds */
  ttl?: number
  /** Force fresh data (bypass cache) */
  force?: boolean
}

class ApiCache {
  private cache = new Map<string, CacheEntry<any>>()
  private pendingRequests = new Map<string, Promise<any>>()
  
  // Default TTLs for different data types
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly STATIC_TTL = 30 * 60 * 1000 // 30 minutes (categories, etc)
  private readonly SHORT_TTL = 60 * 1000 // 1 minute

  /**
   * Get data from cache or fetch it
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const { ttl = this.DEFAULT_TTL, force = false } = options

    // Check cache first (unless force refresh)
    if (!force) {
      const cached = this.cache.get(key)
      if (cached && Date.now() < cached.expiresAt) {
        return cached.data as T
      }
    }

    // Check if there's already a pending request for this key
    const pending = this.pendingRequests.get(key)
    if (pending) {
      return pending as Promise<T>
    }

    // Create new request
    const request = fetcher()
      .then((data) => {
        this.set(key, data, ttl)
        this.pendingRequests.delete(key)
        return data
      })
      .catch((error) => {
        this.pendingRequests.delete(key)
        throw error
      })

    this.pendingRequests.set(key, request)
    return request
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    })
  }

  /**
   * Get cached data without fetching
   */
  getCached<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T
    }
    return null
  }

  /**
   * Check if cache has valid data
   */
  has(key: string): boolean {
    const cached = this.cache.get(key)
    return !!cached && Date.now() < cached.expiresAt
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key)
    this.pendingRequests.delete(key)
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
    for (const key of this.pendingRequests.keys()) {
      if (regex.test(key)) {
        this.pendingRequests.delete(key)
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
    this.pendingRequests.clear()
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get TTL constants for specific data types
   */
  get ttl() {
    return {
      DEFAULT: this.DEFAULT_TTL,
      STATIC: this.STATIC_TTL,
      SHORT: this.SHORT_TTL,
      NONE: 0,
    }
  }
}

// Export singleton instance
export const apiCache = new ApiCache()

// Auto cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => apiCache.cleanup(), 5 * 60 * 1000)
}

/**
 * Generate cache key from endpoint and params
 */
export function getCacheKey(endpoint: string, params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) {
    return endpoint
  }
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&')
  return `${endpoint}?${sortedParams}`
}

/**
 * Cache configuration for different endpoints
 */
export const cacheConfig = {
  // Static data (changes rarely)
  categories: { ttl: 30 * 60 * 1000 }, // 30 minutes
  
  // Semi-static data
  products: { ttl: 5 * 60 * 1000 }, // 5 minutes
  productDetails: { ttl: 5 * 60 * 1000 }, // 5 minutes
  
  // Dynamic data (short cache)
  cart: { ttl: 30 * 1000 }, // 30 seconds
  
  // Never cache sensitive data
  auth: { ttl: 0 },
  profile: { ttl: 0 },
  orders: { ttl: 0 },
  wallet: { ttl: 0 },
  checkout: { ttl: 0 },
  payment: { ttl: 0 },
}

import { apiCache, getCacheKey, cacheConfig } from './apiCache'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '') + '/api/v1';

/** Requests that take longer than this are aborted so pages never hang on a silent backend. */
const REQUEST_TIMEOUT_MS = 30000;

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface FetchOptions extends RequestInit {
  useCache?: boolean
  cacheTTL?: number
}

/** Admin product/image endpoints are mounted directly under /products; seller ones under /seller/products. */
const productScopePrefix = (scope: 'admin' | 'seller'): string => (scope === 'seller' ? '/seller' : '');

export async function apiFetch<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { useCache = false, cacheTTL, ...fetchOptions } = options
  const token = localStorage.getItem('emart_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedEndpoint}`;

  // Use cache for GET requests if enabled
  if (useCache && fetchOptions.method === 'GET') {
    const cacheKey = getCacheKey(endpoint)
    return apiCache.get(cacheKey, async () => {
      return performFetch<T>(url, fetchOptions, headers)
    }, { ttl: cacheTTL })
  }

  return performFetch<T>(url, fetchOptions, headers)
}

async function performFetch<T>(
  url: string,
  options: RequestInit,
  headers: Record<string, string>
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        data.message || data.error || (Array.isArray(data.errors) ? data.errors.map((e: any) => e.msg || e.message).join(', ') : 'Request failed');
      throw new ApiError(errorMessage, response.status, data);
    }

    // Backend responds with { success: true, data: ..., message: ... }
    return data.data !== undefined ? data.data : data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('The request timed out. Please check your connection and try again.', 0);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      (error as Error).message || 'Unable to connect to the server. Please check your connection.',
      0
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T = any>(endpoint: string, options?: FetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),
  post: <T = any>(endpoint: string, body?: any, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    }),
  put: <T = any>(endpoint: string, body?: any, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  patch: <T = any>(endpoint: string, body?: any, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: <T = any>(endpoint: string, options?: FetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
};

async function importRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('emart_token');
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.message || data.error || 'Request failed', response.status, data);
  return data.data !== undefined ? data.data : data;
}

export type ImportRunStatus = 'PROCESSING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED';
export type ImportRowStatus = 'VALID' | 'WARNING' | 'ERROR' | 'CREATED' | 'WARNING_CREATED' | 'UPDATED' | 'WARNING_UPDATED' | 'FAILED';
export interface ImportRowResult { rowNumber: number; rawSku?: string; sku?: string; status: ImportRowStatus; productId?: string; imagesUploaded?: number; errors: string[]; warnings: string[]; }
export interface CsvValidationResult { totalRows: number; validRows: number; warningRows: number; errorRows: number; rows: ImportRowResult[]; }
export interface ImportRunSummary { id: string; filename: string; mode: string; status: ImportRunStatus | string; totalRows: number; successRows: number; warningRows: number; errorRows: number; createdAt: string; completedAt: string | null; }
export interface ImportRunDetail extends ImportRunSummary { rowResults: ImportRowResult[]; sourceRows?: unknown[]; }
export interface ImportResult { runId: string; status: ImportRunStatus | 'PROCESSING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED'; totalRows: number; successRows: number; warningRows: number; errorRows: number; createdProducts: number; updatedProducts: number; rowResults: ImportRowResult[]; imagesUploaded?: number; imagesSkipped?: number; imagesInvalid?: number; imageWarnings?: string[]; message?: string; }

export const productImportApi = {
  downloadTemplate: async (): Promise<Blob> => {
    const token = localStorage.getItem('emart_token');
    const response = await fetch(`${API_BASE_URL}/products/import/template`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(data.message || data.error || 'Could not download the CSV template', response.status, data);
    }
    return response.blob();
  },
  validate: (file: File) => { const formData = new FormData(); formData.append('file', file); return importRequest<CsvValidationResult>('/products/import/validate', { method: 'POST', body: formData }); },
  importCsv: async (file: File, imagesZip?: File) => {
    const formData = new FormData();
    formData.append('file', file);
    if (imagesZip) formData.append('imagesZip', imagesZip);
    const result = await importRequest<ImportResult | { runId: string; status: 'PROCESSING'; message: string }>(
      '/products/import',
      { method: 'POST', body: formData }
    );

    if (result && typeof result === 'object' && 'status' in result && result.status === 'PROCESSING') {
      const accepted = result as { runId: string; status: string; message?: string };
      return {
        runId: accepted.runId,
        status: 'PROCESSING',
        totalRows: 0,
        successRows: 0,
        warningRows: 0,
        errorRows: 0,
        createdProducts: 0,
        updatedProducts: 0,
        rowResults: [],
        message: accepted.message || 'Import accepted and processing in the background.',
      } as ImportResult;
    }

    return result as ImportResult;
  },
  getHistory: (page = 1, limit = 20) => api.get<{ items: ImportRunSummary[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/products/import/history?page=${page}&limit=${limit}`),
  getRun: (runId: string) => api.get<ImportRunDetail>(`/products/import/${runId}`),
  retryFailedRows: (runId: string) => api.post<ImportResult>(`/products/import/${runId}/retry`),
};

// Cached API calls for static/semi-static data
export const cachedApi = {
  getCategories: () => 
    api.get('/categories', { useCache: true, cacheTTL: cacheConfig.categories.ttl }),
  
  getProducts: (params?: Record<string, string>) => {
    const endpoint = params && Object.keys(params).length > 0
      ? `/products?${new URLSearchParams(params).toString()}`
      : '/products'
    return api.get(endpoint, { useCache: true, cacheTTL: cacheConfig.products.ttl })
  },

  /** Distinct sources/conditions/price buckets for the marketplace sidebar. */
  getFacets: () =>
    api.get('/products/facets', { useCache: true, cacheTTL: cacheConfig.categories.ttl }),
  
  getProduct: (id: string) =>
    api.get(`/products/${id}`, { useCache: true, cacheTTL: cacheConfig.productDetails.ttl }),

  /**
   * The authenticated user's cart. User-scoped cache key so one user can
   * never read another user's cart, and the key stays stable across all
   * consumers (cart context, cart page, checkout) so concurrent mounts
   * share a single in-flight request. Fail-open to null like the callers
   * it replaces.
   */
  getCart: (userId?: string) => {
    const key = userId ? `/cart?userId=${encodeURIComponent(userId)}` : '/cart'
    return apiCache.get<any>(
      key,
      () => api.get<any>('/cart').catch(() => null),
      { ttl: cacheConfig.cart.ttl },
    )
  },
}

/**
 * Fetch the current authenticated user's profile. Routed through apiCache
 * with TTL 0 so concurrent callers (AuthProvider init + OAuth AuthCallback)
 * share ONE in-flight request while a fresh profile is always returned —
 * the result is never served stale from the cache.
 */
export const getAuthProfile = <T = any>(): Promise<T> =>
  apiCache.get('/auth/profile', () => api.get<T>('/auth/profile'), { ttl: 0 })

// Cache invalidation helpers
export const invalidateCache = {
  products: () => apiCache.invalidatePattern(/^\/products/),
  categories: () => apiCache.invalidate('/categories'),
  product: (id: string) => apiCache.invalidate(`/products/${id}`),
  cart: () => apiCache.invalidatePattern(/^\/cart/),
  all: () => apiCache.clear(),
}

// Product rating API (real user ratings, 1-5 stars)
export const ratingApi = {
  /** Create or update the signed-in user's rating for a product. */
  rate: (productId: string, rating: number) =>
    api.post<{
      id: string
      productId: string
      rating: number
      average: number
      count: number
      isNew: boolean
    }>(`/products/${productId}/rating`, { rating }),

  /** All of the signed-in user's ratings, keyed by productId. */
  getMyRatings: () => api.get<{ ratings: Record<string, number> }>('/products/my-ratings'),

  /** The signed-in user's rating for a single product (null when unrated). */
  getMyRatingFor: (productId: string) =>
    api.get<{ rating: number | null }>(`/products/${productId}/my-rating`),
}

// Product Image API
export const productImageApi = {
  /**
   * Get all images for a product
   */
  getProductImages: async (productId: string) => {
    return api.get<Array<{
      id: string;
      productId: string;
      path: string;
      url: string;
      isPrimary: boolean;
      sortOrder: number;
      createdAt: string;
    }>>(`/products/${productId}/images`);
  },

  /**
   * Upload a new product image (admin, or seller for own products)
   */
  uploadProductImage: async (productId: string, file: File, scope: 'admin' | 'seller' = 'admin') => {
    const token = localStorage.getItem('emart_token');
    const formData = new FormData();
    formData.append('image', file);

    const normalizedEndpoint = `${productScopePrefix(scope)}/products/${productId}/images`;
    const url = `${API_BASE_URL}${normalizedEndpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        data.message || data.error || 'Upload failed';
      throw new ApiError(errorMessage, response.status, data);
    }

    return data.data !== undefined ? data.data : data;
  },

  /**
   * Delete a product image (admin, or seller for own products)
   */
  deleteProductImage: async (productId: string, imageId: string, scope: 'admin' | 'seller' = 'admin') => {
    return api.delete(`${productScopePrefix(scope)}/products/${productId}/images/${imageId}`);
  },

  /**
   * Set an image as primary (admin, or seller for own products)
   */
  setPrimaryImage: async (productId: string, imageId: string, scope: 'admin' | 'seller' = 'admin') => {
    return api.put(`${productScopePrefix(scope)}/products/${productId}/images/${imageId}/primary`);
  },

  /**
   * Reorder product images (admin, or seller for own products)
   */
  reorderImages: async (productId: string, imageOrders: Array<{ id: string; sortOrder: number }>, scope: 'admin' | 'seller' = 'admin') => {
    return api.put(`${productScopePrefix(scope)}/products/${productId}/images/reorder`, { imageOrders });
  },
};

// Seller Product API (Phase 6 — seller-owned product management)
export const sellerProductApi = {
  list: (params: { page?: number; limit?: number; search?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.search) qs.set('search', params.search);
    if (params.status && params.status !== 'all') qs.set('status', params.status);
    const query = qs.toString();
    return api.get<{
      products: Array<{
        id: string;
        sku: string | null;
        name: string;
        description: string;
        price: number;
        estimatedPriceUsd: number;
        condition: string;
        seller: string;
        sellerType: string;
        source: string;
        domesticShipping: number;
        internationalShippingUsd: number;
        serviceFee: number;
        tags: string[];
        isNew: boolean;
        isBestSeller: boolean;
        stock: number;
        isAvailable: boolean;
        categoryId: string;
        category: { id: string; name: string } | null;
        createdAt: string;
        updatedAt: string;
        productImages: Array<{ id: string; url: string; isPrimary: boolean }>;
      }>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/seller/products${query ? `?${query}` : ''}`);
  },

  get: (productId: string) => api.get<any>(`/seller/products/${productId}`),

  create: (payload: Record<string, unknown>) =>
    api.post<any>('/seller/products', payload),

  update: (productId: string, payload: Record<string, unknown>) =>
    api.put<any>(`/seller/products/${productId}`, payload),

  delete: (productId: string) => api.delete(`/seller/products/${productId}`),
};

// -------------------------------------------------------------------
// Phase 8: EMART Seller Agreement — server-controlled version + text.
// -------------------------------------------------------------------

export interface SellerAgreement {
  title: string;
  version: string;
  text: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  accepted: boolean;
}

export interface SellerAgreementAcceptance {
  accepted: boolean;
  version: string;
  acceptedAt: string;
}

export const sellerAgreementApi = {
  get: () => api.get<SellerAgreement>('/seller/agreement'),

  accept: (): Promise<SellerAgreementAcceptance> =>
    api.post<SellerAgreementAcceptance>('/seller/agreement/accept', {}),
};

// -------------------------------------------------------------------
// "Become a Seller" application — multipart submit + admin document access.
// The identity document is uploaded as multipart/form-data; the backend
// stores it privately and only ever returns a short-lived signed URL to admins.
// -------------------------------------------------------------------

export interface SellerApplicationSubmitInput {
  shopName: string;
  email: string;
  emergencyContact?: string;
  address: string;
  idDocument: File;
}

export interface SellerApplicationRecord {
  id: string;
  storeName: string;
  storeDescription: string;
  email: string;
  emergencyContact?: string | null;
  address: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  rejectionReason?: string | null;
  submittedAt?: string;
  reviewedAt?: string | null;
  hasIdDocument?: boolean;
}

/**
 * POST a multipart form with real upload progress, reported as a percentage
 * (0–100). Uses XHR because fetch offers no upload-progress events. A network
 * failure surfaces as an ApiError with status 0 so the UI can distinguish
 * "the file never made it" from "the server rejected the request".
 */
function postFormWithProgress(
  url: string,
  formData: FormData,
  token: string | null,
  onProgress?: (percent: number) => void,
): Promise<{ ok: boolean; status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.responseType = 'text';
    xhr.timeout = 120_000;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let data: any = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        data = {};
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };
    xhr.onerror = () =>
      reject(
        new ApiError(
          "We couldn't upload your ID document. Please check your connection and try again.",
          0,
        ),
      );
    xhr.onabort = () => reject(new ApiError('Upload was cancelled.', 0));
    xhr.ontimeout = () =>
      reject(new ApiError('Upload timed out. Please check your connection and try again.', 0));

    xhr.send(formData);
  });
}

async function submitSellerApplication(
  endpoint: string,
  input: SellerApplicationSubmitInput,
  onProgress?: (percent: number) => void,
): Promise<SellerApplicationRecord> {
  const token = localStorage.getItem('emart_token');
  const formData = new FormData();
  formData.append('storeName', input.shopName);
  formData.append('email', input.email);
  if (input.emergencyContact) formData.append('emergencyContact', input.emergencyContact);
  formData.append('address', input.address);
  formData.append('idDocument', input.idDocument);

  const { ok, status, data } = await postFormWithProgress(`${API_BASE_URL}${endpoint}`, formData, token, onProgress);

  if (!ok) {
    const message =
      data.message ||
      data.error ||
      (Array.isArray(data.errors) ? data.errors.map((e: any) => e.msg || e.message).join(', ') : 'Submission failed');
    throw new ApiError(message, status, data);
  }
  return data.data !== undefined ? data.data : data;
}

export const sellerApplicationApi = {
  submit: (input: SellerApplicationSubmitInput, onProgress?: (percent: number) => void) =>
    submitSellerApplication('/seller/application', input, onProgress),

  resubmit: (input: SellerApplicationSubmitInput, onProgress?: (percent: number) => void) =>
    submitSellerApplication('/seller/application/resubmit', input, onProgress),

  get: () => api.get<SellerApplicationRecord | null>('/seller/application'),

  /** Admin-only: fetch a short-lived signed URL for the identity document. */
  getDocumentUrl: (applicationId: string) =>
    api.get<{ url: string; expiresIn: number }>(
      `/admin/sellers/applications/${applicationId}/document`,
    ),
};

// -------------------------------------------------------------------
// Order API
// -------------------------------------------------------------------

export interface OrderStats {
  totalOrders: number;
  inWarehouseOrders: number;
  inTransitOrders: number;
  totalSpent: number;
  estimatedSavings: number;
}

export const orderApi = {
  getStats: () => api.get<OrderStats>('/orders/stats'),
};

// -------------------------------------------------------------------
// Seller storefront media (shop logo + banner). The backend stores the
// public image in the shop-media bucket and returns the updated profile;
// the private storage path never leaves the server.
// -------------------------------------------------------------------

export type SellerShopMediaKind = 'logo' | 'banner';

/** Multipart upload helper for shop media — never JSON. */
async function uploadShopMedia(kind: SellerShopMediaKind, file: File): Promise<SellerProfileStatus> {
  const token = localStorage.getItem('emart_token');
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${API_BASE_URL}/seller/profile/${kind}`, {
    method: 'PUT',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data.message ||
      data.error ||
      (Array.isArray(data.errors) ? data.errors.map((e: any) => e.msg || e.message).join(', ') : 'Upload failed');
    throw new ApiError(message, response.status, data);
  }
  return data.data !== undefined ? data.data : data;
}

export const sellerShopMediaApi = {
  uploadLogo: (file: File) => uploadShopMedia('logo', file),
  removeLogo: () => api.delete<SellerProfileStatus>('/seller/profile/logo'),
  uploadBanner: (file: File) => uploadShopMedia('banner', file),
  removeBanner: () => api.delete<SellerProfileStatus>('/seller/profile/banner'),
};

// -------------------------------------------------------------------
// Seller sales report — store-scoped aggregation of the seller's own
// order lines. The window is inclusive; the backend defaults to the last
// 30 days and caps the length, and it always resolves the seller from the
// authenticated user (no sellerId is ever sent from the client).
// -------------------------------------------------------------------

export interface SellerSalesRangeParams {
  /** Inclusive ISO date (YYYY-MM-DD). Defaults to 30 days ago server-side. */
  startDate?: string;
  /** Inclusive ISO date (YYYY-MM-DD). Defaults to today server-side. */
  endDate?: string;
}

export interface SellerSalesSummary {
  revenue: number;
  serviceFees: number;
  shippingCharges: number;
  netEarnings: number;
  itemsSold: number;
  orderCount: number;
  averageOrderValue: number;
  paidRevenue: number;
  pendingRevenue: number;
  excludedOrders: number;
  excludedRevenue: number;
}

export interface SellerSalesPoint {
  date: string;
  revenue: number;
  netEarnings: number;
  orders: number;
  units: number;
}

export interface SellerSalesProduct {
  productId: string;
  name: string;
  image: string | null;
  unitsSold: number;
  revenue: number;
  orderCount: number;
}

export interface SellerSalesOrder {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  revenue: number;
  items: number;
  units: number;
}

export interface SellerSalesReport {
  storeName: string;
  currency: string;
  /** Inclusive window as YYYY-MM-DD day keys. */
  range: { startDate: string; endDate: string; days: number };
  summary: SellerSalesSummary;
  previous: { revenue: number; orderCount: number };
  /** null = no prior period to compare against, so no percentage is claimed. */
  change: { revenuePercent: number | null; orderPercent: number | null };
  series: SellerSalesPoint[];
  topProducts: SellerSalesProduct[];
  recentOrders: SellerSalesOrder[];
}

export const sellerSalesApi = {
  report: (params: SellerSalesRangeParams = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const suffix = query.toString();
    return api.get<SellerSalesReport>(`/seller/sales${suffix ? `?${suffix}` : ''}`);
  },
};

// -------------------------------------------------------------------
// Shared seller-status lookup — ONE cached/deduped result reused by the
// login redirect decision (isApprovedSeller) and by the Seller Center /
// Account seller layouts. Both endpoints are fetched in parallel through
// apiCache: concurrent callers share a single in-flight request and the
// result is cached briefly, so the Seller Center mount reuses what login
// just fetched instead of issuing a second pair of requests.
// -------------------------------------------------------------------

export const SELLER_STATUS_CACHE_TTL = 60_000;

/** /seller/profile record returned by the backend for the current user. */
export interface SellerProfileStatus {
  id: string;
  userId: string;
  storeName: string;
  storeDescription: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
}

/**
 * Both seller lookups, as settled results so callers can tell a confirmed
 * "no account" (fulfilled with null) apart from a failed request (rejected),
 * and can individually consume or ignore each slice.
 */
export interface SellerStatusResult {
  profile: PromiseSettledResult<SellerProfileStatus | null>;
  application: PromiseSettledResult<SellerApplicationRecord | null>;
}

/**
 * Decode the current user's id from the JWT we hold in localStorage. Used to
 * SCOPE the seller-status cache per user so an old account's result is never
 * reused by — or shown to — a different account in the same tab/session.
 */
const getCurrentUserId = (): string | null => {
  const token = localStorage.getItem('emart_token');
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = decodeUriComponentSafe(payload);
    if (decoded && typeof decoded.id === 'string') return decoded.id;
    return decoded && typeof decoded.sub === 'string' ? decoded.sub : null;
  } catch {
    return null;
  }
};

/** Base64URL-decode a JWT payload segment into an object (failure-safe). */
const decodeUriComponentSafe = (payload: string): Record<string, unknown> | null => {
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      Array.from(atob(padded), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

/** User-scoped seller-status cache key so accounts never share a result. */
const SELLER_STATUS_KEY = (): string => {
  const userId = getCurrentUserId();
  return userId ? `/seller/status:${userId}` : '/seller/status';
};

/** True when a DEFINITIVE seller-status result is already cached for the CURRENT user. */
export const sellerStatusIsCached = (): boolean => {
  const cached = apiCache.getCached<SellerStatusResult>(SELLER_STATUS_KEY());
  return cached !== null;
};

/** In-flight dedupe map (per user) shared by login's redirect check and the Seller Center mount. */
const sellerStatusInFlight = new Map<string, Promise<SellerStatusResult>>();

/**
 * Fetch the current user's seller status once. Gets /seller/profile and
 * /seller/application in PARALLEL, deduped across concurrent callers and
 * cached via apiCache — but ONLY when the lookup is DEFINITIVE (both requests
 * fulfilled). A request-level failure is returned to the caller yet NEVER
 * cached, so a transient error right after login can't poison the layout's
 * next mount (which would produce the "refresh fixes it" symptom). The cache
 * is also scoped to the current user, so logging out and another user logging
 * in never reuses a stale result. Pass { force: true } to bypass cache/dedupe.
 */
export const getSellerStatus = (opts?: { force?: boolean }): Promise<SellerStatusResult> => {
  const key = SELLER_STATUS_KEY();

  if (!opts?.force) {
    const cached = apiCache.getCached<SellerStatusResult>(key);
    if (cached) return Promise.resolve(cached);
  }

  const inFlight = sellerStatusInFlight.get(key);
  if (inFlight && !opts?.force) return inFlight;

  const request = (async (): Promise<SellerStatusResult> => {
    const [profile, application] = await Promise.allSettled([
      api.get<SellerProfileStatus | null>('/seller/profile'),
      api.get<SellerApplicationRecord | null>('/seller/application'),
    ]);
    const result: SellerStatusResult = { profile, application };
    if (!opts?.force) {
      sellerStatusInFlight.delete(key);
      if (profile.status === 'fulfilled' && application.status === 'fulfilled') {
        apiCache.set(key, result, SELLER_STATUS_CACHE_TTL);
      }
    } else {
      sellerStatusInFlight.delete(key);
    }
    return result;
  })();

  sellerStatusInFlight.set(key, request);
  return request;
};

// Favorites API
export const favoritesApi = {
  /**
   * Get all user favorites
   */
  getFavorites: async () => {
    return api.get<{
      favorites: Array<{
        id: string;
        productId: string;
        createdAt: string;
        product: any;
      }>;
      count: number;
    }>('/favorites');
  },

  /**
   * Get favorites count
   */
  getFavoritesCount: async () => {
    return api.get<{ count: number }>('/favorites/count');
  },

  /**
   * Get favorite product IDs
   */
  getFavoriteIds: async () => {
    return api.get<{ productIds: string[] }>('/favorites/ids');
  },

  /**
   * Add product to favorites
   */
  addFavorite: async (productId: string) => {
    return api.post('/favorites', { productId });
  },

  /**
   * Remove product from favorites
   */
  removeFavorite: async (productId: string) => {
    return api.delete(`/favorites/${productId}`);
  },

  /**
   * Toggle favorite status
   */
  toggleFavorite: async (productId: string) => {
    return api.post<{ message: string; isFavorite: boolean }>('/favorites/toggle', { productId });
  },
};

// -------------------------------------------------------------------
// Phase 7: Admin ↔ Seller order-messaging + in-app notifications
// -------------------------------------------------------------------

export interface AdminSellerProfile {
  id: string;
  storeName: string;
}

export interface AdminConversationSummary {
  id: string;
  sellerId: string;
  seller: AdminSellerProfile;
  lastMessage: { id: string; body: string; senderUserId: string; createdAt: string } | null;
  unreadCount: number;
}

export interface AdminOrderConversations {
  order: { id: string; orderNumber: string; status: string };
  sellers: AdminSellerProfile[];
  conversations: AdminConversationSummary[];
}

export interface ThreadMessage {
  id: string;
  body: string;
  senderUserId: string;
  senderRole: 'admin' | 'seller';
  senderName: string;
  readAt: string | null;
  createdAt: string;
}

export interface ThreadPayload {
  conversation: { id: string };
  order: { id: string; orderNumber: string; status: string } | null;
  seller: AdminSellerProfile | null;
  messages: ThreadMessage[];
  unreadCount: number;
}

export interface SellerConversationSummary {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  updatedAt: string;
  lastMessage: { id: string; body: string; fromSeller: boolean; createdAt: string } | null;
  unreadCount: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  orderId: string | null;
  conversationId: string | null;
  messageId: string | null;
  /**
   * Support-thread entity ids. Optional because a notification only carries
   * these when `type` is `SUPPORT_MESSAGE`; older payloads (and non-support
   * types) omit them entirely, so every consumer must null-check before
   * building a deep link.
   */
  supportConversationId?: string | null;
  supportMessageId?: string | null;
  shipmentId?: string | null;
  /**
   * Order-request decision state: `PENDING` | `ACCEPTED` | `DECLINED`.
   *
   * Only present on `ORDER_REQUEST` notifications (the row IS the request
   * record). Optional because every other type omits it — consumers must
   * null-check. Independent of `readAt`: a request can be read yet still
   * PENDING.
   */
  requestStatus?: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null;
  /** When the seller accepted/declined the request. Null while undecided. */
  requestRespondedAt?: string | null;
  readAt: string | null;
  createdAt: string;
}

export const messageApi = {
  // --- Admin (mounted under /admin, envelope-rewritten to absolute paths) ---
  adminConversations: (orderId: string) =>
    api.get<AdminOrderConversations>(`/admin/orders/${orderId}/conversations`),

  adminEnsureConversation: (orderId: string, sellerId: string) =>
    api.post<{ id: string; orderId: string; orderNumber: string; seller: AdminSellerProfile }>(`/admin/orders/${orderId}/conversations`, { sellerId }),

  adminMessages: (conversationId: string) =>
    api.get<ThreadPayload>(`/admin/conversations/${conversationId}/messages`),

  adminSendMessage: (conversationId: string, body: string) =>
    api.post<ThreadMessage>(`/admin/conversations/${conversationId}/messages`, { body }),

  adminMarkRead: (conversationId: string) =>
    api.patch<{ updated: number }>(`/admin/conversations/${conversationId}/read`),

  // --- Seller (mounted under /seller) ---
  sellerConversations: (params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return api.get<{
      conversations: SellerConversationSummary[];
      pagination: PaginationInfo;
    }>(`/seller/conversations${query ? `?${query}` : ''}`);
  },

  sellerMessages: (conversationId: string) =>
    api.get<ThreadPayload>(`/seller/conversations/${conversationId}/messages`),

  sellerSendMessage: (conversationId: string, body: string) =>
    api.post<ThreadMessage>(`/seller/conversations/${conversationId}/messages`, { body }),

  sellerMarkRead: (conversationId: string) =>
    api.patch<{ updated: number }>(`/seller/conversations/${conversationId}/read`),
};

// -------------------------------------------------------------------
// Support Chat API (Customer ↔ Admin)
// -------------------------------------------------------------------

export interface SupportConversationSummary {
  id: string;
  subject: string;
  status: 'OPEN' | 'CLOSED' | 'RESOLVED';
  updatedAt: string;
  createdAt: string;
  lastMessage: {
    id: string;
    body: string;
    fromAdmin: boolean;
    createdAt: string;
    readAt: string | null;
  } | null;
  unreadCount: number;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface SupportConversationDetail {
  id: string;
  subject: string;
  status: 'OPEN' | 'CLOSED' | 'RESOLVED';
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessage {
  id: string;
  body: string;
  senderUserId: string;
  senderRole: 'admin' | 'customer';
  senderName: string;
  isOwn: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface SupportConversationPayload {
  conversation: SupportConversationDetail;
  messages: SupportMessage[];
  unreadCount: number;
}

export const supportApi = {
  listConversations: (params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return api.get<{
      conversations: SupportConversationSummary[];
      pagination: PaginationInfo;
    }>(`/support/conversations${query ? `?${query}` : ''}`);
  },

  getOrCreateConversation: (subject?: string) =>
    api.post<SupportConversationSummary>(`/support/conversations`, { subject }),

  getMessages: (conversationId: string) =>
    api.get<SupportConversationPayload>(`/support/conversations/${conversationId}/messages`),

  sendMessage: (conversationId: string, body: string) =>
    api.post<SupportMessage>(`/support/conversations/${conversationId}/messages`, { body }),

  markRead: (conversationId: string) =>
    api.patch<{ updated: number }>(`/support/conversations/${conversationId}/read`),

  // Admin endpoints
  adminListConversations: (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const query = qs.toString();
    return api.get<{
      conversations: SupportConversationSummary[];
      pagination: PaginationInfo;
    }>(`/support/admin/conversations${query ? `?${query}` : ''}`);
  },

  adminGetMessages: (conversationId: string) =>
    api.get<SupportConversationPayload>(`/support/admin/conversations/${conversationId}/messages`),

  adminSendMessage: (conversationId: string, body: string) =>
    api.post<SupportMessage>(`/support/admin/conversations/${conversationId}/messages`, { body }),

  adminMarkRead: (conversationId: string) =>
    api.patch<{ updated: number }>(`/support/admin/conversations/${conversationId}/read`),

  adminUpdateStatus: (conversationId: string, status: 'OPEN' | 'CLOSED' | 'RESOLVED') =>
    api.patch(`/support/admin/conversations/${conversationId}/status`, { status }),
};

export const notificationApi = {
  list: (params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return api.get<{
      notifications: NotificationItem[];
      unreadCount: number;
      pagination: PaginationInfo;
    }>(`/notifications${query ? `?${query}` : ''}`);
  },

  unreadCount: async (): Promise<number> => {
    const res = await api.get<{ unreadCount: number }>('/notifications/unread-count');
    return res.unreadCount ?? 0;
  },

  markRead: (id: string) => api.patch<{ updated: number }>(`/notifications/${id}/read`),

  markAllRead: () => api.patch<{ updated: number }>('/notifications/read-all'),
};

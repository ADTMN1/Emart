import { apiCache, getCacheKey, cacheConfig } from './apiCache'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '') + '/api/v1';

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
  try {
    const response = await fetch(url, {
      ...options,
      headers,
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
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      (error as Error).message || 'Unable to connect to the server. Please check your connection.',
      0
    );
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
  
  getProduct: (id: string) =>
    api.get(`/products/${id}`, { useCache: true, cacheTTL: cacheConfig.productDetails.ttl }),
}

// Cache invalidation helpers
export const invalidateCache = {
  products: () => apiCache.invalidatePattern(/^\/products/),
  categories: () => apiCache.invalidate('/categories'),
  product: (id: string) => apiCache.invalidate(`/products/${id}`),
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
   * Upload a new product image (admin only)
   */
  uploadProductImage: async (productId: string, file: File) => {
    const token = localStorage.getItem('emart_token');
    const formData = new FormData();
    formData.append('image', file);

    const normalizedEndpoint = `/products/${productId}/images`;
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
   * Delete a product image (admin only)
   */
  deleteProductImage: async (productId: string, imageId: string) => {
    return api.delete(`/products/${productId}/images/${imageId}`);
  },

  /**
   * Set an image as primary (admin only)
   */
  setPrimaryImage: async (productId: string, imageId: string) => {
    return api.put(`/products/${productId}/images/${imageId}/primary`);
  },

  /**
   * Reorder product images (admin only)
   */
  reorderImages: async (productId: string, imageOrders: Array<{ id: string; sortOrder: number }>) => {
    return api.put(`/products/${productId}/images/reorder`, { imageOrders });
  },
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

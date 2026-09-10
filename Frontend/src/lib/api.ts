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

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('emart_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  const url = `${API_BASE_URL}${normalizedEndpoint}`;

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
  get: <T = any>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),
  post: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    }),
  put: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: <T = any>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
};

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
  reorderImages: async (productId: string, imageIds: string[]) => {
    return api.put(`/products/${productId}/images/reorder`, { imageIds });
  },
};

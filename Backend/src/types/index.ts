import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ProductFilters {
  category?: string;
  source?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  tags?: string[];
  status?: string;
  /** Opt-in round-robin interleave across all categories (default browse grid). */
  interleave?: boolean;
  /** Multi-select condition facets (marketplace sidebar). */
  conditions?: string[];
  /** Multi-select source facets (marketplace sidebar). */
  sources?: string[];
  /** Multi-select price buckets, OR-ed together (marketplace sidebar). */
  priceBuckets?: Array<{ min: number; max?: number }>;
}

export interface OrderFilters {
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

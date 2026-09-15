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
}

export interface OrderFilters {
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

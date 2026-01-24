import { apiClient } from './client';
import type { AreaOfExpertise } from '@/types/auth';

export interface ExpertiseQueryParams {
  search?: string;
  sort?: 'name' | 'slug' | 'created_at';
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface ExpertiseResponse {
  success: boolean;
  message: string;
  data: AreaOfExpertise[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number;
    to: number;
  };
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
}

export const expertiseApi = {
  getAll: async (params?: ExpertiseQueryParams) => {
    const response = await apiClient.get<ExpertiseResponse>(
      '/areas-of-expertise',
      { params }
    );
    return response.data;
  },
};

import { apiClient } from './client';

export interface University {
  id: number;
  name: string;
  slug: string;
  country_code: string;
  country: string;
  website?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UniversityQueryParams {
  search?: string;
  country_code?: string;
  sort?: 'name' | 'created_at';
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface UniversityResponse {
  success: boolean;
  message: string;
  data: University[];
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

export const universityApi = {
  getAll: async (params?: UniversityQueryParams) => {
    const response = await apiClient.get<UniversityResponse>('/universities', {
      params,
    });
    return response.data;
  },

  search: async (search: string, countryCode?: string) => {
    return universityApi.getAll({
      search,
      country_code: countryCode,
      per_page: 20,
      sort: 'name',
      order: 'asc',
    });
  },

  getBySlug: async (slug: string) => {
    const response = await apiClient.get<{ success: boolean; message: string; data: University }>(
      `/universities/${slug}`
    );
    return response.data;
  },
};

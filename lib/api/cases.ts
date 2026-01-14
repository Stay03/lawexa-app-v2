import { apiClient } from './client';
import type {
  CaseListResponse,
  CaseDetailResponse,
  CaseListParams,
} from '@/types/case';

/**
 * Case API service for Phase 5 endpoints
 */
export const casesApi = {
  /**
   * Get paginated list of cases
   */
  getList: async (params: CaseListParams = {}): Promise<CaseListResponse> => {
    const response = await apiClient.get<CaseListResponse>('/cases', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        search: params.search || undefined,
        court_id: params.court_id || undefined,
        country_id: params.country_id || undefined,
        year: params.year || undefined,
      },
    });
    return response.data;
  },

  /**
   * Get single case by slug
   */
  getBySlug: async (slug: string): Promise<CaseDetailResponse> => {
    const response = await apiClient.get<CaseDetailResponse>(`/cases/${slug}`);
    return response.data;
  },
};

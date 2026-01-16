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
        tags: params.tags || undefined,
      },
    });
    return response.data;
  },

  /**
   * Get single case by slug
   * @param slug - Case slug identifier
   * @param options - Optional query parameters for including related data
   */
  getBySlug: async (
    slug: string,
    options: {
      includeFullReport?: boolean;
      includeSimilarCases?: boolean;
      includeCitedCases?: boolean;
      includeCitedBy?: boolean;
    } = {}
  ): Promise<CaseDetailResponse> => {
    const params: Record<string, boolean> = {};
    if (options.includeFullReport) params.include_full_report = true;
    if (options.includeSimilarCases) params.include_similar_cases = true;
    if (options.includeCitedCases) params.include_cited_cases = true;
    if (options.includeCitedBy) params.include_cited_by = true;

    const response = await apiClient.get<CaseDetailResponse>(`/cases/${slug}`, {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return response.data;
  },
};

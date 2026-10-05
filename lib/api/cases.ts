import { apiClient } from './client';
import type {
  CaseListResponse,
  CaseDetailResponse,
  CaseListParams,
  CitedByListResponse,
  CitedByParams,
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
   * @param options.searchQuery - Search query for analytics tracking (sent as ?q= parameter)
   */
  getBySlug: async (
    slug: string,
    options: {
      includeFullReport?: boolean;
      includeSimilarCases?: boolean;
      includeCitedCases?: boolean;
      includeCitedBy?: boolean;
      searchQuery?: string;
    } = {}
  ): Promise<CaseDetailResponse> => {
    const params: Record<string, boolean | string> = {};
    if (options.includeFullReport) params.include_full_report = true;
    if (options.includeSimilarCases) params.include_similar_cases = true;
    if (options.includeCitedCases) params.include_cited_cases = true;
    if (options.includeCitedBy) params.include_cited_by = true;
    if (options.searchQuery) params.q = options.searchQuery;

    const response = await apiClient.get<CaseDetailResponse>(`/cases/${slug}`, {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return response.data;
  },

  /**
   * Get the paged list of later cases that cite this one. The case payload
   * caps `cited_by` at 50 rows; this is the whole list.
   * @param slug - Slug of the cited case
   */
  getCitedBy: async (
    slug: string,
    params: CitedByParams = {}
  ): Promise<CitedByListResponse> => {
    const response = await apiClient.get<CitedByListResponse>(`/cases/${slug}/cited-by`, {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 50,
        sort: params.sort ?? 'newest',
        search: params.search || undefined,
        court_id: params.court_id,
        year: params.year,
      },
    });
    return response.data;
  },
};

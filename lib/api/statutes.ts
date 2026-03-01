import { apiClient } from './client';
import type {
  StatuteListResponse,
  StatuteDetailResponse,
  StatuteNodesResponse,
  StatuteNavigateResponse,
  StatuteListParams,
} from '@/types/statute';

/**
 * Statute API service for Phase 17 endpoints
 */
export const statutesApi = {
  /**
   * Get paginated list of statutes
   */
  getList: async (params: StatuteListParams = {}): Promise<StatuteListResponse> => {
    const response = await apiClient.get<StatuteListResponse>('/statutes', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        search: params.search || undefined,
        country: params.country || undefined,
        status: params.status || undefined,
        year: params.year || undefined,
        sort: params.sort || undefined,
        order: params.order || undefined,
      },
    });
    return response.data;
  },

  /**
   * Get single statute by slug
   */
  getBySlug: async (slug: string): Promise<StatuteDetailResponse> => {
    const response = await apiClient.get<StatuteDetailResponse>(`/statutes/${slug}`);
    return response.data;
  },

  /**
   * Get nodes within a position range for a statute
   */
  getNodes: async (
    slug: string,
    from: number = 0,
    to: number = 49,
  ): Promise<StatuteNodesResponse> => {
    const response = await apiClient.get<StatuteNodesResponse>(
      `/statutes/${slug}/nodes`,
      { params: { from, to } },
    );
    return response.data;
  },

  /**
   * Navigate to a specific node by slug path (deep link)
   */
  navigate: async (slug: string, path: string): Promise<StatuteNavigateResponse> => {
    const response = await apiClient.get<StatuteNavigateResponse>(
      `/statutes/${slug}/navigate/${path}`,
    );
    return response.data;
  },
};

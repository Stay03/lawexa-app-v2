import { apiClient } from './client';
import type {
  TrendingCasesResponse,
  TrendingNotesResponse,
  TrendingParams,
} from '@/types/trending';

/**
 * Trending API service for Phase 11 endpoints
 */
export const trendingApi = {
  /**
   * Get trending cases sorted by trending score
   */
  getCases: async (params: TrendingParams = {}): Promise<TrendingCasesResponse> => {
    const response = await apiClient.get<TrendingCasesResponse>('/trending/cases', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        university: params.university || undefined,
        level: params.level || undefined,
        country: params.country || undefined,
        time_range: params.time_range || undefined,
        start_date: params.start_date || undefined,
        end_date: params.end_date || undefined,
      },
    });
    return response.data;
  },

  /**
   * Get trending notes sorted by trending score
   */
  getNotes: async (params: TrendingParams = {}): Promise<TrendingNotesResponse> => {
    const response = await apiClient.get<TrendingNotesResponse>('/trending/notes', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        university: params.university || undefined,
        level: params.level || undefined,
        country: params.country || undefined,
        time_range: params.time_range || undefined,
        start_date: params.start_date || undefined,
        end_date: params.end_date || undefined,
      },
    });
    return response.data;
  },
};

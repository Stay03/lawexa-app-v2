import { apiClient } from './client';
import type {
  BookmarkListResponse,
  BookmarkToggleResponse,
  BookmarkCheckResponse,
  BookmarkListParams,
  ToggleBookmarkData,
} from '@/types/bookmark';

/**
 * Bookmark API service for Phase 7 endpoints
 */
export const bookmarksApi = {
  /**
   * Get paginated list of user's bookmarks
   */
  getList: async (params: BookmarkListParams = {}): Promise<BookmarkListResponse> => {
    const response = await apiClient.get<BookmarkListResponse>('/bookmarks', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        type: params.type || undefined,
      },
    });
    return response.data;
  },

  /**
   * Toggle bookmark (add if not exists, remove if exists)
   */
  toggle: async (data: ToggleBookmarkData): Promise<BookmarkToggleResponse> => {
    const response = await apiClient.post<BookmarkToggleResponse>('/bookmarks', data);
    return response.data;
  },

  /**
   * Check if specific content is bookmarked
   */
  check: async (type: string, id: number): Promise<BookmarkCheckResponse> => {
    const response = await apiClient.get<BookmarkCheckResponse>('/bookmarks/check', {
      params: { type, id },
    });
    return response.data;
  },
};

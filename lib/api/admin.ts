import { apiClient } from './client';
import type {
  AdminConversationsParams,
  AdminConversationsListResponse,
  AdminConversationDetailResponse,
} from '@/types/admin';

export const adminApi = {
  /**
   * List all conversations with pagination, filtering, and sorting
   * Requires admin role
   */
  getConversations: async (
    params: AdminConversationsParams = {}
  ): Promise<AdminConversationsListResponse> => {
    const response = await apiClient.get<AdminConversationsListResponse>(
      '/admin/conversations',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          status: params.status,
          is_private: params.is_private,
          user_uuid: params.user_uuid,
          sort_by: params.sort_by ?? 'created_at',
          sort_order: params.sort_order ?? 'desc',
        },
      }
    );
    return response.data;
  },

  /**
   * Get a single conversation with all messages
   * Requires admin role
   */
  getConversation: async (
    uuid: string
  ): Promise<AdminConversationDetailResponse> => {
    const response = await apiClient.get<AdminConversationDetailResponse>(
      `/admin/conversations/${uuid}`
    );
    return response.data;
  },
};

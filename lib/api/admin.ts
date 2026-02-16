import { apiClient } from './client';
import type {
  AdminConversationsParams,
  AdminConversationsListResponse,
  AdminConversationDetailResponse,
  AdminUserDetailResponse,
  AdminUserConversationsParams,
  AdminUserConversationsResponse,
  AdminUserTokenUsageParams,
  AdminUserTokenUsageResponse,
  ConversationAnalyticsParams,
  ConversationAnalyticsResponse,
  UserAnalyticsParams,
  UserAnalyticsResponse,
  ViewAnalyticsParams,
  ViewAnalyticsResponse,
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

  /**
   * Get user details by UUID
   * Requires admin role
   */
  getUser: async (uuid: string): Promise<AdminUserDetailResponse> => {
    const response = await apiClient.get<AdminUserDetailResponse>(
      `/admin/users/${uuid}`
    );
    return response.data;
  },

  /**
   * Get all conversations for a specific user
   * Requires admin role
   */
  getUserConversations: async (
    uuid: string,
    params: AdminUserConversationsParams = {}
  ): Promise<AdminUserConversationsResponse> => {
    const response = await apiClient.get<AdminUserConversationsResponse>(
      `/admin/users/${uuid}/conversations`,
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          status: params.status,
          sort_by: params.sort_by ?? 'created_at',
          sort_order: params.sort_order ?? 'desc',
        },
      }
    );
    return response.data;
  },

  /**
   * Get token usage statistics for a specific user
   * Requires admin role
   */
  getUserTokenUsage: async (
    uuid: string,
    params: AdminUserTokenUsageParams = {}
  ): Promise<AdminUserTokenUsageResponse> => {
    const response = await apiClient.get<AdminUserTokenUsageResponse>(
      `/admin/users/${uuid}/token-usage`,
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          start_date: params.start_date,
          end_date: params.end_date,
          agent_slug: params.agent_slug,
          group_by: params.group_by ?? 'none',
          sort_by: params.sort_by ?? 'created_at',
          sort_order: params.sort_order ?? 'desc',
        },
      }
    );
    return response.data;
  },

  /**
   * Get conversation analytics with period comparison
   * Requires admin role
   */
  getConversationAnalytics: async (
    params: ConversationAnalyticsParams = {}
  ): Promise<ConversationAnalyticsResponse> => {
    const response = await apiClient.get<ConversationAnalyticsResponse>(
      '/admin/conversations/analytics',
      {
        params: {
          period: params.period ?? '30d',
          start_date: params.start_date,
          end_date: params.end_date,
        },
      }
    );
    return response.data;
  },

  /**
   * Get user analytics with period comparison
   * Requires admin role
   */
  getUserAnalytics: async (
    params: UserAnalyticsParams = {}
  ): Promise<UserAnalyticsResponse> => {
    const response = await apiClient.get<UserAnalyticsResponse>(
      '/admin/users/analytics',
      {
        params: {
          period: params.period ?? '30d',
          start_date: params.start_date,
          end_date: params.end_date,
        },
      }
    );
    return response.data;
  },

  /**
   * Get view analytics with period comparison
   * Requires admin role
   */
  getViewAnalytics: async (
    params: ViewAnalyticsParams = {}
  ): Promise<ViewAnalyticsResponse> => {
    const response = await apiClient.get<ViewAnalyticsResponse>(
      '/admin/views/analytics',
      {
        params: {
          period: params.period ?? 'last_30_days',
          date: params.date,
          start_date: params.start_date,
          end_date: params.end_date,
        },
      }
    );
    return response.data;
  },
};

import { apiClient } from './client';
import type {
  AdminConversationsParams,
  AdminConversationsListResponse,
  AdminConversationDetailResponse,
  AdminUserDetailResponse,
  IAdminUserListParams,
  IAdminUserListResponse,
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
  SubscriptionAnalyticsParams,
  SubscriptionAnalyticsResponse,
  AdminSubscriptionsParams,
  AdminSubscriptionsListResponse,
  AdminSubscriptionDetailResponse,
  AdminSubscribersParams,
  AdminSubscribersListResponse,
  AdminMessagePacksParams,
  AdminMessagePacksListResponse,
  AdminMessagePackDetailResponse,
  MessagePackAnalyticsParams,
  MessagePackAnalyticsResponse,
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
   * List all users with pagination, filtering, and sorting
   * Requires admin role
   */
  getUsers: async (
    params: IAdminUserListParams = {}
  ): Promise<IAdminUserListResponse> => {
    const response = await apiClient.get<IAdminUserListResponse>(
      '/admin/users',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          search: params.search,
          'role[]': params.role,
          'auth_provider[]': params.auth_provider,
          'profession[]': params.profession,
          'country[]': params.country,
          'subscription_plan[]': params.subscription_plan,
          is_online: params.is_online,
          has_payg_balance: params.has_payg_balance,
          is_creator: params.is_creator,
          is_verified: params.is_verified,
          created_from: params.created_from,
          created_to: params.created_to,
          sort_by: params.sort_by ?? 'created_at',
          sort_order: params.sort_order ?? 'desc',
        },
      }
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
          period: params.period ?? 'last_30_days',
          date: params.date,
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
          period: params.period ?? 'last_30_days',
          date: params.date,
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

  /**
   * Get subscription analytics with period comparison
   * Requires admin role
   */
  getSubscriptionAnalytics: async (
    params: SubscriptionAnalyticsParams = {}
  ): Promise<SubscriptionAnalyticsResponse> => {
    const response = await apiClient.get<SubscriptionAnalyticsResponse>(
      '/admin/subscriptions/analytics',
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

  /**
   * List all subscriptions with pagination, filtering, and sorting
   * Requires admin role
   */
  getAdminSubscriptions: async (
    params: AdminSubscriptionsParams = {}
  ): Promise<AdminSubscriptionsListResponse> => {
    const response = await apiClient.get<AdminSubscriptionsListResponse>(
      '/admin/subscriptions',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          status: params.status,
          plan_id: params.plan_id,
          search: params.search,
          start_date: params.start_date,
          end_date: params.end_date,
          min_amount: params.min_amount,
          max_amount: params.max_amount,
          sort_by: params.sort_by ?? 'created_at',
          sort_order: params.sort_order ?? 'desc',
        },
      }
    );
    return response.data;
  },

  /**
   * Get a single subscription with detail and recent invoices
   * Requires admin role
   */
  getAdminSubscription: async (
    id: number
  ): Promise<AdminSubscriptionDetailResponse> => {
    const response = await apiClient.get<AdminSubscriptionDetailResponse>(
      `/admin/subscriptions/${id}`
    );
    return response.data;
  },

  /**
   * List all subscribers with their most recent subscription
   * Requires admin role
   */
  getAdminSubscribers: async (
    params: AdminSubscribersParams = {}
  ): Promise<AdminSubscribersListResponse> => {
    const response = await apiClient.get<AdminSubscribersListResponse>(
      '/admin/subscribers',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          search: params.search,
          role: params.role,
          plan_id: params.plan_id,
          subscription_status: params.subscription_status,
          sort_by: params.sort_by ?? 'created_at',
          sort_order: params.sort_order ?? 'desc',
        },
      }
    );
    return response.data;
  },

  /**
   * List all message packs with pagination, filtering, and sorting
   * Requires admin role
   */
  getAdminMessagePacks: async (
    params: AdminMessagePacksParams = {}
  ): Promise<AdminMessagePacksListResponse> => {
    const response = await apiClient.get<AdminMessagePacksListResponse>(
      '/admin/message-packs',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          status: params.status,
          search: params.search,
          start_date: params.start_date,
          end_date: params.end_date,
          min_amount: params.min_amount,
          max_amount: params.max_amount,
          sort_by: params.sort_by ?? 'created_at',
          sort_order: params.sort_order ?? 'desc',
        },
      }
    );
    return response.data;
  },

  /**
   * Get a single message pack with full details
   * Requires admin role
   */
  getAdminMessagePack: async (
    id: number
  ): Promise<AdminMessagePackDetailResponse> => {
    const response = await apiClient.get<AdminMessagePackDetailResponse>(
      `/admin/message-packs/${id}`
    );
    return response.data;
  },

  /**
   * Get message pack analytics with period comparison
   * Requires admin role
   */
  getMessagePackAnalytics: async (
    params: MessagePackAnalyticsParams = {}
  ): Promise<MessagePackAnalyticsResponse> => {
    const response = await apiClient.get<MessagePackAnalyticsResponse>(
      '/admin/message-packs/analytics',
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

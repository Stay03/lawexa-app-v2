import { apiClient } from './client';
import type {
  AdminConversationsParams,
  AdminConversationsListResponse,
  AdminConversationDetailResponse,
  AdminUserDetailResponse,
  AdminFreeMessagesBlockPayload,
  AdminFreeMessagesBlockResponse,
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
  AdminMessagePacksParams,
  AdminMessagePacksListResponse,
  AdminMessagePackDetailResponse,
  MessagePackAnalyticsParams,
  MessagePackAnalyticsResponse,
} from '@/types/admin';
import type {
  AdminSettingsParams,
  AdminSettingsListResponse,
  AdminSettingsUpdatePayload,
  AdminSettingsUpdateResponse,
} from '@/types/admin-settings';
import type {
  AdminPlansParams,
  AdminPlansListResponse,
  AdminPlanDetailResponse,
  AdminPlanUpdatePayload,
  AdminPlanUpdateResponse,
  AdminPlanLimitsPayload,
  AdminPlanLimitsResponse,
  AdminPlanSyncResponse,
} from '@/types/admin-plans';
import type {
  AdminUserPlanPeriodsResponse,
  AdminPlanPeriodConversationsParams,
  AdminPlanPeriodConversationsResponse,
} from '@/types/admin-plan-periods';

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
          'utm_source[]': params.utm_source,
          'utm_medium[]': params.utm_medium,
          'utm_campaign[]': params.utm_campaign,
          referred_by: params.referred_by,
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
   * Block or unblock a user's free AI messages. Admin-only.
   *
   * Path is /users/{uuid}/... (NOT /admin/users/) by design — this app keeps
   * read-only admin endpoints under /admin/users/ but admin write actions on a
   * user (role, creator, this) under /users/{uuid}/..., all admin-role gated.
   * Sets the same source-neutral flag the automatic device-abuse detection uses,
   * so unblocking here also lifts an automatic flag. Returns the updated user.
   */
  setUserFreeMessagesBlock: async (
    uuid: string,
    payload: AdminFreeMessagesBlockPayload
  ): Promise<AdminFreeMessagesBlockResponse> => {
    const response = await apiClient.put<AdminFreeMessagesBlockResponse>(
      `/users/${uuid}/free-messages-block`,
      payload
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
   * Get a user's subscription/billing plan periods, side-buckets, totals, and
   * reconciliation block. Not paginated — a user has a bounded number of periods.
   * Requires admin role
   */
  getUserPlanPeriods: async (
    uuid: string
  ): Promise<AdminUserPlanPeriodsResponse> => {
    const response = await apiClient.get<AdminUserPlanPeriodsResponse>(
      `/admin/users/${uuid}/plan-periods`
    );
    return response.data;
  },

  /**
   * List the conversations whose usage falls in a single plan-period or bucket
   * (identified by its `key`), paginated, with per-slot usage counts.
   * Requires admin role
   */
  getUserPlanPeriodConversations: async (
    uuid: string,
    key: string,
    params: AdminPlanPeriodConversationsParams = {}
  ): Promise<AdminPlanPeriodConversationsResponse> => {
    const response = await apiClient.get<AdminPlanPeriodConversationsResponse>(
      `/admin/users/${uuid}/plan-periods/${key}/conversations`,
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
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
   * Cancel a subscription (admin action)
   * Sets status to cancelled, disables in Paystack
   */
  cancelAdminSubscription: async (
    id: number
  ): Promise<AdminSubscriptionDetailResponse> => {
    const response = await apiClient.post<AdminSubscriptionDetailResponse>(
      `/admin/subscriptions/${id}/cancel`
    );
    return response.data;
  },

  /**
   * Reactivate a cancelled subscription (admin action)
   * Restores status to active, re-enables in Paystack
   */
  reactivateAdminSubscription: async (
    id: number
  ): Promise<AdminSubscriptionDetailResponse> => {
    const response = await apiClient.post<AdminSubscriptionDetailResponse>(
      `/admin/subscriptions/${id}/reactivate`
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

  /**
   * Fetch settings, optionally filtered by group
   * Requires admin role
   */
  getSettings: async (
    params: AdminSettingsParams = {}
  ): Promise<AdminSettingsListResponse> => {
    const response = await apiClient.get<AdminSettingsListResponse>(
      '/admin/settings',
      { params: { group: params.group } }
    );
    return response.data;
  },

  /**
   * Batch update settings by key
   * Requires admin role
   */
  updateSettings: async (
    payload: AdminSettingsUpdatePayload
  ): Promise<AdminSettingsUpdateResponse> => {
    const response = await apiClient.put<AdminSettingsUpdateResponse>(
      '/admin/settings',
      payload
    );
    return response.data;
  },

  // ============================================
  // Admin Plans
  // ============================================

  /**
   * List all plans with pagination and optional active filter
   * Requires admin role
   */
  getAdminPlans: async (
    params: AdminPlansParams = {}
  ): Promise<AdminPlansListResponse> => {
    const response = await apiClient.get<AdminPlansListResponse>(
      '/admin/plans',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          is_active: params.is_active,
        },
      }
    );
    return response.data;
  },

  /**
   * Get a single plan with limits and recent subscriptions
   * Requires admin role
   */
  getAdminPlan: async (id: number): Promise<AdminPlanDetailResponse> => {
    const response = await apiClient.get<AdminPlanDetailResponse>(
      `/admin/plans/${id}`
    );
    return response.data;
  },

  /**
   * Update plan metadata (name, description, toggles, features)
   * Does not allow changing amount, slug, plan_code, currency, or interval
   * Requires admin role
   */
  updateAdminPlan: async (
    id: number,
    payload: AdminPlanUpdatePayload
  ): Promise<AdminPlanUpdateResponse> => {
    const response = await apiClient.put<AdminPlanUpdateResponse>(
      `/admin/plans/${id}`,
      payload
    );
    return response.data;
  },

  /**
   * Update limits for a plan
   * For free plans, saves to plan_id = NULL (shared free tier defaults)
   * Requires admin role
   */
  updateAdminPlanLimits: async (
    id: number,
    payload: AdminPlanLimitsPayload
  ): Promise<AdminPlanLimitsResponse> => {
    const response = await apiClient.put<AdminPlanLimitsResponse>(
      `/admin/plans/${id}/limits`,
      payload
    );
    return response.data;
  },

  /**
   * Update free tier default limits (plan_id = NULL)
   * Requires admin role
   */
  updateFreePlanLimits: async (
    payload: AdminPlanLimitsPayload
  ): Promise<AdminPlanLimitsResponse> => {
    const response = await apiClient.put<AdminPlanLimitsResponse>(
      '/admin/plans/free/limits',
      payload
    );
    return response.data;
  },

  /**
   * Sync plans from Paystack
   * Creates/updates local plans, deactivates removed plans, ensures free plan exists
   * Requires admin role
   */
  syncPlans: async (): Promise<AdminPlanSyncResponse> => {
    const response = await apiClient.post<AdminPlanSyncResponse>(
      '/admin/plans/sync'
    );
    return response.data;
  },
};

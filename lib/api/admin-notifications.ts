import { apiClient } from './client';
import type {
  BroadcastNotificationData,
  BroadcastResponse,
  BroadcastListParams,
  BroadcastListResponse,
  BroadcastDetailResponse,
  BroadcastRecipientsParams,
  BroadcastRecipientsResponse,
  NotificationAnalyticsParams,
  NotificationAnalyticsResponse,
} from '@/types/notification';

/**
 * Admin notification API service
 * Requires admin+ role for all operations
 */
export const adminNotificationsApi = {
  /**
   * Broadcast a notification to targeted users
   * Targeting: user_id, user_ids, role, or broadcast_to_all
   */
  broadcast: async (data: BroadcastNotificationData): Promise<BroadcastResponse> => {
    const response = await apiClient.post<BroadcastResponse>(
      '/admin/notifications/broadcast',
      data
    );
    return response.data;
  },

  /**
   * List all broadcasts with summary stats (read/unread counts)
   */
  getList: async (params: BroadcastListParams = {}): Promise<BroadcastListResponse> => {
    const response = await apiClient.get<BroadcastListResponse>(
      '/admin/notifications',
      {
        params: {
          sort: params.sort ?? 'created_at',
          direction: params.direction ?? 'desc',
          per_page: params.per_page ?? 15,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },

  /**
   * Get details for a specific broadcast including read/unread counts
   */
  getById: async (uuid: string): Promise<BroadcastDetailResponse> => {
    const response = await apiClient.get<BroadcastDetailResponse>(
      `/admin/notifications/${uuid}`
    );
    return response.data;
  },

  /**
   * List paginated recipients for a specific broadcast with read status
   */
  getRecipients: async (
    uuid: string,
    params: BroadcastRecipientsParams = {}
  ): Promise<BroadcastRecipientsResponse> => {
    const response = await apiClient.get<BroadcastRecipientsResponse>(
      `/admin/notifications/${uuid}/recipients`,
      {
        params: {
          per_page: params.per_page ?? 15,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },

  /**
   * Get notification analytics dashboard data
   */
  getAnalytics: async (
    params: NotificationAnalyticsParams = {}
  ): Promise<NotificationAnalyticsResponse> => {
    const response = await apiClient.get<NotificationAnalyticsResponse>(
      '/admin/notifications/analytics',
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
};

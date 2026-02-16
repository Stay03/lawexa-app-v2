import { apiClient } from './client';
import type {
  ShowNotificationResponse,
  NotificationListResponse,
  UnreadCountResponse,
  MarkReadResponse,
  MarkAllReadResponse,
  DeleteNotificationResponse,
  NotificationListParams,
} from '@/types/notification';

/**
 * User notification API service
 * All endpoints require authentication
 */
export const notificationsApi = {
  /**
   * Get a single notification by ID
   */
  getById: async (id: string): Promise<ShowNotificationResponse> => {
    const response = await apiClient.get<ShowNotificationResponse>(`/notifications/${id}`);
    return response.data;
  },

  /**
   * Get paginated list of the authenticated user's notifications
   */
  getList: async (params: NotificationListParams = {}): Promise<NotificationListResponse> => {
    const response = await apiClient.get<NotificationListResponse>('/notifications', {
      params: {
        read: params.read || undefined,
        sort: params.sort || undefined,
        direction: params.direction || undefined,
        per_page: params.per_page ?? 15,
        page: params.page ?? 1,
      },
    });
    return response.data;
  },

  /**
   * Get unread notification count for badge display
   */
  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    const response = await apiClient.get<UnreadCountResponse>('/notifications/unread-count');
    return response.data;
  },

  /**
   * Mark a specific notification as read (idempotent)
   */
  markAsRead: async (id: string): Promise<MarkReadResponse> => {
    const response = await apiClient.post<MarkReadResponse>(`/notifications/${id}/read`);
    return response.data;
  },

  /**
   * Mark all notifications as read for the authenticated user
   */
  markAllAsRead: async (): Promise<MarkAllReadResponse> => {
    const response = await apiClient.post<MarkAllReadResponse>('/notifications/read-all');
    return response.data;
  },

  /**
   * Permanently delete a notification
   */
  delete: async (id: string): Promise<DeleteNotificationResponse> => {
    const response = await apiClient.delete<DeleteNotificationResponse>(`/notifications/${id}`);
    return response.data;
  },
};

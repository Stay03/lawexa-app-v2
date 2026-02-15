import { apiClient } from './client';
import type {
  BroadcastNotificationData,
  BroadcastResponse,
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
};

// Admin Notifications - TanStack Query Hooks
// Provides React Query hooks for admin notification broadcasting

import { useMutation } from '@tanstack/react-query';
import { adminNotificationsApi } from '@/lib/api/admin-notifications';
import type { BroadcastNotificationData } from '@/types/notification';

/******************************************************************************
                    Admin Notification Mutation Hooks
******************************************************************************/

/**
 * Broadcast a notification to targeted users
 * Requires admin+ role
 */
export function useBroadcastNotification() {
  return useMutation({
    mutationFn: (data: BroadcastNotificationData) =>
      adminNotificationsApi.broadcast(data),
  });
}

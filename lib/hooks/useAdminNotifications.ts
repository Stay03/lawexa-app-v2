// Admin Notifications - TanStack Query Hooks
// Provides React Query hooks for admin notification broadcasting,
// broadcast management, and notification analytics

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminNotificationsApi } from '@/lib/api/admin-notifications';
import type {
  BroadcastNotificationData,
  BroadcastListParams,
  BroadcastRecipientsParams,
  NotificationAnalyticsParams,
} from '@/types/notification';

/******************************************************************************
                         Query Key Factory
******************************************************************************/

export const adminNotificationKeys = {
  all: ['admin-notifications'] as const,
  broadcasts: () => [...adminNotificationKeys.all, 'broadcasts'] as const,
  broadcastList: (params: BroadcastListParams) =>
    [...adminNotificationKeys.broadcasts(), 'list', params] as const,
  broadcastDetail: (uuid: string) =>
    [...adminNotificationKeys.broadcasts(), 'detail', uuid] as const,
  broadcastRecipients: (uuid: string, params: BroadcastRecipientsParams) =>
    [...adminNotificationKeys.broadcasts(), 'recipients', uuid, params] as const,
  analytics: (params: NotificationAnalyticsParams) =>
    [...adminNotificationKeys.all, 'analytics', params] as const,
};

/******************************************************************************
                         Query Hooks
******************************************************************************/

/**
 * List all broadcasts with summary stats
 * Requires admin+ role
 */
export function useAdminBroadcasts(params: BroadcastListParams = {}) {
  return useQuery({
    queryKey: adminNotificationKeys.broadcastList(params),
    queryFn: () => adminNotificationsApi.getList(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Get a single broadcast detail with read/unread counts
 * Requires admin+ role
 */
export function useAdminBroadcast(uuid: string) {
  return useQuery({
    queryKey: adminNotificationKeys.broadcastDetail(uuid),
    queryFn: () => adminNotificationsApi.getById(uuid),
    staleTime: 30 * 1000,
    enabled: !!uuid,
  });
}

/**
 * List paginated recipients for a broadcast with read status
 * Requires admin+ role
 */
export function useBroadcastRecipients(
  uuid: string,
  params: BroadcastRecipientsParams = {}
) {
  return useQuery({
    queryKey: adminNotificationKeys.broadcastRecipients(uuid, params),
    queryFn: () => adminNotificationsApi.getRecipients(uuid, params),
    staleTime: 30 * 1000,
    enabled: !!uuid,
  });
}

/**
 * Get notification analytics dashboard data
 * Requires admin+ role
 */
export function useNotificationAnalytics(
  params: NotificationAnalyticsParams = {}
) {
  return useQuery({
    queryKey: adminNotificationKeys.analytics(params),
    queryFn: () => adminNotificationsApi.getAnalytics(params),
    staleTime: 30 * 1000,
  });
}

/******************************************************************************
                    Mutation Hooks
******************************************************************************/

/**
 * Broadcast a notification to targeted users
 * Requires admin+ role
 * Invalidates broadcast list on success
 */
export function useBroadcastNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BroadcastNotificationData) =>
      adminNotificationsApi.broadcast(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adminNotificationKeys.broadcasts(),
      });
    },
  });
}

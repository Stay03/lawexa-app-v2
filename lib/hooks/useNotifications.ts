// Notifications - TanStack Query Hooks
// Provides React Query hooks for notification management with proper cache management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/notifications';
import { useAuthStore } from '@/lib/stores/authStore';
import type { NotificationListParams } from '@/types/notification';

/******************************************************************************
                            Query Key Factory
******************************************************************************/

export const notificationKeys = {
  all: ['notifications'] as const,

  // Notification Lists
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (params: NotificationListParams) =>
    [...notificationKeys.lists(), params] as const,

  // Unread Count
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

/******************************************************************************
                        Notification Query Hooks
******************************************************************************/

/**
 * Get paginated list of the authenticated user's notifications
 */
export function useNotifications(params: NotificationListParams = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);

  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsApi.getList(params),
    enabled: isAuthenticated && !isGuest,
    staleTime: 60 * 1000,
  });
}

/**
 * Get unread notification count for badge display
 * Polls every 60 seconds for real-time badge updates
 */
export function useUnreadCount() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);

  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationsApi.getUnreadCount(),
    enabled: isAuthenticated && !isGuest,
    refetchInterval: 60_000,
    staleTime: 30 * 1000,
  });
}

/******************************************************************************
                    Notification Mutation Hooks
******************************************************************************/

/**
 * Mark a specific notification as read
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

/**
 * Mark all notifications as read
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

/**
 * Delete a specific notification
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

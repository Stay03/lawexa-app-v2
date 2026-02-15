'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { AdminPagination } from '@/components/admin';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { NotificationItem } from '@/components/notifications';
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from '@/lib/hooks/useNotifications';
import { extractApiError } from '@/lib/utils/api-error';
import type { NotificationListParams } from '@/types/notification';

/******************************************************************************
                                Constants
******************************************************************************/

const FILTER_TABS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

/******************************************************************************
                                Page Content
******************************************************************************/

function NotificationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read params from URL
  const params = useMemo<NotificationListParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const read = searchParams.get('read') as 'read' | 'unread' | null;

    return {
      page,
      per_page,
      read: read || undefined,
      sort: 'created_at',
      direction: 'desc',
    };
  }, [searchParams]);

  const activeFilter = params.read || 'all';

  const { data, isLoading, isError, refetch } = useNotifications(params);
  const { data: unreadData } = useUnreadCount();
  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();
  const deleteMutation = useDeleteNotification();

  const unreadCount = unreadData?.data?.unread_count ?? 0;
  const notifications = data?.data ?? [];

  // Update URL params
  const updateParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const newParams = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });

      const queryString = newParams.toString();
      router.push(queryString ? `/notifications?${queryString}` : '/notifications');
    },
    [router, searchParams]
  );

  const handleFilterChange = useCallback(
    (value: string) => {
      updateParams({
        read: value === 'all' ? null : value,
        page: null,
      });
    },
    [updateParams]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateParams({ page: String(page) });
    },
    [updateParams]
  );

  const handleMarkAsRead = useCallback(
    (id: string) => {
      markAsReadMutation.mutate(id);
    },
    [markAsReadMutation]
  );

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsReadMutation.mutate(undefined, {
      onSuccess: (response) => {
        toast.success(`Marked ${response.data?.marked_count ?? 0} as read`);
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        toast.error(apiError.message || 'Failed to mark all as read');
      },
    });
  }, [markAllAsReadMutation]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          toast.success('Notification deleted');
        },
        onError: (error) => {
          const apiError = extractApiError(error);
          toast.error(apiError.message || 'Failed to delete notification');
        },
      });
    },
    [deleteMutation]
  );

  // Error state
  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorState
            title="Failed to load notifications"
            description="Something went wrong while loading your notifications."
            retry={() => { refetch(); }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <CardTitle>Notifications</CardTitle>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}
            >
              <CheckCheck className="mr-1.5 h-4 w-4" />
              Mark all as read
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filter Tabs */}
          <AnimatedTabs
            tabs={FILTER_TABS}
            value={activeFilter}
            onValueChange={handleFilterChange}
          />

          {/* Notification List */}
          {isLoading ? (
            <NotificationsListSkeleton />
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications"
              description={
                activeFilter === 'unread'
                  ? "You're all caught up! No unread notifications."
                  : activeFilter === 'read'
                    ? 'No read notifications found.'
                    : "You don't have any notifications yet."
              }
            />
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data?.pagination && data.pagination.total > 0 && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={handlePageChange}
              itemLabel="notification"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/******************************************************************************
                            Child Components
******************************************************************************/

/**
 * Loading skeleton for the notifications list
 */
function NotificationsListSkeleton() {
  const opacityValues = [1, 0.7, 0.4, 0.2, 0.1];

  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 rounded-lg border px-4 py-3"
          style={{ opacity: opacityValues[i] ?? 0.1 }}
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/******************************************************************************
                                Default Export
******************************************************************************/

/**
 * Default component. Full notifications page.
 */
export default function NotificationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <NotificationsPageContent />
    </Suspense>
  );
}

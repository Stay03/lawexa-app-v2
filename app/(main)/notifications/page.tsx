'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { AdminPagination } from '@/components/admin';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageContainer, PageHeader } from '@/components/layout';
import {
  NotificationItem,
  NotificationListGroup,
  NotificationListSkeleton,
} from '@/components/notifications';
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

  // Build filter tabs with unread count badge
  const filterTabs = useMemo(
    () => [
      { value: 'all', label: 'All' },
      {
        value: 'unread',
        label: (
          <span className="inline-flex items-center gap-1.5">
            Unread
            {unreadCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </span>
        ),
      },
      { value: 'read', label: 'Read' },
    ],
    [unreadCount]
  );

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
      <PageContainer variant="list">
        <PageHeader title="Notifications" description="Stay up to date with your latest updates." />
        <ErrorState
          title="Failed to load notifications"
          description="Something went wrong while loading your notifications."
          retry={() => { refetch(); }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="list">
      <PageHeader title="Notifications" description="Stay up to date with your latest updates.">
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
      </PageHeader>

      {/* Filter Tabs + Content */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-56 rounded-full" />
          <NotificationListSkeleton />
        </div>
      ) : (
        <>
          <AnimatedTabs
            tabs={filterTabs}
            value={activeFilter}
            onValueChange={handleFilterChange}
            className="animate-in slide-in-from-top-2 duration-300"
          />

          {/* Notification List */}
          <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            {notifications.length === 0 ? (
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
              <NotificationListGroup>
                {notifications.map((notification, index) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                    onDelete={handleDelete}
                    className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both"
                    style={{ animationDelay: `${Math.min(index, 14) * 30}ms` }}
                  />
                ))}
              </NotificationListGroup>
            )}

            {/* Pagination */}
            {data?.pagination && data.pagination.total > 0 && (
              <div className="pt-4">
                <AdminPagination
                  pagination={data.pagination}
                  onPageChange={handlePageChange}
                  itemLabel="notification"
                />
              </div>
            )}
          </div>
        </>
      )}
    </PageContainer>
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
    <Suspense
      fallback={
        <PageContainer variant="list">
          <PageHeader
            title="Notifications"
            description="Stay up to date with your latest updates."
          />
          <div className="space-y-4">
            <Skeleton className="h-9 w-56 rounded-full" />
            <NotificationListSkeleton />
          </div>
        </PageContainer>
      }
    >
      <NotificationsPageContent />
    </Suspense>
  );
}

'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { NotificationItem } from './NotificationItem';
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from '@/lib/hooks/useNotifications';
import { extractApiError } from '@/lib/utils/api-error';

/******************************************************************************
                                Types
******************************************************************************/

interface NotificationDropdownProps {
  onClose?: () => void;
}

/******************************************************************************
                                Component
******************************************************************************/

/**
 * Default component. Notification dropdown content for popover/sheet.
 */
function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { data, isLoading } = useNotifications({ per_page: 10 });
  const { data: unreadData } = useUnreadCount();
  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();
  const deleteMutation = useDeleteNotification();

  const unreadCount = unreadData?.data?.unread_count ?? 0;
  const notifications = data?.data ?? [];

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
        onError: (error) => {
          const apiError = extractApiError(error);
          toast.error(apiError.message || 'Failed to delete notification');
        },
      });
    },
    [deleteMutation]
  );

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold">Notifications</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleMarkAllAsRead}
            disabled={markAllAsReadMutation.isPending}
          >
            <CheckCheck className="mr-1 h-3.5 w-3.5" />
            Mark all as read
          </Button>
        )}
      </div>

      <Separator />

      {/* Body */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <DropdownSkeleton />
        ) : notifications.length === 0 ? (
          <DropdownEmpty />
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
                onClose={onClose}
                isCompact
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <Separator />
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground hover:text-foreground"
          asChild
          onClick={onClose}
        >
          <Link href="/notifications">View all notifications</Link>
        </Button>
      </div>
    </div>
  );
}

/******************************************************************************
                            Child Components
******************************************************************************/

/**
 * Loading skeleton for the dropdown body
 */
function DropdownSkeleton() {
  return (
    <div className="space-y-0 divide-y">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-4 py-3" style={{ opacity: 1 - i * 0.3 }}>
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state for the dropdown body
 */
function DropdownEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-3 rounded-full bg-muted p-3">
        <Bell className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No notifications yet</p>
      <p className="text-xs text-muted-foreground mt-1">
        We&apos;ll notify you when something arrives
      </p>
    </div>
  );
}

/******************************************************************************
                                Export default
******************************************************************************/

export default NotificationDropdown;
export { NotificationDropdown };

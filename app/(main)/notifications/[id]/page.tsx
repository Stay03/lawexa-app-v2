'use client';

import { use, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  Bell,
  Calendar,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageContainer } from '@/components/layout';
import {
  useNotification,
  useMarkAsRead,
  useDeleteNotification,
} from '@/lib/hooks/useNotifications';
import { extractApiError } from '@/lib/utils/api-error';

/******************************************************************************
                               Types
******************************************************************************/

interface NotificationDetailPageProps {
  params: Promise<{ id: string }>;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Notification detail page.
 */
function NotificationDetailPage({ params }: NotificationDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const notificationQuery = useNotification(id);
  const markAsReadMutation = useMarkAsRead();
  const deleteMutation = useDeleteNotification();

  const notification = notificationQuery.data?.data;
  const isUnread = notification && !notification.read_at;

  // Auto mark as read when viewing
  useEffect(() => {
    if (isUnread) {
      markAsReadMutation.mutate(notification.id);
    }
    // Only run when notification first loads as unread
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnread]);

  const handleDelete = useCallback(() => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Notification deleted');
        router.push('/notifications');
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        toast.error(apiError.message || 'Failed to delete notification');
      },
    });
  }, [id, deleteMutation, router]);

  // Loading state
  if (notificationQuery.isLoading) {
    return (
      <PageContainer variant="detail">
        <NotificationDetailSkeleton />
      </PageContainer>
    );
  }

  // Error state
  if (notificationQuery.isError) {
    return (
      <PageContainer variant="detail">
        <ErrorState
          title="Failed to load notification"
          description="We couldn't load this notification. It may not exist or you don't have access."
          retry={() => notificationQuery.refetch()}
        />
      </PageContainer>
    );
  }

  // Not found
  if (!notification) {
    return (
      <PageContainer variant="detail">
        <EmptyState
          icon={Bell}
          title="Notification not found"
          description="This notification doesn't exist or you don't have access to view it."
          action={{ label: 'Back to Notifications', onClick: () => router.push('/notifications') }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="detail">
      {/* Back link */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Main content */}
      <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{notification.title}</h1>
        </div>

        {/* Message */}
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-sm whitespace-pre-line">{notification.message}</p>
        </div>

        {/* Action URL */}
        {notification.action_url && (
          <a
            href={notification.action_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Open link
          </a>
        )}

        {/* Metadata */}
        <div className="flex items-start gap-3 text-sm">
          <div className="mt-0.5 rounded-full bg-muted p-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <span className="text-muted-foreground">Received:</span>{' '}
            <span className="font-medium">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </span>
            <span className="text-muted-foreground">
              {' '}&middot; {format(new Date(notification.created_at), 'MMM d, yyyy \'at\' h:mm a')}
            </span>
          </div>
        </div>

        {/* Delete action */}
        <div className="pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete notification
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

/**
 * Loading skeleton for the detail page.
 */
function NotificationDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-6 w-48" />
    </div>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default NotificationDetailPage;

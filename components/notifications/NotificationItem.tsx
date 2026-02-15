'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types/notification';

/******************************************************************************
                                Types
******************************************************************************/

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  isCompact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/******************************************************************************
                                Component
******************************************************************************/

/**
 * Default component. Single notification row for dropdown and full page.
 */
function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  isCompact = false,
  className,
  style,
}: NotificationItemProps) {
  const router = useRouter();
  const isUnread = !notification.read_at;

  const handleClick = useCallback(() => {
    // Mark as read
    if (isUnread) {
      onMarkAsRead(notification.id);
    }
    // Navigate if action_url exists
    if (notification.action_url) {
      window.open(notification.action_url, '_blank', 'noopener,noreferrer');
    }
  }, [isUnread, notification.id, notification.action_url, onMarkAsRead]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(notification.id);
    },
    [notification.id, onDelete]
  );

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group relative flex gap-3 transition-colors cursor-pointer',
        isCompact ? 'px-4 py-3' : 'px-5 py-4',
        'hover:bg-muted/40',
        isUnread && 'bg-primary/5',
        className
      )}
      style={style}
    >
      {/* Unread indicator */}
      {isUnread && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
      )}

      {/* Content */}
      <div className={cn('flex-1 min-w-0', isUnread && 'pl-2')}>
        <p className={cn(
          'text-sm truncate',
          isUnread ? 'font-semibold' : 'font-medium'
        )}>
          {notification.title}
        </p>
        <p className={cn(
          'text-xs text-muted-foreground mt-0.5',
          isCompact ? 'line-clamp-1' : 'line-clamp-2'
        )}>
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {notification.action_url && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(notification.action_url!, '_blank', 'noopener,noreferrer');
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open link</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

/******************************************************************************
                                Export default
******************************************************************************/

export default NotificationItem;
export { NotificationItem };

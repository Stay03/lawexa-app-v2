'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  AtSign,
  Bell,
  Boxes,
  Building2,
  ExternalLink,
  Hash,
  Trash2,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types/notification';

/**
 * Type-aware display for the Channels notification types, whose `title` /
 * `message` come back null (the client renders from `type`).
 *
 * A MISS HERE COSTS A GLYPH, NOT A DESTINATION. This map is read for the icon
 * and the fallback title and for nothing else — where a click goes is worked out
 * from the row's own `action_url` (see `internalActionPath`), so a `type` string
 * this map does not know still lands in the right place with a generic bell.
 * That matters for the quiz kind, registered below under BOTH spellings because
 * the inbox names types by class while the broadcast payload uses snake case,
 * and only the snake-case form has ever been documented.
 */
const CHANNELS_NOTIFICATIONS: Record<
  string,
  { icon: LucideIcon; title: string }
> = {
  ChannelMentionNotification: { icon: AtSign, title: 'You were mentioned' },
  ChannelInviteNotification: { icon: Hash, title: 'Channel invitation' },
  SpaceInviteNotification: { icon: Boxes, title: 'Space invitation' },
  OrganizationInviteNotification: {
    icon: Building2,
    title: 'Organization invitation',
  },
  // A quiz lobby opened in a channel (backend, 2026-08-05).
  ChannelQuizLiveNotification: { icon: Trophy, title: 'A quiz is live' },
  channel_quiz_live: { icon: Trophy, title: 'A quiz is live' },
};

/**
 * The quiz-live deep link names a BACKEND path (`/channels/{c}/quiz-games/{g}`)
 * that this app has no route for; the lobby lives on the channel page behind
 * `?game=`. Rewriting it here keeps the click off a 404 — and on an account
 * running the new experience the same URL opens the lobby itself.
 *
 * Duplicated rather than shared: this file is v1, and v1 must not import from
 * the v2 tree (the counterpart lives in
 * `v2/features/notifications/presentation.ts`).
 */
const QUIZ_GAME_PATH = /^\/channels\/([^/]+)\/quiz-games\/([^/]+)\/?$/;

function toAppPath(actionUrl: string): string {
  const match = QUIZ_GAME_PATH.exec(actionUrl.split(/[?#]/)[0]);
  return match ? `/channels/${match[1]}?game=${match[2]}` : actionUrl;
}

/**
 * WHERE A ROW'S OWN LINK ACTUALLY GOES — computed from the `action_url` alone.
 *
 * THE TYPE MAP IS NOT ALLOWED TO GATE THIS, and that is the point. The rewrite
 * above used to run only for rows found in {@link CHANNELS_NOTIFICATIONS}, so
 * one wrong key in that map — and the quiz kind is registered under two spellings
 * precisely because nobody has been able to observe which one the inbox sends —
 * turned a translated link back into a 404. Reading the URL instead makes a
 * missed key cost a generic icon and title, never a broken destination. It is
 * also what the v2 counterpart already does.
 *
 * A LEADING `//` IS REFUSED, because it is an OFF-SITE address wearing a path's
 * clothes: `startsWith('/')` would accept `//example.com` and hand it straight to
 * the router. That mattered less while only six known types reached this code;
 * now that every row does, it is the guard that keeps the widening honest.
 */
function internalActionPath(actionUrl: string | null | undefined): string | null {
  if (!actionUrl) return null;
  if (!actionUrl.startsWith('/') || actionUrl.startsWith('//')) return null;
  return toAppPath(actionUrl);
}

/******************************************************************************
                                Types
******************************************************************************/

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
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
  onClose,
  isCompact = false,
  className,
  style,
}: NotificationItemProps) {
  const router = useRouter();
  const isUnread = !notification.read_at;

  const channelsMeta = CHANNELS_NOTIFICATIONS[notification.type];
  const Icon = channelsMeta?.icon ?? Bell;
  const displayTitle = notification.title || channelsMeta?.title || 'Notification';
  // A row that carries an in-app path is followed directly, translated, instead
  // of going to the generic detail page — see `internalActionPath`.
  const internalTarget = internalActionPath(notification.action_url);
  /** What the "Open link" control opens: the translated path when there is one,
   *  otherwise the row's link exactly as the server sent it. `null` = no link,
   *  and then there is no control either. */
  const openTarget = internalTarget ?? notification.action_url ?? null;

  const handleClick = useCallback(() => {
    if (isUnread) {
      onMarkAsRead(notification.id);
    }
    onClose?.();
    router.push(internalTarget ?? `/notifications/${notification.id}`);
  }, [isUnread, notification.id, onMarkAsRead, onClose, router, internalTarget]);

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

      {/* Type icon */}
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          isUnread
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground',
          isUnread && 'ml-2'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm truncate',
          isUnread ? 'font-semibold' : 'font-medium'
        )}>
          {displayTitle}
        </p>
        {notification.message && (
          <p className={cn(
            'text-xs text-muted-foreground mt-0.5',
            isCompact ? 'line-clamp-1' : 'line-clamp-2'
          )}>
            {notification.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground/70 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {openTarget && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  // The SAME address the row's own click uses. This control was
                  // left on the raw `action_url`, so a quiz-live row's "Open
                  // link" opened the backend path — a 404 in both trees.
                  window.open(openTarget, '_blank', 'noopener,noreferrer');
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ArrowLeft, Bell, CheckCheck, Settings2 } from 'lucide-react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { notificationsApi } from '@/lib/api/notifications';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { notificationsQueries } from '@/v2/features/notifications/queries';
import { optimisticMutation } from '@/v2/runtime/mutations';
import { NotificationDeliveryControls } from './NotificationDeliveryControls';
import type {
  MarkAllReadResponse,
  MarkReadResponse,
  Notification,
  NotificationListParams,
  NotificationListResponse,
  UnreadCountResponse,
} from '@/types/notification';

/**
 * V2NotificationBell — the v2-native notification bell (v1's
 * `components/notifications/*` is boundary-blocked; only the data layer is
 * shared). Bell + unread badge on a desktop Popover, a mobile bottom Sheet.
 *
 * The badge count sits on the LIVE tier so it self-heals on refocus, and the
 * phase-5 spine invalidates it on every `.notification` broadcast, so it also
 * moves without a refocus. Guests never see it: it's hidden entirely when
 * signed out (`signedIn` prop threaded from the server-verified session via
 * `V2Header`).
 *
 * The panel is TWO views behind one gear: the list, and the spine's delivery
 * switches (`NotificationDeliveryControls` — see that module for why they
 * belong here). They swap rather than stack, so the panel's height is the
 * same either way and the footer link is never pushed out of reach.
 */

/** The single list variant the panel reads; a module constant so its query key
 *  is identical between the panel's `useQuery` and the mutations that patch it. */
const LIST_PARAMS: NotificationListParams = { per_page: 10 };

/** Optimistic `read_at` stamp. Module-level (not a component/hook) so the
 *  `new Date()` is outside render and never trips the React Compiler lint; it's
 *  only ever called inside a mutation's `onMutate`. */
function nowIso(): string {
  return new Date().toISOString();
}

/** Relative "5 minutes ago" label. `parseISO` (not `new Date(str)`) keeps the
 *  literal out of render; the panel is client-only (never SSR'd), so the live
 *  "now" inside `formatDistanceToNow` can't cause a hydration mismatch. */
function relativeTime(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true });
}

export function V2NotificationBell({ signedIn }: { signedIn: boolean }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const unreadQuery = useQuery({
    ...notificationsQueries.unreadCount(),
    enabled: signedIn,
  });

  // Guests get no bell at all. All hooks above run unconditionally.
  if (!signedIn) return null;

  const count = unreadQuery.data?.data.unread_count ?? 0;
  const hasBadge = count > 0;

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className="relative size-11 rounded-full text-muted-foreground md:size-9"
      aria-label={
        hasBadge
          ? `Notifications, ${count} unread`
          : 'Notifications'
      }
    >
      <Bell className="size-5" />
      {/* Unread badge — a PERSISTENT node whose scale + opacity tween in BOTH
          directions (owner #24), so it never hard-pops on appear nor snaps away
          on the last read. The count text is dropped while hidden so a "0" is
          never shown mid-collapse; the button's aria-label carries the real
          count for assistive tech (this is aria-hidden). */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background transition-all duration-200 ease-out motion-reduce:transition-none',
          hasBadge ? 'scale-100 opacity-100' : 'scale-0 opacity-0',
        )}
      >
        {hasBadge ? (count > 99 ? '99+' : count) : null}
      </span>
    </Button>
  );

  const close = () => setOpen(false);

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        {/* The CONTAINER owns the height cap and the panel flexes inside it,
            so the footer link stays on screen on a short phone (audit L3). */}
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="v2-safe-bottom flex max-h-[85svh] flex-col gap-0 rounded-t-2xl p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>
              Your recent notifications, newest first.
            </SheetDescription>
          </SheetHeader>
          <NotificationPanel unreadCount={count} onNavigate={close} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="flex max-h-[min(32rem,calc(100svh-5rem))] w-[22rem] flex-col p-0"
      >
        <NotificationPanel unreadCount={count} onNavigate={close} />
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The panel body shared by the Popover and the Sheet. Mounted only while the
 * container is open (Radix unmounts closed content), so its list query runs on
 * demand and there's no idle background fetch of the list.
 */
function NotificationPanel({
  unreadCount,
  onNavigate,
  bodyClassName,
}: {
  unreadCount: number;
  onNavigate: () => void;
  /** Optional cap for the scrolling region; normally the CONTAINER caps it. */
  bodyClassName?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // The panel has TWO views behind one surface (audit L4). Settings SWAP with
  // the list instead of stacking under it: stacked, they pushed the footer
  // link off a short viewport and read as something bolted on the end. Swapped,
  // the panel keeps one height and the gear is an ordinary destination.
  const [showSettings, setShowSettings] = useState(false);

  const listQuery = useQuery(notificationsQueries.list(LIST_PARAMS));
  const notifications = listQuery.data?.data ?? [];

  // Mark one read: optimistically flip the row in the LIST, then invalidate the
  // COUNT so the badge reconciles. The patched key stays out of `invalidates`.
  const markRead = useMutation(
    optimisticMutation<MarkReadResponse, string, NotificationListResponse>(
      queryClient,
      {
        mutationFn: (id) => notificationsApi.markAsRead(id),
        queryKey: notificationsQueries.list(LIST_PARAMS).queryKey,
        optimisticUpdate: (previous, id) =>
          previous
            ? {
                ...previous,
                data: previous.data.map((item) =>
                  item.id === id
                    ? { ...item, read_at: item.read_at ?? nowIso() }
                    : item,
                ),
              }
            : previous,
        meta: { invalidates: [notificationsQueries.unreadCount().queryKey] },
      },
    ),
  );

  // Mark all read: optimistically zero the COUNT (the most visible feedback),
  // then invalidate the LISTS so every row reconciles as read.
  const markAll = useMutation(
    optimisticMutation<MarkAllReadResponse, void, UnreadCountResponse>(
      queryClient,
      {
        mutationFn: () => notificationsApi.markAllAsRead(),
        queryKey: notificationsQueries.unreadCount().queryKey,
        optimisticUpdate: (previous) =>
          previous ? { ...previous, data: { unread_count: 0 } } : previous,
        meta: { invalidates: [notificationsQueries.lists()] },
      },
    ),
  );

  const handleSelect = (notification: Notification) => {
    if (!notification.read_at) markRead.mutate(notification.id);
    onNavigate();
    const target =
      notification.action_url && notification.action_url.startsWith('/')
        ? notification.action_url
        : `/notifications/${notification.id}`;
    router.push(target);
  };

  return (
    // `min-h-0` on the body row is what lets the panel bound its own height:
    // the header and the footer link keep their size and the SCROLLING region
    // gives way, so the footer is reachable on any viewport (audit L3).
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {showSettings ? 'Notification settings' : 'Notifications'}
        </h2>
        <div className="flex items-center gap-1">
          {!showSettings && unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto gap-1.5 px-2 py-1 text-xs text-muted-foreground"
              onClick={() => markAll.mutate(undefined)}
              disabled={markAll.isPending}
            >
              <CheckCheck className="size-3.5" />
              Mark all as read
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label={
              showSettings ? 'Back to notifications' : 'Notification settings'
            }
            aria-expanded={showSettings}
            onClick={() => setShowSettings((open) => !open)}
          >
            {showSettings ? (
              <ArrowLeft className="size-4" />
            ) : (
              <Settings2 className="size-4" />
            )}
          </Button>
        </div>
      </div>

      <Separator />

      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overscroll-contain',
          bodyClassName ?? 'max-h-96',
        )}
      >
        {showSettings ? (
          <NotificationDeliveryControls />
        ) : listQuery.isLoading ? (
          <PanelSkeleton />
        ) : listQuery.isError ? (
          <PanelError onRetry={() => listQuery.refetch()} />
        ) : notifications.length === 0 ? (
          <PanelEmpty />
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <NotificationRow
                  notification={notification}
                  onSelect={handleSelect}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Separator />

      <div className="shrink-0 p-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={onNavigate}
        >
          <Link href="/notifications">View all notifications</Link>
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function NotificationRow({
  notification,
  onSelect,
}: {
  notification: Notification;
  onSelect: (notification: Notification) => void;
}) {
  const isUnread = !notification.read_at;
  const title = notification.title || 'Notification';

  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
        isUnread && 'bg-primary/5',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
          isUnread
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground',
        )}
        aria-hidden="true"
      >
        <Bell className="size-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-sm',
              isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground',
            )}
          >
            {title}
          </span>
          {isUnread ? (
            <span
              className="size-2 shrink-0 rounded-full bg-primary"
              aria-label="Unread"
            />
          ) : null}
        </span>
        {notification.message ? (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
            {notification.message}
          </span>
        ) : null}
        <span className="mt-1 block text-xs text-muted-foreground/70">
          {relativeTime(notification.created_at)}
        </span>
      </span>
    </button>
  );
}

function PanelSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2 py-0.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PanelEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <span
        className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <Bell className="size-5" />
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          New notifications will show up here.
        </p>
      </div>
    </div>
  );
}

function PanelError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">
        Couldn&apos;t load notifications
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

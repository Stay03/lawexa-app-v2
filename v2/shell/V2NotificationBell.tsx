'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, CheckCheck, ChevronRight, Settings2 } from 'lucide-react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
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
import { flattenUnique } from '@/v2/features/notifications/cache';
import {
  useActivateNotification,
  useDeleteNotificationWithUndo,
  useHiddenNotificationIds,
  useMarkAllNotificationsRead,
} from '@/v2/features/notifications/mutations';
import { NotificationRow } from '@/v2/features/notifications/NotificationRow';
import { presentNotification } from '@/v2/features/notifications/presentation';
import { notificationsQueries } from '@/v2/features/notifications/queries';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { NotificationDeliveryControls } from './NotificationDeliveryControls';
import type { Notification } from '@/types/notification';

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
 * same either way and the list keeps one height whichever view is showing.
 *
 * ── THE PANEL AND `/notifications` ARE ONE INBOX (2026-10-05) ────────────
 * On 2026-08-04 the panel lost its "View all" link, because `/notifications`
 * was not in the v2 manifest and following it ejected the reader into v1. The
 * v2 inbox now exists, so the link is back as the panel's footer and stays
 * inside the shell. The two surfaces share everything that could disagree:
 *  - ONE cache entry for the All stream (`notificationsQueries.infiniteList()`,
 *    20 rows a page on both), so either one paints from the other's rows;
 *  - ONE set of writes (`notifications/mutations.ts`), which patch every
 *    cached stream, so a row read here is read on the page and the other way
 *    round, and the badge moves with both;
 *  - ONE row (`NotificationRow`), so a row says the same thing, presses the
 *    same way and shows the same compact time ("5m") in both places.
 * The panel still pages in place ("Show older"), so a reader who never opens
 * the page loses nothing.
 */

export function V2NotificationBell({
  signedIn,
  className,
}: {
  signedIn: boolean;
  /** Extra classes for the TRIGGER. The bar passes the solid-circle treatment
   *  here on a see-through top-level screen (`V2Header#OPEN_BAR_CONTROL`); the
   *  panel this opens is untouched by it. */
  className?: string;
}) {
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
      className={cn(
        'relative size-11 rounded-full text-muted-foreground md:size-9',
        className,
      )}
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
            so the list can scroll on a short phone (audit L3). */}
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
  // The panel has TWO views behind one surface (audit L4). Settings SWAP with
  // the list instead of stacking under it: stacked, they pushed the rest of the
  // panel off a short viewport and read as something bolted on the end.
  // Swapped, the panel keeps one height and the gear is an ordinary destination.
  const [showSettings, setShowSettings] = useState(false);
  // Frozen when the panel opens (it mounts on open), for the rows' relative
  // times, so no `Date.now()` runs in render.
  const [now] = useState(() => Date.now());

  const listQuery = useInfiniteQuery(notificationsQueries.infiniteList());
  // A row whose delete is queued (the undo window) or in flight is not
  // painted, by this panel or by the page.
  const hidden = useHiddenNotificationIds();
  const pages = listQuery.data?.pages;
  const notifications = useMemo(() => {
    const unique = flattenUnique(pages);
    return hidden.size === 0 ? unique : unique.filter((row) => !hidden.has(row.id));
  }, [pages, hidden]);

  const markAll = useMarkAllNotificationsRead();
  const deleteWithUndo = useDeleteNotificationWithUndo();
  const activate = useActivateNotification();

  /**
   * A press does two independent things: it settles the row (mark read, and a
   * transcript warmed for a channel row; see `useActivateNotification`), and
   * the row's own element follows its destination: a `<Link>` for an internal
   * path, which keeps a channel deep link inside the v2 shell, a new tab for
   * an external URL. A row with a destination closes the panel on the way; a
   * row without one stays open, and expands in place when it has a preview.
   */
  const handleActivate = useCallback(
    (notification: Notification) => {
      activate(notification);
      if (presentNotification(notification).destination.kind !== 'none') onNavigate();
    },
    [activate, onNavigate],
  );

  // The shared deferred send with a six-second Undo: the API cannot restore a
  // deleted notification, so the window comes before the request.
  const handleDelete = useCallback(
    (notification: Notification) => deleteWithUndo(notification),
    [deleteWithUndo],
  );

  return (
    // `min-h-0` on the body row is what lets the panel bound its own height:
    // the header keeps its size and the SCROLLING region gives way, so the
    // panel fits any viewport (audit L3).
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
              onClick={() => markAll.mutate()}
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
        ) : notifications.length === 0 ? (
          // The error state belongs to an EMPTY panel only. Once rows are on
          // screen they stay: a failed refetch (or a failed older page) must
          // not swallow notifications the reader can already see — the retry
          // then lives on the button at the end of the stream.
          listQuery.isError ? (
            <PanelError onRetry={() => void listQuery.refetch()} />
          ) : (
            <PanelEmpty />
          )
        ) : (
          <>
            <ul className="divide-y divide-border">
              {notifications.map((notification, index) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  index={index}
                  now={now}
                  density="panel"
                  onActivate={handleActivate}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
            {/* Older pages load INTO the stream, so the affordance lives at the
                end of the list rather than in a fixed footer — when the last
                page arrives it simply stops being part of the scroll, with no
                chrome appearing or vanishing around the panel. */}
            {listQuery.hasNextPage ? (
              <div className="p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => void listQuery.fetchNextPage()}
                  disabled={listQuery.isFetchingNextPage}
                >
                  {listQuery.isFetchingNextPage
                    ? 'Loading older…'
                    : listQuery.isFetchNextPageError
                      ? 'Try again'
                      : 'Show older'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* The way to the whole inbox. Present in both views, so the panel's
          height does not change when the gear swaps them. */}
      <Separator />
      <Link
        href="/notifications"
        onClick={onNavigate}
        className={cn(
          'v2-interactive flex min-h-11 items-center justify-between gap-2 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 md:min-h-10',
          FOCUS_RING,
        )}
      >
        All notifications
        <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
      </Link>
    </div>
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

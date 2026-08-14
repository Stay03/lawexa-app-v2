'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
  ArrowLeft,
  AtSign,
  Bell,
  CheckCheck,
  Reply,
  Settings2,
  Trash2,
  Trophy,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
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
import {
  notificationChannelUuid,
  notificationMessageUuid,
  presentNotification,
  type NotificationDestination,
  type NotificationMark,
  type NotificationPresentation,
} from '@/v2/features/notifications/presentation';
import { notificationsQueries } from '@/v2/features/notifications/queries';
import { warmChannelHistory } from '@/v2/features/channels/warm';
import { optimisticMutation } from '@/v2/runtime/mutations';
import { useV2Session } from '@/v2/runtime/session-context';
import { NotificationDeliveryControls } from './NotificationDeliveryControls';
import type {
  DeleteNotificationResponse,
  MarkAllReadResponse,
  MarkReadResponse,
  Notification,
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
 * same either way and the list keeps one height whichever view is showing.
 *
 * ── THIS PANEL IS THE WHOLE INBOX (2026-08-04) ────────────────────────────
 * It used to end in a "View all notifications" link to `/notifications`. That
 * path is not in `v2/routes.manifest.ts`, so following it left the v2 shell
 * and landed on v1's page — v1 chrome, v1 header, a full document load. A
 * link out of the experience is not a feature, so the link is gone and the
 * list PAGINATES IN PLACE instead: ten rows on open, "Show older" for the
 * rest. Nothing is unreachable, and the reader never leaves v2. A real v2
 * `/notifications` route (manifest entry + `app/v2/notifications`) is the
 * follow-up for whoever owns those files; this panel needs no change when it
 * arrives.
 */

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

/**
 * Flatten the loaded pages, dropping any row already seen.
 *
 * Offset pagination over a LIVE inbox repeats itself: a notification that
 * arrives between "page 1" and "page 2" pushes the boundary row down into the
 * next page, which would then render twice under the same React key. The first
 * copy wins, so the newest page's version of a row is the one kept.
 */
function uniqueById(rows: readonly Notification[]): Notification[] {
  const seen = new Set<string>();
  const unique: Notification[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    unique.push(row);
  }
  return unique;
}

/**
 * One glyph per kind, so the list is scannable at a glance — and ONLY a glyph.
 * Gold is the single accent in this product and it already means "unread"
 * here, so a mention is not additionally coloured: colour carries read state,
 * shape carries kind, and the two never compete.
 */
const MARK_ICONS: Readonly<Record<NotificationMark, LucideIcon>> = {
  mention: AtSign,
  reply: Reply,
  invite: UserPlus,
  // A quiz lobby has opened somewhere the reader can play. Still only a glyph:
  // the row is time-critical (a lobby self-cancels after ten minutes) but that
  // is what its own words say, not something a second colour may claim.
  quiz: Trophy,
  general: Bell,
};

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
  const router = useRouter();
  const queryClient = useQueryClient();
  // The cache is partitioned by viewer, so warming a transcript needs to know
  // whose transcript it is.
  const viewerId = useV2Session().userId;
  // The panel has TWO views behind one surface (audit L4). Settings SWAP with
  // the list instead of stacking under it: stacked, they pushed the rest of the
  // panel off a short viewport and read as something bolted on the end.
  // Swapped, the panel keeps one height and the gear is an ordinary destination.
  const [showSettings, setShowSettings] = useState(false);

  const listQuery = useInfiniteQuery(notificationsQueries.infiniteList());
  const notifications = uniqueById(
    listQuery.data?.pages.flatMap((page) => page.data) ?? [],
  );

  // Mark one read: optimistically flip the row in the LIST, then invalidate the
  // COUNT so the badge reconciles. The patched key stays out of `invalidates`.
  const markRead = useMutation(
    optimisticMutation<
      MarkReadResponse,
      string,
      InfiniteData<NotificationListResponse>
    >(queryClient, {
      mutationFn: (id) => notificationsApi.markAsRead(id),
      queryKey: notificationsQueries.infiniteList().queryKey,
      optimisticUpdate: (previous, id) =>
        previous
          ? {
              ...previous,
              pages: previous.pages.map((page) => ({
                ...page,
                data: page.data.map((item) =>
                  item.id === id
                    ? { ...item, read_at: item.read_at ?? nowIso() }
                    : item,
                ),
              })),
            }
          : previous,
      meta: { invalidates: [notificationsQueries.unreadCount().queryKey] },
    }),
  );

  // Delete one: drop the row from the LIST immediately, then invalidate the
  // COUNT (deleting an unread row lowers it). It shares `markRead`'s default
  // mutation key — both patch this one list entry — so a burst of row edits
  // reconciles once at the end rather than once each.
  //
  // THIS IS WHY THE PANEL HAS A DELETE AT ALL: v1 offered it on its
  // `/notifications` page, and that page is no longer reachable from the v2
  // shell. Dropping the ejecting link was right; dropping the capability with
  // it was not, so it has a home here instead. There is no restore endpoint,
  // hence no undo to offer — which is why the control is a small, muted,
  // deliberate target at the row's edge rather than anything the eye lands on
  // first.
  const remove = useMutation(
    optimisticMutation<
      DeleteNotificationResponse,
      string,
      InfiniteData<NotificationListResponse>
    >(queryClient, {
      mutationFn: (id) => notificationsApi.delete(id),
      queryKey: notificationsQueries.infiniteList().queryKey,
      optimisticUpdate: (previous, id) =>
        previous
          ? {
              ...previous,
              pages: previous.pages.map((page) => ({
                ...page,
                data: page.data.filter((item) => item.id !== id),
              })),
            }
          : previous,
      meta: { invalidates: [notificationsQueries.unreadCount().queryKey] },
    }),
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

  /**
   * A click does two independent things: it settles the row (mark read) and it
   * follows the row's destination. They are separate on purpose, because a row
   * may have only the first.
   *
   * `internal` is a client-side `router.push`, which keeps a channel deep link
   * (`/channels/{uuid}?m={message_uuid}` — a mention's shape and now a reply's)
   * inside the v2 shell; `/channels/*` is in the v2 manifest, so it resolves to
   * the v2 screen and the `?m=` anchor rides along untouched.
   *
   * `external` opens a new tab rather than navigating this one away — an
   * absolute URL is not ours and must not replace the app.
   *
   * `none` navigates NOWHERE. v1 sends such a row to `/notifications/{id}`,
   * which has no v2 route and would eject the reader into v1. Marking it read
   * is then the entire interaction, and the row visibly settles (the dot goes,
   * the tint goes), so the click is still answered.
   */
  const handleSelect = (
    notification: Notification,
    destination: NotificationDestination,
  ) => {
    if (!notification.read_at) markRead.mutate(notification.id);
    if (destination.kind === 'none') return;
    onNavigate();
    if (destination.kind === 'internal') {
      // WARM THE TRANSCRIPT ONE BEAT BEFORE NAVIGATING. The spine already warms
      // on the socket event, which covers a session that was running when the
      // message arrived; this covers the case it cannot — the app opened cold
      // from a push, where no event was ever received and this press is the
      // first the client hears of the channel. `force`, because a row someone
      // has just pressed is not a candidate to be throttled.
      const channelUuid = notificationChannelUuid(notification);
      if (channelUuid) {
        warmChannelHistory(queryClient, {
          channelUuid,
          messageUuid: notificationMessageUuid(notification),
          viewerId,
          force: true,
        });
      }
      router.push(destination.href);
      return;
    }
    window.open(destination.href, '_blank', 'noopener,noreferrer');
  };

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
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <NotificationRow
                    notification={notification}
                    onSelect={handleSelect}
                    onDelete={(id) => remove.mutate(id)}
                  />
                </li>
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
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * One inbox row. Everything it says comes from
 * `v2/features/notifications/presentation.ts` — see that module for how a
 * pre-deploy wordless row degrades to its own kind instead of to the bare word
 * "Notification".
 *
 * A row with NOTHING to do — no destination and already read — is not a
 * button. Rendering a dead control that answers a click with nothing is worse
 * than rendering plain text, so the same body is emitted either interactively
 * or inert, and the affordance always matches what a click will actually do.
 *
 * Delete is a SIBLING control, never nested inside the row's button (invalid
 * HTML, and an unreachable target for the keyboard). On a pointer device it
 * fades in with the row's hover; on touch, where there is no hover, it is
 * simply always there — a capability that only works with a mouse is not a
 * capability. Its space is reserved either way, so nothing shifts.
 */
function NotificationRow({
  notification,
  onSelect,
  onDelete,
}: {
  notification: Notification;
  onSelect: (
    notification: Notification,
    destination: NotificationDestination,
  ) => void;
  onDelete: (id: string) => void;
}) {
  const isUnread = !notification.read_at;
  const presentation = presentNotification(notification);
  const isActionable = presentation.destination.kind !== 'none' || isUnread;

  const body = (
    <NotificationRowBody
      presentation={presentation}
      isUnread={isUnread}
      createdAt={notification.created_at}
    />
  );
  const bodyClasses = 'flex min-w-0 flex-1 items-start gap-3 py-3 pl-4 text-left';

  return (
    <div
      className={cn(
        'group relative flex items-start transition-colors duration-150 hover:bg-muted/50 motion-reduce:transition-none',
        isUnread && 'bg-primary/5',
      )}
    >
      {isActionable ? (
        <button
          type="button"
          onClick={() => onSelect(notification, presentation.destination)}
          className={bodyClasses}
        >
          {body}
        </button>
      ) : (
        <div className={bodyClasses}>{body}</div>
      )}
      <div className="flex shrink-0 items-center py-3 pl-1 pr-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete notification"
          onClick={() => onDelete(notification.id)}
          className="size-7 text-muted-foreground/60 transition-opacity duration-150 hover:text-foreground focus-visible:opacity-100 motion-reduce:transition-none md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function NotificationRowBody({
  presentation,
  isUnread,
  createdAt,
}: {
  presentation: NotificationPresentation;
  isUnread: boolean;
  createdAt: string;
}) {
  const MarkIcon = MARK_ICONS[presentation.mark];

  return (
    <>
      <span
        className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
          isUnread
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground',
        )}
        aria-hidden="true"
      >
        <MarkIcon className="size-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-sm',
              isUnread
                ? 'font-semibold text-foreground'
                : 'font-medium text-foreground',
            )}
          >
            {presentation.title}
          </span>
          {isUnread ? (
            <span
              className="size-2 shrink-0 rounded-full bg-primary"
              aria-label="Unread"
            />
          ) : null}
        </span>
        {/* No preview, no placeholder. A pre-deploy row carries no message and
            must not be given one — its title already states what it is. */}
        {presentation.preview ? (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
            {presentation.preview}
          </span>
        ) : null}
        <span className="mt-1 block text-xs text-muted-foreground/70">
          {relativeTime(createdAt)}
        </span>
      </span>
    </>
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

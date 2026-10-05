'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { Notification } from '@/types/notification';
import {
  useExitingRows,
  type PresentedRow,
} from '@/v2/features/bookmarks/list/use-exiting-rows';
import { useV2Session } from '@/v2/runtime/session-context';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { useNewRows } from '@/v2/runtime/use-new-rows';
import { ACTION_PILL, FOCUS_RING } from '@/v2/shell/designs/modules';
import { NewRowsPill } from '@/v2/shell/NewRowsPill';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useMounted } from '@/v2/shell/use-mounted';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { flattenUnique } from './cache';
import { FilterTabs } from './FilterTabs';
import {
  apiReadFilter,
  parseReadFilter,
  readParam,
  type NotificationFilter,
} from './filter';
import { groupByDay } from './group-by-day';
import {
  NOTIFICATION_UNDO_WINDOW_MS,
  useActivateNotification,
  useDeleteNotificationWithUndo,
  useHiddenNotificationIds,
  useMarkAllNotificationsRead,
} from './mutations';
import { NotificationRow } from './NotificationRow';
import { notificationsQueries } from './queries';
import {
  NextPageSkeleton,
  NotificationsEmptyState,
  NotificationsErrorState,
  NotificationsListSkeleton,
  NotificationsSignedOutState,
} from './states';

/**
 * NotificationsInbox — the `/notifications` body, and the `useSearchParams`
 * consumer (so it lives under the Suspense boundary in `NotificationsScreen`).
 *
 * ── ONE STREAM, NEWEST FIRST, UNDER DAY HEADERS ────────────────────────────
 * The API's own order is the answer to the question people bring to an inbox
 * ("what came in?"), so it is kept, and day headers (Today, Yesterday, the
 * weekday, then the date) give it landmarks without regrouping it. Older rows
 * load INTO the stream as the sentinel nears the end; there are no numbered
 * pages, because a page number in a live inbox is not an address anyone keeps.
 *
 * ── THE URL IS THE STATE ────────────────────────────────────────────────────
 * `?read=unread` is the Unread tab, written with the LOUD native-history write
 * (`replaceUrlParams`), the `/bookmarks` argument verbatim: this component reads
 * it back through `useSearchParams`, and the server page reads no params, so a
 * router navigation would pay an RSC round trip for a filter the client already
 * applied. Absent means All.
 *
 * ── THE BELL AND THIS PAGE ARE ONE CACHE ───────────────────────────────────
 * The All tab reads the very entry the header bell reads, and every write goes
 * through the shared hooks in `mutations.ts`, which patch every cached stream.
 * Marking a row read here clears its dot in the bell in the same frame, and
 * the other way round.
 *
 * ── NOTHING ARRIVES UNDER THE READER'S EYES ────────────────────────────────
 *  - New rows from a refetch or a `.notification` broadcast are withheld
 *    behind "N new notifications" (`useNewRows` + `NewRowsPill`) instead of
 *    pushing the list down. A read-state change or a delete applies at once.
 *  - A deleted row, and a row read on the Unread tab, FOLD out through the
 *    presence holdover (`useExitingRows`) instead of vanishing.
 *  - A row whose delete is queued or in flight cannot be repainted by any
 *    refetch (`useHiddenNotificationIds`).
 *
 * ── NO ROW RENDERS ON THE SERVER ───────────────────────────────────────────
 * Relative times and day headers are the reader's clock and zone. The query
 * has no server prefetch, so the server render is the skeleton anyway, and the
 * skeleton is also shown until MOUNTED (`useMounted`), so that stays true even
 * if a prefetch is ever added: a server-printed "5m" or "Yesterday" would not
 * match the client's and hydration would fail (React #418). The clock is frozen
 * once at mount, and the list refetches on every visit, so clock and data move
 * together.
 */

const PANEL_ID = 'notifications-list-panel';

/** The heading's classes. Printed by the bar below `md:` (a pushed screen), so
 *  the page heading is visible from `md:` up only and is never shown twice. */
export const INBOX_HEADING =
  'sr-only md:not-sr-only md:mb-3 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground';

/** Module-level so the hooks that take them stay referentially stable, which
 *  is what keeps `NotificationRow`'s `memo` holding. */
const rowKey = (row: Notification): string => row.id;
const sortKey = (row: Notification): number => Date.parse(row.created_at);

/** The polite announcement for the surface, derived from render values only. */
function liveStatus(loading: boolean, announcement: string): string {
  return loading ? 'Loading notifications' : announcement;
}

/** Where focus goes when the row at `index` leaves: the next row still on
 *  screen, else the one before it, else nowhere in the list. */
function neighbourOf(
  presented: readonly PresentedRow<Notification>[],
  index: number,
): string | null {
  for (let next = index + 1; next < presented.length; next += 1) {
    if (!presented[next].exiting) return presented[next].row.id;
  }
  for (let previous = index - 1; previous >= 0; previous -= 1) {
    if (!presented[previous].exiting) return presented[previous].row.id;
  }
  return null;
}

/**
 * Put focus on a row, or on the list panel when there is no row to take it,
 * one frame later so the list has committed. A row whose body is inert (read,
 * no destination, nothing to expand) takes it on its Delete instead.
 */
function focusRow(panel: HTMLElement | null, id: string | null): void {
  requestAnimationFrame(() => {
    if (!panel) return;
    const row = id
      ? panel.querySelector<HTMLElement>(`[data-notification-id="${CSS.escape(id)}"]`)
      : null;
    const target =
      row?.querySelector<HTMLElement>('a[href], button:not([aria-disabled="true"])') ??
      panel;
    target.focus();
  });
}

/** The centred reading column every state shares, and the screen's `h1`. */
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={LIST_COLUMN}>
      <h1 className={INBOX_HEADING}>Notifications</h1>
      {children}
    </div>
  );
}

export function NotificationsInbox() {
  const { signedIn } = useV2Session();
  const searchParams = useSearchParams();
  const filter = parseReadFilter(searchParams.get('read'));
  const mounted = useMounted();

  const [now] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery({
    ...notificationsQueries.infiniteList({ read: apiReadFilter(filter) }),
    enabled: signedIn,
  });
  const unreadQuery = useQuery({
    ...notificationsQueries.unreadCount(),
    enabled: signedIn,
  });
  const unreadCount = unreadQuery.data?.data.unread_count ?? 0;

  const hidden = useHiddenNotificationIds();
  const pages = query.data?.pages;
  const rows = useMemo<readonly Notification[]>(() => {
    const unique = flattenUnique(pages);
    return hidden.size === 0 ? unique : unique.filter((row) => !hidden.has(row.id));
  }, [pages, hidden]);

  const { visibleRows, newCount, accept } = useNewRows({
    rows,
    getId: rowKey,
    getSortKey: sortKey,
    resetKey: filter,
  });
  const { presented, beginExit } = useExitingRows(visibleRows, rowKey);

  const groups = useMemo(
    () =>
      groupByDay(
        presented.map((entry, index) => ({ ...entry, index })),
        (entry) => entry.row.created_at,
        { now },
      ),
    [presented, now],
  );

  const scrollRootRef = useShellScrollRoot();
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    // A failed page stops the observer; the retry below is the way on, so a
    // persistent failure cannot loop a request per intersection.
    hasNextPage: query.hasNextPage && !query.isFetchNextPageError,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    rootRef: scrollRootRef,
    rootMargin: '320px',
  });

  const activate = useActivateNotification();
  const handleActivate = useCallback(
    (notification: Notification, index: number) => {
      // On the Unread tab a row that is read LEAVES the list, so it is held
      // through its fold. When the press also navigates, the page unmounts and
      // nothing needs to play.
      if (filter === 'unread' && !notification.read_at) beginExit(notification, index);
      activate(notification);
    },
    [filter, beginExit, activate],
  );

  const deleteWithUndo = useDeleteNotificationWithUndo();
  const handleDelete = useCallback(
    (notification: Notification, index: number) => {
      const neighbour = neighbourOf(presented, index);
      beginExit(notification, index);
      deleteWithUndo(notification, {
        onUndo: () => {
          setAnnouncement('Notification kept');
          focusRow(panelRef.current, notification.id);
        },
      });
      setAnnouncement(
        `Notification removed. ${Math.round(NOTIFICATION_UNDO_WINDOW_MS / 1000)} seconds to undo.`,
      );
      // The Delete just pressed is leaving with its row; focus moves to the row
      // the reader would reach next, never to `<body>`.
      focusRow(panelRef.current, neighbour);
    },
    [presented, beginExit, deleteWithUndo, setAnnouncement],
  );

  const markAll = useMarkAllNotificationsRead();
  const markAllMutate = markAll.mutate;
  const markAllPending = markAll.isPending;
  const showMarkAll = unreadCount > 0;
  const handleMarkAll = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (markAllPending) return;
    const hadFocus = document.activeElement === event.currentTarget;
    markAllMutate();
    setAnnouncement('Marked all as read');
    // The pill goes inert as the count reaches zero, which would drop focus.
    if (hadFocus) focusRow(panelRef.current, null);
  };

  const setFilter = (next: NotificationFilter) => {
    replaceUrlParams({ read: readParam(next) });
  };

  // A 4xx is a refusal the server explained; a 5xx or a network drop is not,
  // and its message ("Network error…") says less than the designed copy.
  const apiError = query.error ? extractApiError(query.error) : null;
  const explainedError =
    apiError && apiError.status >= 400 && apiError.status < 500
      ? apiError.message
      : undefined;

  // Every state decision reads the loaded set, never a projection.
  const showSkeleton = query.isPending || !mounted;
  const showError = !showSkeleton && query.isError && presented.length === 0;
  const showEmpty = !showSkeleton && !showError && presented.length === 0;

  if (!signedIn) {
    return (
      <PageShell>
        <NotificationsSignedOutState />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Static chrome: the filter row renders on the first frame and never
          waits on data (standards §8i; v1 hid its tabs behind the skeleton). */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterTabs
          value={filter}
          onChange={setFilter}
          unreadCount={unreadCount}
          panelId={PANEL_ID}
        />
        {/* A PERSISTENT node that tweens out when nothing is unread, never a
            conditional mount, and `inert` while hidden so nothing invisible
            sits in the tab order. No toast: the rows settling and the count
            reaching zero are the answer, and the live region says it. */}
        <button
          type="button"
          onClick={handleMarkAll}
          inert={!showMarkAll}
          aria-disabled={markAllPending}
          className={cn(
            ACTION_PILL,
            'ml-auto transition-[opacity,transform,background-color,color] duration-200 ease-out motion-reduce:transition-none',
            showMarkAll ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0',
            FOCUS_RING,
          )}
        >
          <CheckCheck aria-hidden className="size-4" />
          Mark all read
        </button>
      </div>

      {/* The ONE live region for this surface: loading, mark-all, delete and
          undo, all derived from render values. */}
      <span role="status" aria-live="polite" className="sr-only">
        {liveStatus(showSkeleton, announcement)}
      </span>

      <div
        ref={panelRef}
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={`${PANEL_ID}-tab-${filter}`}
        // Focus lands here when the last row leaves, so it is never lost.
        tabIndex={-1}
        className="outline-none"
      >
        {showSkeleton ? (
          <NotificationsListSkeleton />
        ) : showError ? (
          <NotificationsErrorState
            message={explainedError}
            onRetry={() => void query.refetch()}
          />
        ) : showEmpty ? (
          <NotificationsEmptyState filter={filter} onShowAll={() => setFilter('all')} />
        ) : (
          <>
            {query.isRefetchError ? (
              <div
                role="alert"
                className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              >
                <span>Couldn&rsquo;t refresh notifications. Showing what you had.</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void query.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : null}

            <NewRowsPill count={newCount} onAccept={accept} noun="notification" />

            <div className="flex flex-col gap-5">
              {groups.map((group) => (
                <section key={group.key} aria-labelledby={`notifications-day-${group.key}`}>
                  <h2
                    id={`notifications-day-${group.key}`}
                    className="mb-1.5 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    {group.label}
                  </h2>
                  <ul className="flex flex-col">
                    {group.items.map(({ row, exiting, index }) => (
                      <NotificationRow
                        key={row.id}
                        notification={row}
                        index={index}
                        now={now}
                        density="page"
                        exiting={exiting}
                        onActivate={handleActivate}
                        onDelete={handleDelete}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            {/* Sentinel + end-cap: while more pages exist this sits at the end
                of the scroll region; once everything is loaded the quiet
                end-cap replaces it. */}
            <div ref={sentinelRef} className="pt-1">
              {query.isFetchingNextPage ? (
                <NextPageSkeleton />
              ) : query.isFetchNextPageError ? (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-center gap-3 py-5 text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
                >
                  <span>Couldn&rsquo;t load older notifications.</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void query.fetchNextPage()}
                  >
                    Try again
                  </Button>
                </div>
              ) : !query.hasNextPage ? (
                <p className="py-6 text-center text-xs text-muted-foreground/70">
                  No older notifications
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

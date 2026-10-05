'use client';

import { useMemo, useState } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ActivityMessage } from '@/types/chat';
import { useV2Session } from '@/v2/runtime/session-context';
import { useNewRows } from '@/v2/runtime/use-new-rows';
import { useUrlSearch } from '@/v2/runtime/use-url-search';
import { useSearchPosition } from '@/v2/search-position';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { NewRowsPill } from '@/v2/shell/NewRowsPill';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { SearchField } from '@/v2/shell/SearchField';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useMounted } from '@/v2/shell/use-mounted';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { ActivityRun } from './ActivityRun';
import { groupActivity } from './model';
import { activityQueries } from './queries';
import {
  ActivityEmptyState,
  ActivityErrorState,
  ActivityHeading,
  ActivityListSkeleton,
  ActivitySignedOutState,
  NextPageSkeleton,
} from './states';

/** Stable empty rows reference, so `useNewRows` does not re-seed every render. */
const NO_ROWS: readonly ActivityMessage[] = [];

/** Module-level (stable) accessors for `useNewRows`: newest question first. */
const messageId = (row: ActivityMessage): string => String(row.id);
const messageSortKey = (row: ActivityMessage): number => Date.parse(row.created_at);

/**
 * ActivityList — the `/activity` body: every question the reader has asked,
 * newest first, under day headings, with the conversation each belongs to.
 * The `useSearchParams` consumer, so it renders under `ActivityScreen`'s
 * Suspense boundary.
 *
 * ── THE DATA ───────────────────────────────────────────────────────────────
 * `activityQueries.infiniteList` (GET /api/messages, the endpoint v1 used),
 * twenty questions a page, loaded by the shell's sentinel as the reader
 * scrolls. v1's Previous / Next buttons and "Page 2 of 5" are gone: they made
 * a reader looking for last week's question page through it.
 *
 * ── NOTHING DATED RENDERS ON THE SERVER ────────────────────────────────────
 * The day headings ("Today") and the times ("2:05 pm") are the reader's LOCAL
 * day and clock. The server has neither the reader's zone nor the reader's
 * clock, and a server-rendered "Today" or "4:59 pm" that the browser reads
 * differently is React #418, the hydration error the Work page threw on 4
 * October 2026. So the grouped list renders only once `useMounted` is true;
 * until then the list skeleton holds its place. Nothing is lost by it: the
 * query is client-only (no server prefetch), so a hard load paints the
 * skeleton on the server either way. `now` is read ONCE in a lazy initializer,
 * never in render.
 *
 * ── SEARCH ─────────────────────────────────────────────────────────────────
 * The shared URL-synced box (`useUrlSearch`), in the dock or at the top as the
 * developer switch says. The endpoint matches the question's text, and the
 * label says that. While a search resolves the previous rows stay, dimmed
 * (`keepPreviousData`), so typing never flashes a skeleton.
 *
 * ── RETURN VISITS ──────────────────────────────────────────────────────────
 * The unfiltered list is retained for 30 minutes and re-checked on arrival.
 * A question asked since the last visit is held above the reader and counted
 * by the `NewRowsPill` instead of being spliced in under their eyes, exactly
 * as on `/conversations`.
 */
export function ActivityList({ signedIn }: { signedIn: boolean }) {
  const { userId: viewerId } = useV2Session();
  const mounted = useMounted();
  const [now] = useState(() => Date.now());
  const { committedSearch, inputValue, onInputChange, onClear } = useUrlSearch('search');
  const activeSearch = committedSearch.trim();
  const searchAtTop = useSearchPosition() === 'top';

  const query = useInfiniteQuery({
    ...activityQueries.infiniteList({ search: committedSearch, viewerId }),
    enabled: signedIn,
    placeholderData: keepPreviousData,
  });

  const pages = query.data?.pages;
  const items = useMemo(() => pages?.flatMap((page) => page.data) ?? NO_ROWS, [pages]);
  const total = pages?.[0]?.pagination.total ?? 0;

  const { visibleRows, newCount, accept } = useNewRows({
    rows: items,
    getId: messageId,
    getSortKey: messageSortKey,
    resetKey: activeSearch,
    rowsArePlaceholder: query.isPlaceholderData,
  });

  // `undefined` time zone = the reader's own; grouped only once mounted (see
  // the docblock), so this never runs against the server's zone or clock.
  const days = useMemo(
    () => (mounted ? groupActivity(visibleRows, { now }) : []),
    [mounted, visibleRows, now],
  );
  // Each day's first position in the whole list, for the capped entrance stagger.
  const dayOffsets = useMemo(() => {
    const offsets: number[] = [];
    let offset = 0;
    for (const day of days) {
      offsets.push(offset);
      offset += day.runs.length;
    }
    return offsets;
  }, [days]);

  const scrollRootRef = useShellScrollRoot();
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    hasNextPage: query.hasNextPage && !query.isPlaceholderData,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    rootRef: scrollRootRef,
    rootMargin: '320px',
  });

  if (!signedIn) {
    return (
      <div className={LIST_COLUMN_DOCKED}>
        <ActivityHeading />
        <ActivitySignedOutState />
      </div>
    );
  }

  // State decisions read the true loaded set (`items`), never the projection,
  // so withheld new rows can never make a populated list look empty.
  const showSkeleton = query.isPending || !mounted;
  const showError = query.isError && items.length === 0;
  const showEmpty = !showSkeleton && !showError && items.length === 0;
  const showInlineError = query.isError && items.length > 0;
  const dim = query.isPlaceholderData && query.isFetching;

  const searchField = (
    <SearchField
      value={inputValue}
      onChange={onInputChange}
      onClear={onClear}
      busy={query.isFetching && dim}
      placeholder="Search your questions..."
      label="Search the text of your questions"
    />
  );

  return (
    <div className={LIST_COLUMN_DOCKED}>
      <ActivityHeading />
      {searchAtTop ? <div className="mb-4">{searchField}</div> : null}

      {/* Out of flow (`h-0`) and mounted in every state, so its exit always plays. */}
      <NewRowsPill count={newCount} onAccept={accept} noun="question" />

      {showSkeleton ? (
        <ActivityListSkeleton />
      ) : showError ? (
        <ActivityErrorState onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : showEmpty ? (
        <ActivityEmptyState search={activeSearch} onClear={onClear} />
      ) : (
        <div
          className={cn(
            'transition-opacity duration-200 motion-reduce:transition-none',
            dim && 'pointer-events-none opacity-60',
          )}
        >
          {showInlineError ? (
            <div
              role="alert"
              className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
            >
              <span>Couldn&rsquo;t update the list. Showing what loaded last.</span>
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

          {activeSearch && !query.isPlaceholderData ? (
            <p role="status" className="mb-2 px-3 text-xs text-muted-foreground tabular-nums">
              {total === 1 ? '1 question' : `${total} questions`} mention &ldquo;{activeSearch}&rdquo;
            </p>
          ) : null}

          <div className="flex flex-col gap-5">
            {days.map((day, dayIndex) => (
              <section key={day.key} aria-labelledby={`activity-day-${day.key}`}>
                <h2
                  id={`activity-day-${day.key}`}
                  className="mb-1 px-3 text-xs font-medium text-muted-foreground"
                >
                  {day.label}
                </h2>
                <ul className="flex flex-col">
                  {day.runs.map((run, index) => (
                    <ActivityRun key={run.key} run={run} index={dayOffsets[dayIndex] + index} />
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {/* Sentinel + end cap: a skeleton while the next page loads, a quiet
              line once everything has. Never both. */}
          <div ref={sentinelRef} className="pt-1">
            {query.isFetchingNextPage ? (
              <NextPageSkeleton />
            ) : !query.hasNextPage ? (
              <p className="py-6 text-center text-xs text-muted-foreground/70">
                {activeSearch ? 'No more matches' : 'That is every question you have asked'}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {searchAtTop ? null : (
        <ScreenDock>
          <ScreenDockSearch>{searchField}</ScreenDockSearch>
        </ScreenDock>
      )}
    </div>
  );
}

'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ActivityMessage } from '@/types/chat';
import { useV2Session } from '@/v2/runtime/session-context';
import { pushUrlParams } from '@/v2/runtime/url-params';
import { useUrlSearch } from '@/v2/runtime/use-url-search';
import { useSearchPosition } from '@/v2/search-position';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { Pager } from '@/v2/shell/Pager';
import { formatCount, parsePageParam } from '@/v2/shell/pager-model';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { SearchField } from '@/v2/shell/SearchField';
import { useMounted } from '@/v2/shell/use-mounted';
import { ActivityTable } from './ActivityTable';
import { activityRow } from './model';
import { activityQueries } from './queries';
import {
  ActivityEmptyState,
  ActivityErrorState,
  ActivityHeading,
  ActivityPastEndState,
  ActivitySignedOutState,
  ActivityTableSkeleton,
} from './states';

/** Stable empty rows reference, so the row projection does not re-run every render. */
const NO_ROWS: readonly ActivityMessage[] = [];

/** A new search starts on its first page: the search box clears `?page=` as it commits. */
const SEARCH_RESETS: readonly string[] = ['page'];

/**
 * ActivityList — the `/activity` body: every question the reader has asked,
 * newest first, as a paged table, with the chat each was asked in and when.
 * The `useSearchParams` consumer, so it renders under `ActivityScreen`'s
 * Suspense boundary.
 *
 * ── WHY A TABLE ────────────────────────────────────────────────────────────
 * The owner asked for "a clean paginated table here rather than the timeline"
 * (5 October 2026). His own account holds 35,115 questions: a timeline the
 * reader scrolls through cannot say where they are in that, and a page number
 * can. The day headings and per-chat runs went with the timeline.
 *
 * ── THE DATA ───────────────────────────────────────────────────────────────
 * `activityQueries.page` (GET /api/messages, the endpoint v1 used), twenty
 * questions a page. The page lives in the URL (`?page=3`): a press on the
 * pager PUSHES a history entry (`pushUrlParams`), so Back retraces the pages
 * and a reload keeps the one on screen. Page 1 has no parameter.
 *
 * While the next page loads the current one stays on screen, dimmed
 * (`keepPreviousData`), and the pager already shows the page asked for, with
 * a small spinner. The table never empties to a skeleton between pages.
 *
 * ── NOTHING DATED RENDERS ON THE SERVER ────────────────────────────────────
 * The dates ("Today") and the times ("2:05 pm") are the reader's LOCAL day and
 * clock. The server has neither the reader's zone nor the reader's clock, and
 * a server-rendered "Today" or "4:59 pm" that the browser reads differently is
 * React #418, the hydration error the Work page threw on 4 October 2026. So
 * the rows render only once `useMounted` is true; until then the skeleton
 * holds their place. Nothing is lost by it: the query is client-only (no
 * server prefetch), so a hard load paints the skeleton on the server either
 * way. `now` is read ONCE in a lazy initializer, never in render.
 *
 * ── SEARCH ─────────────────────────────────────────────────────────────────
 * The shared URL-synced box (`useUrlSearch`), in the dock or at the top as the
 * developer switch says. The endpoint matches the question's text, and the
 * label says that. A new search drops `?page=` in the same URL write, so it
 * starts on its first page. While it resolves the previous rows stay, dimmed,
 * so typing never flashes a skeleton.
 */
export function ActivityList({ signedIn }: { signedIn: boolean }) {
  const { userId: viewerId } = useV2Session();
  const mounted = useMounted();
  const [now] = useState(() => Date.now());
  const page = parsePageParam(useSearchParams().get('page'));
  const { committedSearch, inputValue, onInputChange, onClear } = useUrlSearch(
    'search',
    SEARCH_RESETS,
  );
  const activeSearch = committedSearch.trim();
  const searchAtTop = useSearchPosition() === 'top';
  const tableTopRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    ...activityQueries.page({ search: committedSearch, page, viewerId }),
    enabled: signedIn,
    placeholderData: keepPreviousData,
  });

  const response = query.data;
  const messages = response?.data ?? NO_ROWS;
  const total = response?.pagination.total ?? 0;
  const lastPage = response?.pagination.last_page ?? 0;

  // `undefined` time zone = the reader's own; projected only once mounted (see
  // the docblock), so this never runs against the server's zone or clock.
  const rows = useMemo(
    () => (mounted ? messages.map((message) => activityRow(message, { now })) : []),
    [mounted, messages, now],
  );

  // Move to a page, and bring the top of the table into view when the reader
  // pressed the pager from below it. Read at press time, never in render.
  const goToPage = useCallback((next: number) => {
    pushUrlParams({ page: next > 1 ? String(next) : null });
    const top = tableTopRef.current;
    if (top && top.getBoundingClientRect().top < 0) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      top.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
  }, []);

  if (!signedIn) {
    return (
      <div className={LIST_COLUMN_DOCKED}>
        <ActivityHeading />
        <ActivitySignedOutState />
      </div>
    );
  }

  const settled = response !== undefined && !query.isPlaceholderData;
  const showSkeleton = query.isPending || !mounted;
  const showError = query.isError && response === undefined;
  // A page past the end (an old link, a hand-edited URL): no rows, but the
  // list itself is not empty, and the server says where it ends.
  const showPastEnd = settled && messages.length === 0 && total > 0 && page > lastPage;
  const showEmpty = !showSkeleton && !showError && !showPastEnd && messages.length === 0;
  const showInlineError = query.isError && response !== undefined;
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

      <div ref={tableTopRef} className="scroll-mt-4">
        {showSkeleton ? (
          <ActivityTableSkeleton />
        ) : showError ? (
          <ActivityErrorState onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : showPastEnd ? (
          <ActivityPastEndState lastPage={lastPage} onGoTo={goToPage} />
        ) : showEmpty ? (
          <ActivityEmptyState search={activeSearch} onClear={onClear} />
        ) : (
          <div aria-busy={dim}>
            {showInlineError ? (
              <div
                role="alert"
                className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              >
                <span>Couldn&rsquo;t load this page. Showing what loaded last.</span>
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

            <p role="status" className="mb-2 h-4 truncate text-xs text-muted-foreground tabular-nums">
              {questionCount(total)}
              {activeSearch ? <> mention &ldquo;{activeSearch}&rdquo;</> : null}
            </p>

            <div
              className={cn(
                'transition-opacity duration-200 motion-reduce:transition-none',
                dim && 'pointer-events-none opacity-60',
              )}
            >
              <ActivityTable rows={rows} />
            </div>

            {lastPage > 1 ? (
              <Pager
                page={page}
                lastPage={lastPage}
                onPageChange={goToPage}
                busy={dim}
                className="mt-4"
              />
            ) : null}
          </div>
        )}
      </div>

      {searchAtTop ? null : (
        <ScreenDock>
          <ScreenDockSearch>{searchField}</ScreenDockSearch>
        </ScreenDock>
      )}
    </div>
  );
}

/** "1 question", "35,115 questions". */
function questionCount(total: number): string {
  return total === 1 ? '1 question' : `${formatCount(total)} questions`;
}

'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import { useV2Session } from '@/v2/runtime/session-context';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { bookmarksQueries } from '../queries';
import { bookmarkTargetKey, usePendingBookmarkRemovals } from '../mutations';
import { bookmarkRow, type BookmarkRowModel } from '../bookmark-row-model';
import { BookmarkRow } from './BookmarkRow';
import { useExitingRows } from './use-exiting-rows';
import { TypeTabs, parseBookmarkTab, type BookmarkTab } from './TypeTabs';
import {
  BookmarksEmptyState,
  BookmarksErrorState,
  BookmarksListSkeleton,
  BookmarksSignedOutState,
  BookmarksVerifyEmailState,
  NextPageSkeleton,
} from './states';

/**
 * BookmarksBrowser — the `/bookmarks` body, and the `useSearchParams` consumer
 * (so it lives under the Suspense boundary in `BookmarksScreen`).
 *
 * ── ONE STREAM, NOT FOUR SECTIONS ───────────────────────────────────────────
 * The endpoint returns everything newest-first, and that order is the answer to
 * the question people actually bring here: "what did I just save?". Grouping the
 * page into per-type sections would bury the most recent thing under whichever
 * heading it happened to belong to. So the types are a FILTER (the tab strip),
 * never a layout — and the stream stays in the API's own order.
 *
 * ── THE URL IS THE STATE ────────────────────────────────────────────────────
 * `?type=` is the tab, written with the LOUD native-history write
 * (`replaceUrlParams`): this component READS it back through `useSearchParams`,
 * which only sees loud writes. `/bookmarks` is a static segment whose server
 * page reads no `searchParams`, so a `router.push` would pay an RSC round trip
 * and re-show `loading.tsx` for a filter the client already applied. Absent
 * means All, so the plain `/bookmarks` URL is the unfiltered view.
 *
 * ── WHO CAN READ THIS (all three answers measured, August 3, 2026) ──────────
 *   - no token          → 401. The query is gated on the session and the
 *                         visitor gets the designed sign-in state.
 *   - guest token       → full READ AND WRITE. Guests really do own bookmarks,
 *                         so nothing here is gated behind "get an account".
 *   - unverified email  → 403 on the read AND the write, with the API's own
 *                         sentence. That is a designed state of its own, not an
 *                         error and not an empty collection.
 *
 * ── NO `keepPreviousData` HERE, DELIBERATELY (review F10) ───────────────────
 * The cases and conversations lists carry previous rows through a filter change
 * because their stale rows are at least the SAME KIND of thing. On this page a
 * tab change changes the KIND: carrying rows over would show cases, dimmed,
 * under a tab labelled "Folders". Dimming does not make wrong content honest.
 * Each tab is its own cache entry with 30-minute retention, so a tab the reader
 * has already visited still paints from cache with no skeleton at all — the
 * "never a skeleton over content already in cache" rule is kept by the cache,
 * which is where it belongs, rather than by borrowing another tab's rows.
 *
 * ── A ROW BEING REMOVED CANNOT BE REPAINTED ────────────────────────────────
 * Rendered rows are filtered through `usePendingBookmarkRemovals`, so a sibling
 * toggle's success-invalidation refetch — which still contains the row whose
 * own DELETE has not landed yet — can never flicker it back. See that hook.
 */

/** Stable empty rows reference — a fresh `[]` per render would churn the memo. */
const NO_ROWS: readonly BookmarkRowModel[] = [];

const PANEL_ID = 'bookmarks-list-panel';

/** Module-level so the presence holdover's `beginExit` stays referentially
 *  stable, which is what keeps `BookmarkRow`'s `memo` holding. */
const rowKey = (row: BookmarkRowModel): string => String(row.bookmarkId);

/**
 * The polite announcement for the list region — pure, so it can only ever
 * describe what is actually rendered.
 *
 * "Removed" (not "removing") is the honest word even while the request is in
 * flight: the row is gone from the reader's list at that instant, which is the
 * whole point of an optimistic write. A failure is announced separately, by the
 * global mutation-error toast, and the row comes back.
 */
function liveStatus(loading: boolean, removing: number): string {
  if (loading) return 'Loading your bookmarks';
  if (removing === 0) return '';
  return removing === 1
    ? 'Removed from your bookmarks'
    : `Removed ${removing} items from your bookmarks`;
}

/**
 * The centred reading column every state shares (`page-columns.ts`), so this
 * page, `/cases`, `/statutes` and `/conversations` are one measure. The plain
 * column, not the docked one: this screen floats nothing.
 *
 * The screen's `h1` is drawn here, so the signed-out panel is under a page that
 * still says what it is and every state carries exactly one heading.
 */
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={LIST_COLUMN}>
      <ScreenTitle />
      {children}
    </div>
  );
}

export function BookmarksBrowser() {
  const { signedIn, userId: viewerId } = useV2Session();
  const searchParams = useSearchParams();
  const tab = parseBookmarkTab(searchParams.get('type'));

  // Frozen at mount for the relative "saved" labels — the list refetches on
  // every visit (`REFETCH_ON_VISIT`), so the clock and the data move together.
  const [now] = useState(() => Date.now());

  const query = useInfiniteQuery({
    ...bookmarksQueries.infiniteList({
      type: tab === 'all' ? undefined : tab,
      viewerId,
    }),
    enabled: signedIn,
  });

  // Rows whose removal is in flight — filtered out before anything else sees
  // them, so no refetch can repaint one (review F2).
  const pendingRemovals = usePendingBookmarkRemovals();

  const pages = query.data?.pages;
  const rows = useMemo<readonly BookmarkRowModel[]>(() => {
    if (!pages) return NO_ROWS;
    const mapped: BookmarkRowModel[] = [];
    for (const page of pages) {
      for (const bookmark of page.data) {
        // `null` = a bookmark type this build does not model. Dropped, not
        // rendered as a broken row (see `bookmarkRow`).
        const row = bookmarkRow(bookmark);
        if (!row) continue;
        if (pendingRemovals.has(bookmarkTargetKey(row.type, row.contentId))) continue;
        mapped.push(row);
      }
    }
    return mapped;
  }, [pages, pendingRemovals]);

  // The presence holdover: a just-removed row keeps rendering, in place, long
  // enough to collapse out instead of vanishing between frames (review F6).
  const { presented, beginExit } = useExitingRows(rows, rowKey);

  const scrollRootRef = useShellScrollRoot();
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    rootRef: scrollRootRef,
    rootMargin: '320px',
  });

  const setTab = (next: BookmarkTab) => {
    replaceUrlParams({ type: next === 'all' ? null : next });
  };

  // The API's own reason, read once.
  //
  // A 403 IS ONLY THE VERIFY-EMAIL STATE WHEN THE SERVER SAYS SO (review F4).
  // Matching on the status alone would greet a suspended or plan-gated account
  // with "verify your email" and a resend button that fixes nothing. The
  // message is the discriminator; anything else falls through to the error
  // state, which shows the server's own sentence rather than inventing a cause.
  const apiError = query.error ? extractApiError(query.error) : null;
  const needsVerification =
    apiError?.status === 403 && /\bverif/i.test(apiError.message);
  // A 4xx is a REFUSAL the server explained; a 5xx or a network drop is not, and
  // its message ("Network error…") is less useful than the designed copy.
  const explainedError =
    apiError && apiError.status >= 400 && apiError.status < 500
      ? apiError.message
      : undefined;

  // Every state decision reads the loaded set, never a projection.
  const showSkeleton = query.isPending;
  const showError = query.isError && presented.length === 0;
  const showEmpty = !showSkeleton && !showError && presented.length === 0;
  const showInlineError = query.isError && presented.length > 0;

  if (!signedIn) {
    return (
      <PageShell>
        <BookmarksSignedOutState />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Static chrome: the tab strip renders on the first frame and never
          waits on data (standards §8i — v1 hid its tabs behind the list's
          loading state, which is exactly what that rule forbids). */}
      <div className="mb-3">
        <TypeTabs value={tab} onChange={setTab} panelId={PANEL_ID} />
      </div>

      {/* The ONE live region for this surface (review F8). The route fallback's
          announcement is gone by the time an in-page fetch or an optimistic
          removal happens, and the skeleton itself is `aria-hidden` — so without
          this, a first load, a tab switch and a removal are all silent. Polite,
          text-only, and derived purely from render values (no state, no effect),
          so it can never announce something that is not on screen. */}
      <span role="status" aria-live="polite" className="sr-only">
        {liveStatus(showSkeleton, pendingRemovals.size)}
      </span>

      <div id={PANEL_ID} role="tabpanel" aria-labelledby={`${PANEL_ID}-tab-${tab}`}>
        {showSkeleton ? (
          <BookmarksListSkeleton />
        ) : showError ? (
          needsVerification ? (
            <BookmarksVerifyEmailState message={apiError.message} />
          ) : (
            <BookmarksErrorState
              message={explainedError}
              onRetry={() => void query.refetch()}
            />
          )
        ) : showEmpty ? (
          <BookmarksEmptyState
            tab={tab}
            onShowAll={tab === 'all' ? undefined : () => setTab('all')}
          />
        ) : (
          <>
            {showInlineError ? (
              <div
                role="alert"
                className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              >
                <span>Couldn&rsquo;t refresh your bookmarks — showing your last ones.</span>
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

            <ul className="flex flex-col divide-y divide-border/60">
              {presented.map(({ row, exiting }, index) => (
                <BookmarkRow
                  key={row.bookmarkId}
                  row={row}
                  index={index}
                  now={now}
                  exiting={exiting}
                  onExit={beginExit}
                />
              ))}
            </ul>

            {/* Sentinel + end-cap: while more pages exist this sits at the end
                of the scroll region; once fully loaded the quiet end-cap
                replaces it. */}
            <div ref={sentinelRef} className="pt-1">
              {query.isFetchingNextPage ? (
                <NextPageSkeleton />
              ) : !query.hasNextPage ? (
                <p className="py-6 text-center text-xs text-muted-foreground/70">
                  No more bookmarks
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

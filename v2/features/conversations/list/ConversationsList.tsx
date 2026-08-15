'use client';

import { useMemo, useState } from 'react';
import { useV2Session } from '@/v2/runtime/session-context';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ConversationListItem } from '@/types/chat';
import { useNewRows } from '@/v2/runtime/use-new-rows';
import { useSearchPosition } from '@/v2/search-position';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { NewRowsPill } from '@/v2/shell/NewRowsPill';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { conversationsQueries } from '@/v2/features/conversations/queries';
import { useConversationsSearch } from './useConversationsSearch';
import { ConversationsSearchBar } from './ConversationsSearchBar';
import { ConversationRow } from './ConversationRow';
import {
  ConversationsEmptyState,
  ConversationsErrorState,
  ConversationsGuestState,
  ConversationsListSkeleton,
  NextPageSkeleton,
} from './states';

/**
 * The centred reading column every list state shares — the SHARED v2 list
 * column (`page-columns.ts`), so this page and `/cases` cannot drift apart. The
 * DOCKED variant, because the search pill floats at the bottom here and a
 * `sticky` element needs a containing block a full screen tall.
 *
 * The screen's `h1` is drawn here, so the guest panel is under a page that
 * still says what it is and every state carries exactly one heading.
 */
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={LIST_COLUMN_DOCKED}>
      <ScreenTitle />
      {children}
    </div>
  );
}

/** Stable empty rows reference — a fresh `[]` per render would defeat the
 *  `useNewRows` carried-rows check and re-seed its baseline on every render. */
const NO_ROWS: readonly ConversationListItem[] = [];

/** Module-level (⇒ referentially stable) row accessors for `useNewRows`. */
const conversationId = (row: ConversationListItem): string => row.id;
/** The list's sort axis: `updated_at desc`. `Date.parse` is deterministic, so it
 *  is safe in render (unlike `Date.now()`); `NaN` fails closed in the hook. */
const conversationSortKey = (row: ConversationListItem): number =>
  Date.parse(row.updated_at);

/**
 * ConversationsList — the `/conversations` body (the `useSearchParams` consumer,
 * so it lives under the Suspense boundary in `ConversationsScreen`).
 *
 * Rides the WAVE-4 cache spine: `conversationsQueries.infiniteList` keys under
 * `lists()`, so every `conversationsCache` write (send-bump, create-upsert,
 * title-patch, delete) propagates here for free. The DEFAULT view shows archived
 * rows inline (no `status` filter — the list page is their only home, §E) — which
 * is why its params differ from the active-only sidebar rail and it is its own
 * cache entry rather than reusing the already-hydrated recents.
 *
 * SEARCH ↔ CACHE-WRITE interaction (the wave-4 documented bound). A `touch`/
 * `upsert` bumps a row to the head of page 1 of EVERY `lists()` entry, including
 * a *filtered* one — so a bumped/created row could momentarily sit atop a search
 * that it doesn't match. In practice this never surfaces while the user is ON
 * this page: no cache write ORIGINATES here (there is no composer), and writes
 * from other screens fire while this list is unmounted; any transient mismatch
 * is reconciled by the natural refetch when the list remounts or its 60s
 * staleTime lapses. No extra mitigation is warranted.
 *
 * `keepPreviousData` keeps the current results visible (dimmed) while a new
 * search resolves, so search-as-you-type never flashes a skeleton (the
 * skeleton-first policy governs FIRST paint, not every keystroke) — honouring
 * the standing no-abrupt-swap rule.
 *
 * RETURN BEHAVIOUR. The query now carries `GC_TIMES.list` (30min), so leaving and
 * coming back renders the SAME rows at the SAME depth immediately instead of a
 * cold skeleton — never a skeleton over content we already hold. The 60s
 * staleTime still refetches on remount; `useNewRows` + `NewRowsPill` are what
 * make that refresh land honestly, announcing anything that arrived above the
 * user's position rather than splicing it in. Both are feature-agnostic and are
 * the pattern the phase-4 cases / statutes / notes lists reuse.
 */
export function ConversationsList({ signedIn }: { signedIn: boolean }) {
  // The cache PARTITION — see `ViewerScoped`. Not a request parameter.
  const { userId: viewerId } = useV2Session();
  // Captured ONCE (lazy init) so no clock read runs in render (React Compiler
  // purity); every row's relative time is measured against this fixed anchor.
  const [now] = useState(() => Date.now());
  const { committedSearch, inputValue, onInputChange, onClear } =
    useConversationsSearch();
  const activeSearch = committedSearch.trim();
  // WHERE the field is drawn — the developer switch (`v2/search-position.ts`).
  const searchAtTop = useSearchPosition() === 'top';

  const query = useInfiniteQuery({
    ...conversationsQueries.infiniteList({ search: committedSearch, viewerId }),
    enabled: signedIn,
    placeholderData: keepPreviousData,
  });

  // Flattened rows, memoised on `data` alone. TanStack's structural sharing keeps
  // `data` referentially identical when a background refetch changes nothing, and
  // `keepPreviousData` hands back the PREVIOUS `data` object during a search
  // transition — so this array's identity is exactly the "did the data really
  // change" signal `useNewRows` needs to tell carried-over rows from new ones.
  const pages = query.data?.pages;
  const items = useMemo(
    () => pages?.flatMap((page) => page.data) ?? NO_ROWS,
    [pages],
  );

  // NEW-ROWS PROJECTION (owner ask). The list is retained for 30 minutes
  // (`GC_TIMES.list`), so a return paints the cached rows instantly and the
  // mount refetch lands behind them. Rows that arrive ABOVE what the user is
  // looking at are withheld and counted rather than spliced in under their eyes;
  // everything else (title patches, deletes, later pages) applies immediately.
  // `resetKey` is the ACTIVE search and `rowsArePlaceholder` is TanStack's own
  // "these rows are the OUTGOING search's" flag, so an unfiltered watermark can
  // never leak into a filtered list and no pill can appear across a search
  // transition. No `isSelfAuthored` is needed here: this page has no composer, so
  // no cache write can originate while it is mounted (the seam exists for the
  // always-mounted sidebar, where a self-created row must never read as news).
  //
  // `isAtTop` is deliberately NOT passed. Next resets this scroll region to the
  // top on every soft nav (`layout-router.js` → `domNode.scrollIntoView()`), so an
  // at-top auto-accept would silently absorb the new rows in precisely the
  // "go back and show me what's new" case the pill is for — see the option's
  // docblock in `use-new-rows.ts`.
  const { visibleRows, newCount, accept } = useNewRows({
    rows: items,
    getId: conversationId,
    getSortKey: conversationSortKey,
    resetKey: activeSearch,
    rowsArePlaceholder: query.isPlaceholderData,
  });

  // Sentinel rooted against the shell's REAL scroll container (review finding:
  // with a viewport root, the nested `.v2-shell__content` overflow region clips
  // the sentinel with its PLAIN rect and the 320px prefetch margin is silently
  // lost — the page would only load at the exact bottom). The page itself still
  // introduces NO second scroll container; it borrows the shell's via the id
  // seam. `hasNextPage` is masked while placeholder data is showing so a search
  // transition can't fire a next-page fetch against the outgoing list's pages.
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
      <PageShell>
        <ConversationsGuestState />
      </PageShell>
    );
  }

  // Every list-STATE decision reads the true loaded set (`items`), never the
  // projection — withholding rows must never make a populated list look empty.
  const showInitialSkeleton = query.isPending;
  const showError = query.isError && items.length === 0;
  const showEmpty = !showInitialSkeleton && !showError && items.length === 0;
  // A search that ERRORS while previous results are kept must not fail silently
  // (review finding 3): the kept list stays visible with an inline retry banner.
  const showInlineError = query.isError && items.length > 0;
  // Dim ONLY while a new search is actually resolving — gating on `isFetching`
  // guarantees an errored, settled query can never strand the list at reduced
  // opacity with pointer-events-none (review finding 3).
  const dim = query.isPlaceholderData && query.isFetching;

  // Built ONCE and rendered in whichever position the developer switch names
  // (`v2/search-position.ts`), so the two placements cannot drift.
  const searchBar = (
    <ConversationsSearchBar
      value={inputValue}
      onChange={onInputChange}
      onClear={onClear}
      busy={query.isFetching && dim}
    />
  );

  return (
    <PageShell>
      {searchAtTop ? <div className="mb-4">{searchBar}</div> : null}

      {/* Out-of-flow (`h-0`) overlay — mounted in every state so its exit tween
          always plays; `newCount` is 0 unless a real list is on screen. */}
      <NewRowsPill count={newCount} onAccept={accept} noun="conversation" />

      {showInitialSkeleton ? (
        <ConversationsListSkeleton />
      ) : showError ? (
        <ConversationsErrorState onRetry={() => void query.refetch()} />
      ) : showEmpty ? (
        <ConversationsEmptyState search={activeSearch} onClear={onClear} />
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
              className="border-destructive/30 bg-destructive/10 text-destructive mb-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
            >
              <span>Couldn&rsquo;t update the results — showing your last ones.</span>
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
          <ul className="flex flex-col">
            {visibleRows.map((conversation, index) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                now={now}
                index={index}
              />
            ))}
          </ul>

          {/* Infinite sentinel + end-cap. While more pages exist this row sits at
              the end of the scroll region; scrolling it into view loads the next
              page (skeleton-first). Once the list is fully loaded, the quiet
              end-cap replaces it — never both. */}
          <div ref={sentinelRef} className="pt-1">
            {query.isFetchingNextPage ? (
              <NextPageSkeleton />
            ) : !query.hasNextPage ? (
              <p className="py-6 text-center text-xs text-muted-foreground/70">
                No more conversations
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* The floating search pill. No floating action: a conversation is
          started from the home composer, never from this list. */}
      {searchAtTop ? null : (
        <ScreenDock>
          <ScreenDockSearch>{searchBar}</ScreenDockSearch>
        </ScreenDock>
      )}
    </PageShell>
  );
}

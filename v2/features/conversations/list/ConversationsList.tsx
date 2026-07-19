'use client';

import { useState } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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

/** The centred reading column every list state shares. */
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-5 sm:pt-6">
      {children}
    </div>
  );
}

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
 */
export function ConversationsList({ signedIn }: { signedIn: boolean }) {
  // Captured ONCE (lazy init) so no clock read runs in render (React Compiler
  // purity); every row's relative time is measured against this fixed anchor.
  const [now] = useState(() => Date.now());
  const { committedSearch, inputValue, onInputChange, onClear } =
    useConversationsSearch();
  const activeSearch = committedSearch.trim();

  const query = useInfiniteQuery({
    ...conversationsQueries.infiniteList({ search: committedSearch }),
    enabled: signedIn,
    placeholderData: keepPreviousData,
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

  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
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

  return (
    <PageShell>
      <ConversationsSearchBar
        value={inputValue}
        onChange={onInputChange}
        onClear={onClear}
        busy={query.isFetching && dim}
        className="mb-4"
      />

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
            {items.map((conversation, index) => (
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
    </PageShell>
  );
}

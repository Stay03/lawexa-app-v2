'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { extractApiError } from '@/lib/utils/api-error';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import {
  SpaceContentErrorState,
  SpaceContentMoreErrorState,
  SpaceContentNextPageSkeleton,
  SpaceContentSkeleton,
  type SpaceListTab,
} from './states';

/** What the shared body reads off an infinite query: its states and pager. */
interface PagedQuery {
  isPending: boolean;
  isError: boolean;
  isFetchNextPageError: boolean;
  error: unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  refetch: () => unknown;
}

/**
 * The list's body, so its states cannot drift: skeleton on a first load, the
 * failure panel when nothing loaded, the pill's empty state (`empty`), or the
 * rows with the next-page sentinel under them.
 */
export function PagedContent({
  tab,
  query,
  count,
  empty,
  children,
}: {
  tab: SpaceListTab;
  query: PagedQuery;
  /** How many rows are loaded: every state decision reads this. */
  count: number;
  /** What the pill shows with no rows. */
  empty: ReactNode;
  children: ReactNode;
}) {
  // The pane this list scrolls in, found from the list's own element. Set in
  // an effect declared BEFORE the sentinel's, so it is in place when that
  // observer is first built (`useShellScrollRoot`'s ordering rule).
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // `data-v2-scroller` is the attribute `CollabFrame` puts on its pane for
    // `ScrollMemory`; it names the scroller of the route.
    paneRef.current = anchorRef.current?.closest<HTMLElement>('[data-v2-scroller]') ?? null;
    return () => {
      paneRef.current = null;
    };
  }, []);

  const { fetchNextPage, refetch } = query;
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    // A failed page is not retried by scrolling; its strip carries the retry.
    hasNextPage: query.hasNextPage && !query.isFetchNextPageError,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage,
    rootRef: paneRef,
    rootMargin: '320px',
  });

  // A refusal the server explained (403) is worth its own sentence; anything
  // else, a network drop or a 5xx, gets the designed one.
  const apiError = query.error ? extractApiError(query.error) : null;
  const message = apiError?.status === 403 ? apiError.message : undefined;

  return (
    <div ref={anchorRef}>
      {query.isPending ? (
        <SpaceContentSkeleton />
      ) : query.isError && count === 0 ? (
        <SpaceContentErrorState
          tab={tab}
          message={message}
          onRetry={() => void refetch()}
        />
      ) : count === 0 ? (
        empty
      ) : (
        <div>
          {children}
          <div ref={sentinelRef} className="pt-1">
            {query.isFetchingNextPage ? <SpaceContentNextPageSkeleton /> : null}
          </div>
          {query.isError ? (
            <SpaceContentMoreErrorState
              onRetry={() =>
                void (query.isFetchNextPageError ? fetchNextPage() : refetch())
              }
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

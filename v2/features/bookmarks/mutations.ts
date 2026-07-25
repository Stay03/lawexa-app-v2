'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookmarksApi } from '@/lib/api/bookmarks';
import type { BookmarkToggleResponse } from '@/types/bookmark';
import { casesQueries } from '@/v2/features/cases/queries';
import { bookmarksQueries } from './queries';
import { restoreBookmarkSnapshot, writeBookmarkEverywhere } from './cache';

/**
 * useToggleCaseBookmark — save / unsave a case, optimistically, everywhere.
 *
 * OPTIMISTIC IS THE RIGHT CALL HERE (standards §2: "optimistic updates only for
 * toggles/sends/checks"). A bookmark is a pure toggle with a known next state, a
 * one-field consequence and a trivial rollback; making the user watch a spinner
 * on a star is the wrong trade.
 *
 * THE VARIABLE IS THE INTENDED NEXT STATE, not "flip whatever you find". The
 * endpoint itself is a server-side toggle, so a double-tap sends two writes and
 * lands where it started — but the CACHE must not be a toggle, or two rapid taps
 * that both resolve would race the display against the server. Passing `next`
 * makes each write idempotent: applying `true` twice is `true`.
 *
 * WHAT INVALIDATES. The bookmarks LIST gains or loses a whole row, which is not
 * a field flip this cache writer can fabricate, so it is invalidated through the
 * mutation `meta` (the global `MutationCache.onSuccess` channel — no per-callsite
 * invalidation sprawl). The case entries are already correct optimistically and
 * are reconciled by their own `staleTime`, so they are deliberately NOT
 * invalidated: refetching every visible list to confirm one boolean would undo
 * the point of the optimistic write.
 *
 * ERRORS ride the global `MutationCache.onError` toast — one error channel for
 * every v2 mutation — after the snapshot is restored here.
 */
export function useToggleCaseBookmark() {
  const queryClient = useQueryClient();

  return useMutation<
    BookmarkToggleResponse,
    Error,
    { id: number; next: boolean },
    { snapshot: ReturnType<typeof writeBookmarkEverywhere> }
  >({
    mutationFn: ({ id }) => bookmarksApi.toggle({ type: 'case', id }),
    // One scope per case: a burst of taps on the SAME star is serialized, so the
    // last write is the last one the server sees. Different cases stay parallel.
    scope: { id: 'bookmark-case' },
    meta: { invalidates: [bookmarksQueries.lists()] },
    onMutate: async ({ id, next }) => {
      // Stop in-flight CASE reads before writing: a response already on the wire
      // was built before the POST, so letting it land would revert the star.
      // Cancelling a next-page fetch is the cost, and it recovers on its own —
      // `hasNextPage` stays true while `isFetchingNextPage` returns to false, so
      // `useInfiniteScrollSentinel` rebuilds its observer and re-fires while the
      // sentinel is still in view.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: casesQueries.lists() }),
        queryClient.cancelQueries({ queryKey: casesQueries.details() }),
      ]);
      return { snapshot: writeBookmarkEverywhere(queryClient, id, next) };
    },
    onError: (_error, _variables, context) => {
      if (context) restoreBookmarkSnapshot(queryClient, context.snapshot);
    },
  });
}

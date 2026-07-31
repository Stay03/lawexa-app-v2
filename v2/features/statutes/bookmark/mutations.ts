'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookmarksApi } from '@/lib/api/bookmarks';
import type { BookmarkToggleResponse } from '@/types/bookmark';
import { bookmarksQueries } from '@/v2/features/bookmarks/queries';
import { statutesQueries } from '../queries';
import {
  restoreStatuteBookmarkSnapshot,
  writeStatuteBookmarkEverywhere,
} from './cache';

/**
 * useToggleStatuteBookmark — save / unsave ONE statute, optimistically,
 * everywhere. The contract of `useToggleCaseBookmark` (that hook is
 * hard-typed to the case caches, so the statute library carries its own):
 *
 *  - the variable is the INTENDED NEXT STATE, so each cache write is
 *    idempotent and two rapid taps cannot race the display;
 *  - in-flight statute reads are cancelled first, so a response already on
 *    the wire cannot land stale and revert the star;
 *  - the mutation scope is keyed by THIS statute's id, so a burst of taps on
 *    the same star is serialized while stars on different statutes stay
 *    parallel — a shared per-type scope would leave statute B's star dead
 *    until statute A's round trip settles. The id is a hook argument (one
 *    button, one statute, one hook instance) because TanStack scopes are
 *    fixed per mutation, not per `mutate` call.
 *  - the bookmarks LIST (a whole row appears/disappears — not fabricable
 *    here) invalidates through the global meta channel;
 *  - errors restore the snapshot and ride the global mutation-error toast.
 */
export function useToggleStatuteBookmark(statuteId: number) {
  const queryClient = useQueryClient();

  return useMutation<
    BookmarkToggleResponse,
    Error,
    { next: boolean },
    { snapshot: ReturnType<typeof writeStatuteBookmarkEverywhere> }
  >({
    mutationFn: () => bookmarksApi.toggle({ type: 'statute', id: statuteId }),
    scope: { id: `bookmark-statute-${statuteId}` },
    meta: { invalidates: [bookmarksQueries.lists()] },
    onMutate: async ({ next }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: statutesQueries.lists() }),
        queryClient.cancelQueries({ queryKey: statutesQueries.details() }),
      ]);
      return {
        snapshot: writeStatuteBookmarkEverywhere(queryClient, statuteId, next),
      };
    },
    onError: (_error, _variables, context) => {
      if (context) restoreStatuteBookmarkSnapshot(queryClient, context.snapshot);
    },
  });
}

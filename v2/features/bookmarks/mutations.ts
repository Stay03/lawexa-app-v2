'use client';

import { useMemo } from 'react';
import {
  useMutation,
  useMutationState,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { bookmarksApi } from '@/lib/api/bookmarks';
import type { BookmarkToggleResponse, BookmarkType } from '@/types/bookmark';
import { casesQueries } from '@/v2/features/cases/queries';
import { statutesQueries } from '@/v2/features/statutes/queries';
import {
  restoreStatuteBookmarkSnapshot,
  writeStatuteBookmarkEverywhere,
} from '@/v2/features/statutes/bookmark/cache';
import { bookmarksQueries } from './queries';
import { restoreBookmarkSnapshot, writeBookmarkEverywhere } from './cache';
import {
  removeBookmarkFromLists,
  reinsertRemovedBookmark,
  type BookmarkRemoval,
} from './list-cache';

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
export function useToggleCaseBookmark(caseId: number) {
  const queryClient = useQueryClient();

  return useMutation<
    BookmarkToggleResponse,
    Error,
    { next: boolean },
    { snapshot: ReturnType<typeof writeBookmarkEverywhere> }
  >({
    mutationFn: () => bookmarksApi.toggle({ type: 'case', id: caseId }),
    // One scope PER CASE — the id is in the scope, so a burst of taps on the
    // SAME star is serialized (the last write is the last one the server sees)
    // while stars on different cases stay parallel. The id lives on the hook,
    // not the variables, precisely so the scope can carry it.
    scope: { id: `bookmark-case-${caseId}` },
    meta: { invalidates: [bookmarksQueries.lists()] },
    onMutate: async ({ next }) => {
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
      return { snapshot: writeBookmarkEverywhere(queryClient, caseId, next) };
    },
    onError: (_error, _variables, context) => {
      if (context) restoreBookmarkSnapshot(queryClient, context.snapshot);
    },
  });
}

/** What the generic toggle addresses: a content type and that content's id. */
export interface ToggleBookmarkTarget {
  type: BookmarkType;
  /** The CONTENT id (`bookmark.content.id`) — what the endpoint toggles. */
  contentId: number;
}

/**
 * The variables every generic toggle carries: WHAT is being toggled and the
 * INTENDED NEXT STATE.
 *
 * The target is in the variables — not only in the hook's closure — because
 * that is what makes the in-flight set READABLE (see
 * {@link usePendingBookmarkRemovals}). TanStack exposes a mutation's variables
 * through `useMutationState`; it does not expose a hook's closure.
 */
export interface ToggleBookmarkVariables extends ToggleBookmarkTarget {
  /**
   * The state the caller INTENDS, not "flip whatever you find". The endpoint is
   * itself a server-side toggle, so a double-tap sends two writes and lands
   * where it started — but the CACHE must not be a toggle, or two rapid taps
   * that both resolve would race the display against the server.
   */
  next: boolean;
}

/**
 * The key every generic bookmark toggle is registered under, so the set of
 * in-flight toggles can be read declaratively with one filter.
 */
export const BOOKMARK_TOGGLE_MUTATION_KEY = ['bookmarks', 'toggle'] as const;

/** Stable identity for one bookmarkable thing — the row-filter's set member. */
export function bookmarkTargetKey(type: BookmarkType, contentId: number): string {
  return `${type}:${contentId}`;
}

/**
 * Narrow a mutation's `variables` (typed `unknown` at the `useMutationState`
 * boundary) to a REMOVAL target, or `null`. A real runtime guard, not a cast
 * that hopes — the same shape `getErrorMessage` uses to read an axios error.
 */
function pendingRemovalKey(variables: unknown): string | null {
  if (typeof variables !== 'object' || variables === null) return null;
  const candidate = variables as Partial<ToggleBookmarkVariables>;
  if (candidate.next !== false) return null;
  if (typeof candidate.type !== 'string' || typeof candidate.contentId !== 'number') {
    return null;
  }
  return bookmarkTargetKey(candidate.type, candidate.contentId);
}

/** Frozen empty set, so "nothing pending" is one stable reference. */
const NO_PENDING: ReadonlySet<string> = new Set<string>();

/**
 * The set of bookmarks whose REMOVAL is currently in flight — the thing a list
 * must filter its rows through (review F2).
 *
 * ── THE BUG THIS EXISTS TO KILL ─────────────────────────────────────────────
 * Un-save A, then un-save B. They have different `scope` ids, so they run in
 * parallel. B's POST settles first, and the global `MutationCache.onSuccess`
 * invalidates `bookmarksQueries.lists()` — every list, including the one A was
 * just removed from. The refetch still contains A, because A's DELETE has not
 * landed yet. So A REAPPEARS, then vanishes again when A settles: a 300–800ms
 * flicker on the single most common thing anyone does on this screen, which is
 * clearing several rows in a row.
 *
 * Filtering the rendered rows through this set makes that structurally
 * impossible: while a removal is in flight its row cannot be painted by
 * ANYTHING — not a refetch, not a rehydration, not another surface's write.
 *
 * ── WHY THE WINDOW IS EXACTLY RIGHT ─────────────────────────────────────────
 * TanStack awaits the mutation-cache `onSuccess` (and therefore the whole
 * invalidation, including the refetch it triggers) BEFORE dispatching the
 * mutation's `success` state. So a toggle stays `pending` for precisely as long
 * as its own reconciliation is unfinished — the row is released at the first
 * moment the cache is authoritative about it, and not a frame earlier.
 *
 * `useMutationState` structurally shares its result (`replaceEqualDeep` against
 * the previous array), so this returns a stable reference while nothing
 * changes and the `useMemo` below rebuilds the Set only when it truly moves.
 */
export function usePendingBookmarkRemovals(): ReadonlySet<string> {
  const pending = useMutationState({
    filters: { mutationKey: BOOKMARK_TOGGLE_MUTATION_KEY, status: 'pending' },
    select: (mutation) => pendingRemovalKey(mutation.state.variables),
  });

  return useMemo(() => {
    const keys = pending.filter((key): key is string => key !== null);
    return keys.length === 0 ? NO_PENDING : new Set(keys);
  }, [pending]);
}

/** Rollback for whatever content caches a type happens to have. */
type ContentRollback = () => void;

const NO_CONTENT_ROLLBACK: ContentRollback = () => {};

/**
 * Write the bookmark flag into the CONTENT caches for one type, and return the
 * rollback for exactly what was written.
 *
 * A closure rather than a snapshot object because the two content families have
 * their own concrete snapshot types (`CaseCache[]` vs `StatuteCache[]`) and
 * their own restore functions. Returning the restore already bound to its
 * snapshot keeps both fully typed and lets the mutation hold ONE rollback
 * regardless of type — no widening, no `unknown`, no cast.
 *
 * `note` and `folder` return the no-op: neither has a v2 content surface yet,
 * so there is no cached flag to flip. When notes and folders are rebuilt they
 * gain a case here and every star on this page starts flipping them too.
 */
async function writeContentCaches(
  queryClient: QueryClient,
  { type, contentId }: ToggleBookmarkTarget,
  next: boolean,
): Promise<ContentRollback> {
  if (type === 'case') {
    // Stop in-flight reads before writing: a response already on the wire was
    // built before the POST, so letting it land would revert the star.
    await Promise.all([
      queryClient.cancelQueries({ queryKey: casesQueries.lists() }),
      queryClient.cancelQueries({ queryKey: casesQueries.details() }),
    ]);
    const snapshot = writeBookmarkEverywhere(queryClient, contentId, next);
    return () => restoreBookmarkSnapshot(queryClient, snapshot);
  }

  if (type === 'statute') {
    await Promise.all([
      queryClient.cancelQueries({ queryKey: statutesQueries.lists() }),
      queryClient.cancelQueries({ queryKey: statutesQueries.details() }),
    ]);
    const snapshot = writeStatuteBookmarkEverywhere(queryClient, contentId, next);
    return () => restoreStatuteBookmarkSnapshot(queryClient, snapshot);
  }

  return NO_CONTENT_ROLLBACK;
}

/**
 * useToggleBookmark — the POLYMORPHIC toggle the `/bookmarks` page presses.
 *
 * WHY A THIRD HOOK EXISTS BESIDE THE TWO TYPED ONES. `useToggleCaseBookmark`
 * and `useToggleStatuteBookmark` are each hard-typed to one content family, and
 * the bookmarks list carries four. Rules of hooks forbid picking one of them
 * per row at render time, and calling all three per row to use one is waste
 * dressed up as compliance. So the dispatch moves DOWN, into
 * {@link writeContentCaches}: one hook, one mutation instance per row, and the
 * type decides which content caches it fans out to.
 *
 * IT IS THE SAME MUTATION, NOT A PARALLEL ONE. Identical endpoint, identical
 * intended-next-state variable (so two rapid taps are idempotent rather than a
 * race), identical `meta.invalidates`, and — critically — the IDENTICAL SCOPE
 * STRING (`bookmark-case-11831`) that the typed hooks use. A star pressed here
 * and a star pressed on the cases list for the same case are therefore
 * serialized against each other by TanStack, exactly as two presses on one star
 * are.
 *
 * WHAT IS EXTRA HERE: the row itself leaves the list. The typed hooks only flip
 * a flag; on this page the flag's row must also disappear, optimistically, from
 * every cached bookmark list. The rollback is ROW-SCOPED, not a snapshot
 * restore — see `list-cache.ts` for the concurrent-removal case that rules a
 * snapshot out — and the content-cache rollback (which IS a snapshot, and
 * correctly so: it flips a flag on entries nothing else is racing to delete)
 * runs beside it.
 *
 * WHILE THIS IS IN FLIGHT ITS ROW CANNOT BE PAINTED. The mutation is registered
 * under {@link BOOKMARK_TOGGLE_MUTATION_KEY} with its target in the variables,
 * so `usePendingBookmarkRemovals` can filter it out of every rendered list —
 * which is what stops a sibling toggle's invalidation from briefly resurrecting
 * it.
 *
 * ERRORS ride the global `MutationCache.onError` toast after the rollback —
 * one error channel for every v2 mutation.
 */
export function useToggleBookmark(target: ToggleBookmarkTarget) {
  const queryClient = useQueryClient();

  return useMutation<
    BookmarkToggleResponse,
    Error,
    ToggleBookmarkVariables,
    { rollback: () => void }
  >({
    mutationKey: BOOKMARK_TOGGLE_MUTATION_KEY,
    mutationFn: ({ type, contentId }) =>
      bookmarksApi.toggle({ type, id: contentId }),
    scope: { id: `bookmark-${target.type}-${target.contentId}` },
    meta: { invalidates: [bookmarksQueries.lists()] },
    onMutate: async ({ type, contentId, next }) => {
      await queryClient.cancelQueries({ queryKey: bookmarksQueries.lists() });
      const removal: BookmarkRemoval | null = next
        ? null
        : removeBookmarkFromLists(queryClient, type, contentId);
      const rollbackContent = await writeContentCaches(
        queryClient,
        { type, contentId },
        next,
      );
      return {
        rollback: () => {
          rollbackContent();
          if (removal) reinsertRemovedBookmark(queryClient, removal);
        },
      };
    },
    onError: (_error, _variables, context) => {
      context?.rollback();
    },
  });
}

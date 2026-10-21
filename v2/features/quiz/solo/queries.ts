import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { channelQuizApi, quizAttemptsApi } from '@/lib/api/channel-quiz';
import type { ViewerScoped } from '@/v2/features/channels/queries';
import { channelQuizQueries } from '@/v2/features/channels/quiz/queries';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';

/**
 * solo quiz query factory — the explore list, the reader's library page, the
 * signed-out preview of one quiz, and an attempt in play or finished.
 *
 * Source: backend branch quiz-part1-publish-and-solo (tip 45a8f711),
 * 21 October 2026.
 *
 * ── UNDER THE `channel-quiz` ROOT, ON PURPOSE ──────────────────────────────
 * These are the same quiz rows the channel sheet lists, so they live under
 * `channelQuizQueries.all` where the authoring writes already settle lists by
 * predicate (`channels/quiz/list-cache.ts` names `my-library` and `explore`
 * beside the room lists). A second root would have meant a create in the
 * library leaving the explore list stale, and a visibility switch not
 * reaching the page it was pressed on.
 *
 * The one quiz an ACCOUNT opens is `channelQuizQueries.quizDetail` (the
 * authenticated `show`, which says `is_mine` and carries `is_correct` for the
 * author), shared with the edit form so Edit opens on data already here. A
 * visitor or a guest reads {@link soloQuizQueries.preview} instead: the public
 * endpoint, never `is_correct`, `404` for anything that is not link or public.
 *
 * VIEWER PARTITION, same rule as everywhere in v2: `viewerId` is a cache
 * partition and it is REQUIRED. It matters here — `is_mine` is per viewer on
 * every row, and an attempt is one person's answers.
 */

/** The explore list's page size: the server default, well under its 50 cap. */
export const EXPLORE_PAGE_SIZE = 15;

/** The library page's page size. The sheet's single page of 30 stays as it
 *  is; this list scrolls on. */
export const LIBRARY_PAGE_SIZE = 15;

export const soloQuizQueries = {
  /** Key prefix for the explore list (every viewer variant). */
  exploreOf: () => [...channelQuizQueries.all, 'explore'] as const,

  /**
   * EVERY PUBLIC QUIZ, newest first, page-infinite. Works signed out: the
   * partition is then `null`, and the guest pass that follows re-reads under
   * the guest's id (the cache guard drops the first entry on that edge).
   * `REFETCH_ON_VISIT`: a quiz published while the reader was elsewhere shows
   * on arrival, behind the rows already painted.
   */
  explore: ({ viewerId }: ViewerScoped) =>
    infiniteQueryOptions({
      queryKey: [...soloQuizQueries.exploreOf(), { viewerId }] as const,
      queryFn: ({ pageParam }) =>
        channelQuizApi.explore({ per_page: EXPLORE_PAGE_SIZE, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        const { current_page, last_page } = lastPage.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  /** Key prefix for the library page (every viewer variant). */
  libraryOf: () => [...channelQuizQueries.all, 'my-library'] as const,

  /**
   * THE READER'S OWN LIBRARY AS A PAGE — every quiz they authored, wherever
   * it was born, page-infinite. A separate key from the sheet's single page
   * (`channelQuizQueries.myQuizzes`): TanStack forbids sharing a key between
   * `useQuery` and `useInfiniteQuery`, and the shapes genuinely differ. Both
   * are settled by the same authoring writes.
   */
  library: ({ viewerId }: ViewerScoped) =>
    infiniteQueryOptions({
      queryKey: [...soloQuizQueries.libraryOf(), { viewerId }] as const,
      queryFn: ({ pageParam }) =>
        channelQuizApi.getMine({ per_page: LIBRARY_PAGE_SIZE, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        const { current_page, last_page } = lastPage.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  /** Invalidation handle for one quiz's public preview (every viewer variant). */
  previewOf: (quizUuid: string) =>
    [...channelQuizQueries.all, 'preview', quizUuid] as const,

  /**
   * A link or public quiz as ANYONE may read it: the questions without
   * `is_correct`, `404` for every other quiz. The quiz front's read for a
   * visitor and a guest; an account reads `channelQuizQueries.quizDetail`.
   * Reference tier: a quiz's questions freeze once it has been played, and a
   * title edit is rare enough to wait for a refresh.
   */
  preview: (quizUuid: string, { viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...soloQuizQueries.previewOf(quizUuid), { viewerId }] as const,
      queryFn: () => channelQuizApi.preview(quizUuid),
      staleTime: STALE_TIMES.reference,
      gcTime: GC_TIMES.reference,
    }),

  /** Invalidation/write handle for one attempt (every viewer variant). */
  attemptOf: (attemptUuid: string) =>
    [...channelQuizQueries.all, 'attempt', attemptUuid] as const,

  /**
   * ONE ATTEMPT — the resume while it runs, the scored review once finished.
   *
   * LIVE tier (staleTime 0) on purpose: this is the entry the player writes
   * its answers onto (the answer mutation patches it from the receipt) AND the
   * entry a reload resumes from, and the only thing that may win over a cached
   * copy is the server's. The player cancels any read in flight before it
   * writes an answer, so a focus refetch can never put an answered question
   * back on screen.
   */
  attempt: (attemptUuid: string, { viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...soloQuizQueries.attemptOf(attemptUuid), { viewerId }] as const,
      queryFn: () => quizAttemptsApi.show(attemptUuid),
      staleTime: STALE_TIMES.live,
      gcTime: GC_TIMES.list,
    }),
};

import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { quizApi } from '@/lib/api/quiz';
import type { QuizSessionListParams } from '@/types/quiz';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';

/**
 * Quiz query factory — the `v2/features/cases/queries.ts` exemplar: a
 * hierarchical key factory whose leaves are `queryOptions()` objects, wrapping
 * the shared `lib/api/quiz.ts` fetchers (the same player data layer v1 uses)
 * unchanged. Only this query-policy wrapper is new.
 *
 * Structure convention (mirrored from the exemplar):
 *  - `all`                 the feature root key segment (a value, not a function).
 *  - `sessions()`          the "all session lists" invalidation handle.
 *  - `sessionList(p)`      a concrete session-list query (leaf → `queryOptions`).
 *  - `recentSessions()`    the hub's first page — five rows, which is also
 *                          where the hub finds any open session.
 *  - `historyInfinite()`   the `/quiz/history` infinite list.
 *  - `session(uuid)`       the live play state (session + current question).
 *  - `results(uuid)`       the finalized review payload.
 *  - `stats()` / `topics()` the progress + recent-topic endpoints.
 *
 * ── VIEWER SCOPING ──────────────────────────────────────────────────────────
 * EVERY leaf here is per-user: sessions, results, stats and topics all belong
 * to the account that fetched them, and the endpoints answer differently (or
 * 403) across owners. So every leaf takes {@link ViewerScoped} and carries the
 * viewer id in its key — the same structural cross-account guarantee
 * `radarsQueries` gives, made a type error to forget rather than a convention
 * to remember. (`V2CacheIdentityGuard` also drops the whole v2 cache when the
 * verified viewer changes; the partition is the second, per-key line.)
 *
 * ── `REFETCH_ON_VISIT` ON THE SESSION SURFACES ──────────────────────────────
 * Quiz state moves WITHOUT this tab doing anything: a session auto-abandons
 * server-side after ~24h, and the backend allows exactly one open session per
 * user — so a session continued or ended in another tab makes a cached "Resume
 * your session" hero a lie. Arriving at the hub, the history list or the stats
 * page is precisely the "what changed since I was last here?" moment the flag
 * exists for: the cached rows paint instantly and the check lands behind them.
 *
 * The one leaf that does NOT need it is `session(uuid)` — it sits on the `live`
 * tier (staleTime 0), which already refetches on every mount and focus, because
 * the current served question is the single most authoritative thing on screen.
 */

/** The viewer partition — see the factory docblock. Required, never optional. */
export interface ViewerScoped {
  viewerId: number | null;
}

/**
 * The hub's recent-sessions page size. Five rows is the hub's whole list AND
 * where it looks for an open session, so the hub spends one request where a
 * separate single-row peek plus a list would spend two.
 *
 * A single-row `activeSessionPeek` leaf existed here for the (since-removed)
 * home quiz module. It is deleted rather than left dormant: nothing rendered it,
 * and a cache leaf nobody reads drifts silently from the shape the screens
 * actually consume.
 */
export const HUB_RECENT_SESSIONS = 5;

/** Page size for the `/quiz/history` infinite list (the v1 page size). */
export const HISTORY_PAGE_SIZE = 15;

export const quizQueries = {
  all: ['quiz'] as const,

  sessions: () => [...quizQueries.all, 'sessions'] as const,

  /**
   * One page of past sessions. STANDARD tier — session progress/order moves as
   * the user plays, so a 60s window keeps a revisit instant without going
   * stale; `REFETCH_ON_VISIT` keeps the active-session hero honest on arrival.
   */
  sessionList: ({
    viewerId,
    ...params
  }: QuizSessionListParams & ViewerScoped) =>
    queryOptions({
      queryKey: [...quizQueries.sessions(), params, { viewerId }] as const,
      queryFn: () => quizApi.listSessions(params),
      staleTime: STALE_TIMES.standard,
      // Outlive TanStack's 5-minute default so a return to the hub paints rows
      // from cache instead of a skeleton.
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  /** The hub's recent list — five rows, and where it looks for an open session. */
  recentSessions: ({ viewerId }: ViewerScoped) =>
    quizQueries.sessionList({ per_page: HUB_RECENT_SESSIONS, viewerId }),

  /**
   * The `/quiz/history` browse list. A SEPARATE key from `sessionList()` —
   * TanStack forbids sharing a key between `useQuery` and `useInfiniteQuery`
   * (standards §2), and the shapes genuinely differ (`{ pages }` vs one
   * envelope).
   */
  historyInfinite: ({ viewerId }: ViewerScoped) =>
    infiniteQueryOptions({
      queryKey: [...quizQueries.sessions(), 'infinite', { viewerId }] as const,
      queryFn: ({ pageParam }) =>
        quizApi.listSessions({ per_page: HISTORY_PAGE_SIZE, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        const { current_page, last_page } = lastPage.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  details: () => [...quizQueries.all, 'session'] as const,

  /**
   * The live play state: the session plus its CURRENT unanswered question.
   *
   * LIVE tier (staleTime 0) on purpose. This is the one query whose value the
   * server can change without us — the ~24h auto-abandon, or the same account
   * playing in another tab — and re-serving the same current question is
   * idempotent, so the cost of being wrong is far higher than the cost of a
   * refetch. The answer mutation writes the server's response straight into
   * this entry, so the play loop itself never round-trips for the next
   * question; this tier only covers mount and focus.
   */
  session: (sessionUuid: string, { viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...quizQueries.details(), sessionUuid, { viewerId }] as const,
      queryFn: () => quizApi.getSession(sessionUuid),
      staleTime: STALE_TIMES.live,
      gcTime: GC_TIMES.list,
    }),

  reviews: () => [...quizQueries.all, 'results'] as const,

  /**
   * The finalized review (answers + explanations revealed). REFERENCE tier:
   * once a session has ended its results are frozen for good, so a long window
   * makes stepping back into a review instant and costs nothing in freshness.
   * 409s until the session is actually ended — the screen routes on that.
   */
  results: (sessionUuid: string, { viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...quizQueries.reviews(), sessionUuid, { viewerId }] as const,
      queryFn: () => quizApi.getResults(sessionUuid),
      staleTime: STALE_TIMES.reference,
      gcTime: GC_TIMES.reference,
    }),

  /**
   * The student's own progress aggregates. STANDARD tier — the numbers only
   * move when a session ends — with `REFETCH_ON_VISIT` so opening the stats
   * page right after ending a session shows that session.
   */
  stats: ({ viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...quizQueries.all, 'stats', { viewerId }] as const,
      queryFn: () => quizApi.getStats(),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  /**
   * Recent distinct topics for the quiet start-from-topic affordance.
   * REFERENCE tier — the set is produced by a NIGHTLY backend job (verified:
   * it stayed `[]` across a full played session), so it cannot move within a
   * visit and a longer window is the honest one.
   */
  topics: ({ viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...quizQueries.all, 'topics', { viewerId }] as const,
      queryFn: () => quizApi.getTopics(),
      staleTime: STALE_TIMES.reference,
      gcTime: GC_TIMES.reference,
    }),
};

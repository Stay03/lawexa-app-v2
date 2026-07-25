import { queryOptions } from '@tanstack/react-query';
import { quizApi } from '@/lib/api/quiz';
import type { QuizSessionListParams } from '@/types/quiz';
import { GC_TIMES, STALE_TIMES } from '@/v2/runtime/query';

/**
 * Quiz query factory — copies the `v2/features/cases/queries.ts` exemplar: a
 * hierarchical key factory whose leaves are `queryOptions()` objects, wrapping the
 * shared `lib/api/quiz.ts` fetchers (the same player data layer v1 uses) unchanged.
 * Only this query-policy wrapper is new.
 *
 * Consumed by the Study home tab's Quiz module (owner #34): the active-session
 * peek drives the "Continue your quiz" card, `stats()` the progress strip, and
 * `topics()` the recent-topic affordance. `enabled` stays a call-site concern
 * (the module is role-gated to the quiz soft-launch audience, so it only fetches
 * for users v1 lets play).
 *
 * Structure convention (mirrored from the exemplar):
 *  - `all`               the feature root key segment (a value, not a function).
 *  - `sessions()`        the "all session lists" invalidation handle.
 *  - `sessionList(p)`    a concrete session-list query (leaf → `queryOptions`).
 *  - `activeSessionPeek()` the home PEEK: a single fixed-size page whose newest
 *                        row surfaces the one open session (the backend allows at
 *                        most one, and a newer session can't start while it's
 *                        open — so `per_page: 1` reliably reveals it, exactly how
 *                        v1's `QuizStart` detects a resumable session).
 *  - `stats()` / `topics()` the shipped progress + recent-topic endpoints.
 */

/**
 * The active-session peek params — one row is enough to find the open session
 * (see above). A module constant so every caller produces a structurally
 * identical key and shares the single cache entry.
 */
const ACTIVE_SESSION_PEEK_PARAMS: QuizSessionListParams = { per_page: 1 };

export const quizQueries = {
  all: ['quiz'] as const,

  sessions: () => [...quizQueries.all, 'sessions'] as const,

  /**
   * Paginated past sessions. STANDARD tier — session progress/order moves as the
   * user plays, so a 60s window keeps a revisit instant without going stale.
   */
  sessionList: (params: QuizSessionListParams = {}) =>
    queryOptions({
      queryKey: [...quizQueries.sessions(), params] as const,
      queryFn: () => quizApi.listSessions(params),
      staleTime: STALE_TIMES.standard,
      // Home-glance retention: outlive TanStack's 5-minute default so a return to
      // the home paints this module from cache instead of a skeleton. Without it
      // the conversations recents were warm while every other module was cold.
      gcTime: GC_TIMES.list,
    }),

  /** The read-only active-session PEEK (single page) shared by the home module. */
  activeSessionPeek: () => quizQueries.sessionList(ACTIVE_SESSION_PEEK_PARAMS),

  /**
   * The student's own progress aggregates (accuracy / answered / avg score).
   * STANDARD tier — the numbers only move when a session ends.
   */
  stats: () =>
    queryOptions({
      queryKey: [...quizQueries.all, 'stats'] as const,
      queryFn: () => quizApi.getStats(),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
    }),

  /**
   * Recent distinct topics for the quiet start-from-topic affordance. REFERENCE
   * tier — the recent-topic set drifts slowly, so a longer window is fine.
   */
  topics: () =>
    queryOptions({
      queryKey: [...quizQueries.all, 'topics'] as const,
      queryFn: () => quizApi.getTopics(),
      staleTime: STALE_TIMES.reference,
    }),
};

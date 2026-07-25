import { queryOptions } from '@tanstack/react-query';
import { recentlyViewedApi } from '@/lib/api/recently-viewed';
import type { RecentlyViewedParams } from '@/types/recently-viewed';
import { GC_TIMES, STALE_TIMES } from '@/v2/runtime/query';

/**
 * Recently-viewed query factory (the `cases` exemplar pattern) — wraps
 * `recentlyViewedApi.getList()` (backend Ask A) unchanged; only this query-policy
 * wrapper is new. Backs the Study home's "Recently viewed" module.
 *
 * Structure convention (mirrored from the exemplar):
 *  - `all`           the feature root key segment (a value, not a function).
 *  - `lists()`       the "all lists" invalidation handle for every list variant.
 *  - `list(p)`       a concrete list query (leaf → `queryOptions`).
 *  - `recentsPeek()` the home PEEK — one small first page (all types, newest
 *                    first). Delegates to `list()`, so every caller resolves to
 *                    ONE cache entry and never refetches.
 *
 * Standard tier: a view can happen at any time, so a 60s window keeps the strip
 * honest without churning. `enabled` stays a call-site concern (guests never
 * fetch — the module is simply not mounted for them).
 */

/**
 * The peek params — one small page of the newest views across all types. A
 * module constant so every `recentsPeek()` caller produces a structurally-
 * identical key and shares the single cache entry.
 */
const PEEK_PARAMS: RecentlyViewedParams = { per_page: 8 };

export const recentlyViewedQueries = {
  all: ['recently-viewed'] as const,

  lists: () => [...recentlyViewedQueries.all, 'list'] as const,

  /**
   * Paginated recently-viewed feed. STANDARD tier — views accrue continuously,
   * so a 60s window keeps the strip fresh without churning.
   */
  list: (params: RecentlyViewedParams = {}) =>
    queryOptions({
      queryKey: [...recentlyViewedQueries.lists(), params] as const,
      queryFn: () => recentlyViewedApi.getList(params),
      staleTime: STALE_TIMES.standard,
      // Home-glance retention: outlive TanStack's 5-minute default so a return to
      // the home paints this module from cache instead of a skeleton. Without it
      // the conversations recents were warm while every other module was cold.
      gcTime: GC_TIMES.list,
    }),

  /** The read-only home PEEK (single small page) shared by the Study module. */
  recentsPeek: () => recentlyViewedQueries.list(PEEK_PARAMS),
};

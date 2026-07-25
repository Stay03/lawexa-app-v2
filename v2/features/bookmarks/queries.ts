import { queryOptions } from '@tanstack/react-query';
import { bookmarksApi } from '@/lib/api/bookmarks';
import type { BookmarkListParams } from '@/types/bookmark';
import { GC_TIMES, STALE_TIMES } from '@/v2/runtime/query';

/**
 * Bookmarks query factory — copies the `v2/features/cases/queries.ts` exemplar: a
 * hierarchical key factory whose leaves are `queryOptions()` objects, wrapping the
 * shared `lib/api/bookmarks.ts` fetcher (the same data layer v1's bookmarks page
 * uses) unchanged. Only this query-policy wrapper is new.
 *
 * Consumed by the Study home tab's "Recent bookmarks" module (owner #34): the
 * `recents()` peek shows a compact strip of the user's saved content, each row
 * linking to its v1 content route. `enabled` stays a call-site concern (guests
 * never fetch).
 *
 * Structure convention (mirrored from the exemplar):
 *  - `all`        the feature root key segment (a value, not a function).
 *  - `lists()`    the "all lists" invalidation handle for every list variant.
 *  - `list(p)`    a concrete list query (leaf → `queryOptions`).
 *  - `recents()`  the home PEEK — a single small first page (newest first, which
 *                 is the endpoint's default order). Delegates to `list()`, so
 *                 every caller resolves to ONE cache entry and never refetches.
 */

/**
 * The recents PEEK params — one small page of the most recent bookmarks. A module
 * constant so every `recents()` caller produces a structurally-identical key and
 * shares the single cache entry.
 */
const RECENTS_PARAMS: BookmarkListParams = { per_page: 6 };

export const bookmarksQueries = {
  all: ['bookmarks'] as const,

  lists: () => [...bookmarksQueries.all, 'list'] as const,

  /**
   * Paginated bookmark list. STANDARD tier — a bookmark can be toggled at any
   * time, so a 60s window keeps the strip honest without churning.
   */
  list: (params: BookmarkListParams = {}) =>
    queryOptions({
      queryKey: [...bookmarksQueries.lists(), params] as const,
      queryFn: () => bookmarksApi.getList(params),
      staleTime: STALE_TIMES.standard,
      // Home-glance retention: outlive TanStack's 5-minute default so a return to
      // the home paints this module from cache instead of a skeleton. Without it
      // the conversations recents were warm while every other module was cold.
      gcTime: GC_TIMES.list,
    }),

  /** The read-only recents PEEK (single small page) shared by the home module. */
  recents: () => bookmarksQueries.list(RECENTS_PARAMS),
};

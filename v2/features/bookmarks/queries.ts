import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { bookmarksApi } from '@/lib/api/bookmarks';
import { extractApiError } from '@/lib/utils/api-error';
import type { BookmarkListParams, BookmarkType } from '@/types/bookmark';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';

/**
 * Bookmarks query factory — copies the `v2/features/cases/queries.ts` exemplar: a
 * hierarchical key factory whose leaves are `queryOptions()` objects, wrapping the
 * shared `lib/api/bookmarks.ts` fetcher (the same data layer v1's bookmarks page
 * uses) unchanged. Only this query-policy wrapper is new.
 *
 * Structure convention (mirrored from the exemplar):
 *  - `all`            the feature root key segment (a value, not a function).
 *  - `lists()`        the "all lists" invalidation handle for every list variant.
 *  - `list(p)`        a concrete flat list query (leaf → `queryOptions`).
 *  - `recents()`      the home PEEK — a single small first page (newest first,
 *                     which is the endpoint's default order). Delegates to
 *                     `list()`, so every caller resolves to ONE cache entry.
 *  - `infiniteList()` the `/bookmarks` PAGE — the accumulating stream.
 *
 * EVERY TOGGLE ANYWHERE REACHES THESE. The case, statute and generic bookmark
 * mutations all declare `meta: { invalidates: [bookmarksQueries.lists()] }`, and
 * TanStack matches `invalidateQueries` by key PREFIX — so a star pressed on the
 * cases list reconciles the bookmarks page and the home peek without either of
 * them naming the other.
 */

/**
 * The recents PEEK params — one small page of the most recent bookmarks. A
 * module constant so every `recents()` caller produces a structurally-identical
 * key and shares the single cache entry.
 */
const RECENTS_PARAMS: BookmarkListParams = { per_page: 6 };

/**
 * The `/bookmarks` page size. 20 rows is roughly two screenfuls of a compact
 * row, so the first sentinel hit happens after a deliberate scroll rather than
 * on arrival, and the endpoint's 100 ceiling is nowhere near.
 */
export const BOOKMARKS_PAGE_SIZE = 20;

/**
 * The list's viewer partition — the same required-not-optional contract as
 * `casesQueries` / `conversationsQueries`.
 *
 * `viewerId` is NOT a request parameter (the bearer token authorizes the read);
 * it is a CACHE PARTITION. The v2 QueryClient is a module singleton that
 * survives a v1 sign-out, so without it two accounts on one device could read
 * each other's saved list. Required, so forgetting it is a type error rather
 * than a silent cross-account leak.
 */
export interface ViewerScoped {
  /** The server-verified viewer id (`V2SessionSnapshot.userId`), `null` if signed out. */
  viewerId: number | null;
}

/** Identity of an infinite bookmarks list: the type tab, plus the viewer. */
export interface BookmarksListOptions extends ViewerScoped {
  /** The active type tab. `undefined` is the All tab (no `?type=` on the wire). */
  type?: BookmarkType;
}

export const bookmarksQueries = {
  all: ['bookmarks'] as const,

  lists: () => [...bookmarksQueries.all, 'list'] as const,

  /**
   * Paginated bookmark list. STANDARD tier — a bookmark can be toggled at any
   * time, so a 60s window keeps the strip honest without churning.
   *
   * VIEWER-PARTITIONED like every other v2 list key (review F3). This leaf had
   * no partition while the docblock above claimed the feature enforced one; the
   * claim is now true. It was safe to change because `recents()` has no consumer
   * yet — and it will not be safe later, which is exactly why it is done now.
   */
  list: ({ viewerId, ...params }: BookmarkListParams & ViewerScoped) =>
    queryOptions({
      queryKey: [...bookmarksQueries.lists(), params, { viewerId }] as const,
      queryFn: () => bookmarksApi.getList(params),
      staleTime: STALE_TIMES.standard,
      // Home-glance retention: outlive TanStack's 5-minute default so a return to
      // the home paints this module from cache instead of a skeleton. Without it
      // the conversations recents were warm while every other module was cold.
      gcTime: GC_TIMES.list,
    }),

  /** The read-only recents PEEK (single small page) shared by the home module. */
  recents: ({ viewerId }: ViewerScoped) =>
    bookmarksQueries.list({ ...RECENTS_PARAMS, viewerId }),

  /**
   * The `/bookmarks` PAGE — one newest-first stream, filtered by the type tab.
   *
   * A SEPARATE KEY from `list()`: TanStack forbids sharing a key between
   * `useQuery` and `useInfiniteQuery` (standards §2), and the shapes genuinely
   * differ (`{ pages }` vs one envelope). Each tab is its own entry, so moving
   * between tabs and back re-paints instantly instead of re-fetching.
   *
   * `REFETCH_ON_VISIT`, DELIBERATELY — unlike the cases and statutes libraries.
   * Those refuse the flag because nobody publishes a case from another tab. This
   * list is the opposite: it is the user's OWN collection, and the four surfaces
   * that write to it (a star on the cases list, on a case page, on a statute row,
   * in another tab or on the phone) are all outside this screen. `staleTime`
   * alone would not close that — an arrival inside the 60s window sends no
   * request at all, so a case starred on another device would simply not be here.
   * The cost is stated plainly: TanStack refetches EVERY loaded page on arrival,
   * so a reader who scrolled five pages deep pays five requests when they come
   * back. Accepted for the same reason the conversations list accepts it — five
   * pages deep is exactly where showing a silently stale collection is worst.
   *
   * `GC_TIMES.list` is what makes that arrival warm rather than cold: the rows
   * paint from cache in the first frame and the re-check lands behind them
   * (standards §8: never a skeleton over content already in cache).
   *
   * A 4xx IS A SETTLED ANSWER, NOT A BLIP. The default single retry is dropped
   * for client errors because one of them is a real, designed state on this
   * page: **403**, which the API returns for BOTH the read and the write while
   * the account's email is unverified. Retrying it only delays the screen that
   * explains it.
   *
   * 401 IS NOT ONE OF THEM, and the earlier note here claiming otherwise was
   * wrong (review F7): `lib/api/client.ts`'s response interceptor catches a 401
   * first, clears the auth store and hard-navigates to `/login`, so no v2
   * component ever renders a 401 from this endpoint. The signed-out state on
   * this page comes from the SESSION gate (`enabled: signedIn`), which is why
   * the request is never made at all. The retry policy is unchanged — not
   * retrying a 401 we will never see costs nothing either way.
   */
  infiniteList: ({ type, viewerId }: BookmarksListOptions) =>
    infiniteQueryOptions({
      queryKey: [
        ...bookmarksQueries.lists(),
        'infinite',
        { type: type ?? null },
        { viewerId },
      ] as const,
      queryFn: ({ pageParam }) =>
        bookmarksApi.getList({
          type,
          per_page: BOOKMARKS_PAGE_SIZE,
          page: pageParam,
        }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        const { current_page, last_page } = lastPage.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
      retry: (failureCount, error) => {
        const { status } = extractApiError(error);
        if (status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
    }),
};

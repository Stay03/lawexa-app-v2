import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/notifications';
import { extractApiError } from '@/lib/utils/api-error';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';

/**
 * Notifications query policy — copies the `v2/features/cases/queries.ts`
 * exemplar exactly: a hierarchical key factory whose leaves are `queryOptions()`
 * objects, wrapping the shared `lib/api/notifications.ts` fetchers unchanged.
 *
 * Structure convention (mirrored from the exemplar):
 *  - `all`            the feature root key segment (a value, not a function).
 *  - `lists()`        the "all lists" invalidation handle for every list variant.
 *  - `infiniteList()` one stream per read filter (leaf → `infiniteQueryOptions`).
 *  - `details()`      the "all single rows" handle.
 *  - `detail(id)`     one row, for the `/notifications/{id}` resolver.
 *  - `unreadCount()`  the badge count query (leaf → `queryOptions`).
 *
 * `enabled` is intentionally NOT baked into the leaves — it's a call-site concern
 * (`useQuery({ ...notificationsQueries.unreadCount(), enabled: signedIn })`), the
 * same policy the exemplar documents.
 *
 * ── NO VIEWER PARTITION, KNOWINGLY ─────────────────────────────────────────
 * Unlike `bookmarksQueries`, these keys carry no `viewerId`. A viewer change is
 * covered by `V2CacheIdentityGuard` (`app/v2/layout.tsx`), which drops the whole
 * cache, and adding the partition would mean threading the viewer into
 * `settle.ts` through `channels/mark-read.ts` for no case the guard misses.
 */

/** The API's own read filter. Absent means every row. */
export type NotificationReadFilter = 'unread' | 'read';

/**
 * One page, for BOTH surfaces. The header bell and `/notifications` read the
 * same All-stream cache entry, so they must ask for the same page size: opening
 * the page after glancing at the bell paints rows with no skeleton, and opening
 * the bell after the page paints the page's rows. Twenty is two phone screens,
 * and the bell's panel scrolls anyway.
 */
export const NOTIFICATIONS_PAGE_SIZE = 20;

/**
 * A 4xx is an ANSWER, not a hiccup: a 404 on the resolver means the row is gone,
 * and retrying only delays the designed state (the `bookmarks/queries.ts`
 * rule). Anything else gets the house's single retry.
 */
function retryUnlessRefused(failureCount: number, error: Error): boolean {
  const { status } = extractApiError(error);
  if (status >= 400 && status < 500) return false;
  return failureCount < 1;
}

export const notificationsQueries = {
  all: ['notifications'] as const,

  lists: () => [...notificationsQueries.all, 'list'] as const,

  /**
   * An accumulating stream of rows, newest first, ONE cache entry per read
   * filter. `infiniteList()` (no filter) is the All stream the bell and the
   * page share; `{ read: 'unread' }` is the page's Unread tab. The filter is
   * part of the key as `{ read }` (null for All), and `cache.ts` reads it back
   * off the key to decide what a write means for that entry: a row marked read
   * must LEAVE an unread list and STAY, restyled, in the All list.
   *
   * ONE entry per filter, on purpose. A grow-the-page-size variant would mint a
   * new key per size and leave the abandoned entries holding stale read state;
   * with one infinite key per filter, every write (mark one, mark all, delete,
   * the spine's broadcast invalidation, the post-channel-read settle) lands on
   * exactly the data on screen.
   *
   * STANDARD tier + `REFETCH_ON_VISIT`. A notification always comes from
   * SOMEONE ELSE, and whether `.notification` broadcasts reach this client in
   * prod is unconfirmed, so an arrival must ask (the invitations and bookmarks
   * argument). The cost, stated as those exemplars state it: every loaded page
   * refetches on arrival, behind cached rows that paint first. On the bell that
   * is one request per open.
   */
  infiniteList: ({ read }: { read?: NotificationReadFilter } = {}) =>
    infiniteQueryOptions({
      queryKey: [
        ...notificationsQueries.lists(),
        'infinite',
        { read: read ?? null },
      ] as const,
      queryFn: ({ pageParam }) =>
        notificationsApi.getList({
          read,
          per_page: NOTIFICATIONS_PAGE_SIZE,
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
      retry: retryUnlessRefused,
    }),

  details: () => [...notificationsQueries.all, 'detail'] as const,

  /**
   * One row. `GET /notifications/{id}` is live but missing from
   * `docs/apiDocs/notification-api.md`; it returns the list row byte for byte
   * (the `message` is the same 140-character preview), so its only reader is
   * the resolver, which needs the destination and the read state.
   */
  detail: (id: string) =>
    queryOptions({
      queryKey: [...notificationsQueries.details(), id] as const,
      queryFn: () => notificationsApi.getById(id),
      staleTime: STALE_TIMES.standard,
      retry: retryUnlessRefused,
    }),

  /**
   * Unread count for the bell badge. LIVE tier (staleTime 0) — the runtime's own
   * docs name "badges with no socket coverage" as the canonical live-tier case,
   * so every refocus/mount re-reads the true count. The phase-5 spine also
   * invalidates it on every `.notification` broadcast, and `settle.ts`
   * invalidates it after a channel read clears notifications server-side.
   */
  unreadCount: () =>
    queryOptions({
      queryKey: [...notificationsQueries.all, 'unread-count'] as const,
      queryFn: () => notificationsApi.getUnreadCount(),
      staleTime: STALE_TIMES.live,
    }),
};

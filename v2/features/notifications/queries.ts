import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/notifications';
import { GC_TIMES, STALE_TIMES } from '@/v2/runtime/query';

/**
 * Notifications query policy — copies the `v2/features/cases/queries.ts`
 * exemplar exactly: a hierarchical key factory whose leaves are `queryOptions()`
 * objects, wrapping the shared `lib/api/notifications.ts` fetchers unchanged.
 *
 * Structure convention (mirrored from the exemplar):
 *  - `all`            the feature root key segment (a value, not a function).
 *  - `lists()`        the "all lists" invalidation handle for every list variant.
 *  - `infiniteList()` the bell panel's stream (leaf → `infiniteQueryOptions`).
 *  - `unreadCount()`  the badge count query (leaf → `queryOptions`).
 *
 * `enabled` is intentionally NOT baked into the leaves — it's a call-site concern
 * (`useQuery({ ...notificationsQueries.unreadCount(), enabled: signedIn })`), the
 * same policy the exemplar documents.
 */

/**
 * One page of the bell panel. Small on purpose: the panel opens at ten rows and
 * grows on request, so the common open costs one small request and a reader
 * with a long history is never held behind a big one.
 */
const NOTIFICATIONS_PAGE_SIZE = 10;

export const notificationsQueries = {
  all: ['notifications'] as const,

  lists: () => [...notificationsQueries.all, 'list'] as const,

  /**
   * THE bell list — an accumulating stream rather than a fixed first page,
   * because the panel is now the whole inbox in v2: there is no `/notifications`
   * route in the v2 manifest, and the footer link that used to point at one sent
   * the reader out of the v2 shell into v1's page (see `V2NotificationBell`).
   *
   * ONE cache entry, on purpose. A grow-the-page-size variant would mint a new
   * key per size and leave the abandoned entries holding stale read state for
   * the next panel open; with a single infinite key, every write (mark one,
   * mark all, the spine's broadcast invalidation, the post-channel-read settle)
   * lands on exactly the data the panel is showing.
   *
   * STANDARD tier — a reopen inside a minute is instant, and the socket spine
   * invalidates this key on every `.notification` broadcast, so freshness does
   * not depend on the staleTime.
   */
  infiniteList: () =>
    infiniteQueryOptions({
      queryKey: [...notificationsQueries.lists(), 'infinite'] as const,
      queryFn: ({ pageParam }) =>
        notificationsApi.getList({
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

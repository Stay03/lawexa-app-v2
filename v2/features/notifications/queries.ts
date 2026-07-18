import { queryOptions } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/notifications';
import type { NotificationListParams } from '@/types/notification';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Notifications query policy — copies the `v2/features/cases/queries.ts`
 * exemplar exactly: a hierarchical key factory whose leaves are `queryOptions()`
 * objects, wrapping the shared `lib/api/notifications.ts` fetchers unchanged.
 *
 * Structure convention (mirrored from the exemplar):
 *  - `all`            the feature root key segment (a value, not a function).
 *  - `lists()`        the "all lists" invalidation handle for every list variant.
 *  - `list(p)`        a concrete list query (leaf → `queryOptions`).
 *  - `unreadCount()`  the badge count query (leaf → `queryOptions`).
 *
 * `enabled` is intentionally NOT baked into the leaves — it's a call-site concern
 * (`useQuery({ ...notificationsQueries.unreadCount(), enabled: signedIn })`), the
 * same policy the exemplar documents.
 */
export const notificationsQueries = {
  all: ['notifications'] as const,

  lists: () => [...notificationsQueries.all, 'list'] as const,

  /**
   * Paginated notification list for the bell panel. STANDARD tier — the list is
   * fetched on demand (panel open) and a 60s staleTime keeps a reopen instant
   * without going stale for long.
   */
  list: (params: NotificationListParams = {}) =>
    queryOptions({
      queryKey: [...notificationsQueries.lists(), params] as const,
      queryFn: () => notificationsApi.getList(params),
      staleTime: STALE_TIMES.standard,
    }),

  /**
   * Unread count for the bell badge. LIVE tier (staleTime 0) — the runtime's own
   * docs name "badges with no socket coverage" as the canonical live-tier case,
   * so every refocus/mount re-reads the true count until the phase-5 realtime
   * spine makes socket events the signal.
   */
  unreadCount: () =>
    queryOptions({
      queryKey: [...notificationsQueries.all, 'unread-count'] as const,
      queryFn: () => notificationsApi.getUnreadCount(),
      staleTime: STALE_TIMES.live,
    }),
};

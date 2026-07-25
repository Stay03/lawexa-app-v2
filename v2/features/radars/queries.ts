import { queryOptions } from '@tanstack/react-query';
import { radarsApi } from '@/lib/api/radars';
import type { RadarListParams } from '@/types/radar';
import { GC_TIMES, STALE_TIMES } from '@/v2/runtime/query';

/**
 * Radar query factory (the `cases` exemplar pattern) — the saved-watch list
 * backing the Work home's Radar module. Wraps `radarsApi.getList(params)`
 * unchanged; only this query-policy wrapper is new.
 *
 * The Work module reads the list shape ONLY: `RadarListItem` already carries
 * everything the compact module renders (name, status, `last_scan_at`,
 * `unread_reports_count`), so it never needs a second per-radar scans fetch.
 * Radar names generate asynchronously server-side after create, so the payload
 * is rendered as-is — no polling (a home revisit or the standard-tier
 * refetch-on-focus surfaces the upgraded name).
 *
 * Standard tier: scan state and unread counts move with the schedule, and
 * refetch-on-focus keeps the module honest between visits.
 */
export const radarsQueries = {
  all: ['radars'] as const,

  lists: () => [...radarsQueries.all, 'list'] as const,

  list: (params: RadarListParams = {}) =>
    queryOptions({
      queryKey: [...radarsQueries.lists(), params] as const,
      queryFn: () => radarsApi.getList(params),
      staleTime: STALE_TIMES.standard,
      // Home-glance retention: outlive TanStack's 5-minute default so a return to
      // the home paints this module from cache instead of a skeleton. Without it
      // the conversations recents were warm while every other module was cold.
      gcTime: GC_TIMES.list,
    }),
};

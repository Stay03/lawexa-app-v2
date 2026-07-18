import { queryOptions } from '@tanstack/react-query';
import { spacesApi } from '@/lib/api/collab';
import type { SpaceListParams } from '@/types/collab';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Spaces query factory (the cases exemplar pattern) — SHARED by the Work and
 * Study home tabs, which read the same endpoint filtered by `type` ('work' /
 * 'study'). List rows carry the §17 activity rollups (`unread_channels_count`,
 * `mention_count`) for members, so the tabs can badge spaces from ONE call.
 *
 * Standard tier: activity counts move with channel traffic, and
 * refetch-on-focus keeps the badges honest until the phase-5 realtime spine
 * takes over (`.channel.unread` events are the eventual live signal).
 */
export const spacesQueries = {
  all: ['spaces'] as const,

  lists: () => [...spacesQueries.all, 'list'] as const,

  list: (params: SpaceListParams = {}) =>
    queryOptions({
      queryKey: [...spacesQueries.lists(), params] as const,
      queryFn: () => spacesApi.getList(params),
      staleTime: STALE_TIMES.standard,
    }),
};

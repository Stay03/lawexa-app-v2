import { keepPreviousData, queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import { STALE_TIMES } from '@/v2/runtime/query';
import type { StatsData, StatsPeriod } from './model';

/**
 * The reader's own stats for one period: `GET /me/activity?period=`. The
 * server caches each answer for 30 minutes per person and period, so a longer
 * client cache would only add staleness.
 *
 * `keepPreviousData`: switching the period keeps the last period on screen,
 * dimmed, until the new one arrives, instead of dropping back to the skeleton.
 */
export const statsQueries = {
  all: ['activity-stats'] as const,

  mine: ({ period, viewerId }: { period: StatsPeriod; viewerId: number | null }) =>
    queryOptions({
      queryKey: [...statsQueries.all, period, { viewerId }] as const,
      queryFn: async () =>
        (await apiClient.get<ApiResponse<StatsData>>('/me/activity', { params: { period } })).data.data ?? null,
      staleTime: STALE_TIMES.standard,
      placeholderData: keepPreviousData,
    }),
};

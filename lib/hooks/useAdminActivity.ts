'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { adminActivityApi } from '@/lib/api/admin-activity';
import type {
  ActivityFacetsParams,
  ActivityFeedParams,
  ActivityFeedResponse,
  ActivityStatsParams,
} from '@/types/admin-activity';

export const adminActivityKeys = {
  all: ['admin', 'activity'] as const,
  list: (params: Omit<ActivityFeedParams, 'cursor'>) =>
    [...adminActivityKeys.all, 'list', params] as const,
  stats: (params: ActivityStatsParams) =>
    [...adminActivityKeys.all, 'stats', params] as const,
  facets: (params: ActivityFacetsParams) =>
    [...adminActivityKeys.all, 'facets', params] as const,
  userList: (uuid: string, params: Omit<ActivityFeedParams, 'cursor' | 'user_id'>) =>
    [...adminActivityKeys.all, 'user', uuid, 'list', params] as const,
};

interface UseActivityFeedOptions {
  live: boolean;
  pollMs?: number;
}

export function useActivityFeed(
  params: Omit<ActivityFeedParams, 'cursor'> = {},
  { live, pollMs = 3000 }: UseActivityFeedOptions = { live: true }
) {
  return useInfiniteQuery<
    ActivityFeedResponse,
    Error,
    { pages: ActivityFeedResponse[]; pageParams: (string | undefined)[] },
    ReturnType<typeof adminActivityKeys.list>,
    string | undefined
  >({
    queryKey: adminActivityKeys.list(params),
    queryFn: ({ pageParam }) =>
      adminActivityApi.getActivityFeed({ ...params, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) =>
      last.pagination.has_more ? last.pagination.next_cursor ?? undefined : undefined,
    refetchInterval: live ? pollMs : false,
    refetchIntervalInBackground: false,
    staleTime: live ? 0 : 30_000,
  });
}

export function useActivityFeedStats(params: ActivityStatsParams = {}) {
  return useQuery({
    queryKey: adminActivityKeys.stats(params),
    queryFn: () => adminActivityApi.getActivityFeedStats(params),
    staleTime: 60_000,
  });
}

export function useActivityFeedFacets(params: ActivityFacetsParams = {}) {
  return useQuery({
    queryKey: adminActivityKeys.facets(params),
    queryFn: () => adminActivityApi.getActivityFeedFacets(params),
    staleTime: 60_000,
  });
}

export function useUserActivityFeed(
  userUuid: string,
  params: Omit<ActivityFeedParams, 'cursor' | 'user_id'> = {},
  { live, pollMs = 3000 }: UseActivityFeedOptions = { live: false }
) {
  return useInfiniteQuery<
    ActivityFeedResponse,
    Error,
    { pages: ActivityFeedResponse[]; pageParams: (string | undefined)[] },
    ReturnType<typeof adminActivityKeys.userList>,
    string | undefined
  >({
    queryKey: adminActivityKeys.userList(userUuid, params),
    queryFn: ({ pageParam }) =>
      adminActivityApi.getUserActivityFeed(userUuid, {
        ...params,
        cursor: pageParam,
      }),
    initialPageParam: undefined,
    getNextPageParam: (last) =>
      last.pagination.has_more ? last.pagination.next_cursor ?? undefined : undefined,
    enabled: Boolean(userUuid),
    refetchInterval: live ? pollMs : false,
    refetchIntervalInBackground: false,
    staleTime: live ? 0 : 30_000,
  });
}

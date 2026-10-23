import { infiniteQueryOptions } from '@tanstack/react-query';
import { extractApiError } from '@/lib/utils/api-error';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';
import type { ViewerScoped } from '@/v2/features/conversations/queries';
import { homeTimelineApi } from './api';
import type { TimelineType } from './types';

/**
 * The home timeline's query policy. One accumulating list per tab, paged by
 * the server's `next_cursor`.
 *
 * Everything on it is done by SOMEONE ELSE (a file added, a reply, an
 * invitation), so no local event could have told us: it asks again on every
 * arrival at the tab and on window focus, and keeps 30 minutes of pages so the
 * return paints at once while it asks.
 *
 * `viewerId` is a cache partition, not a request parameter: two accounts on one
 * device never share a timeline.
 */
export interface TimelineOptions extends ViewerScoped {
  type: TimelineType;
}

export const homeTimelineQueries = {
  /** The prefix an answered invitation invalidates (`invitations/mutations.ts`). */
  all: ['home-timeline'] as const,

  list: ({ type, viewerId }: TimelineOptions) =>
    infiniteQueryOptions({
      queryKey: [...homeTimelineQueries.all, { type }, { viewerId }] as const,
      queryFn: ({ pageParam }) => homeTimelineApi.page({ type, cursor: pageParam ?? undefined }),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
      // A 4xx (signed out, a refused tab) does not change on a second ask.
      retry: (failureCount, error) => {
        const { status } = extractApiError(error);
        if (status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
    }),
};

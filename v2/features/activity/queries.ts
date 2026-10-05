import { infiniteQueryOptions } from '@tanstack/react-query';
import { chatApi } from '@/lib/api/chat';
import type { ListMessagesParams, MessagesListResponse } from '@/types/chat';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';
import type { ViewerScoped } from '@/v2/features/conversations/queries';

/**
 * Activity query policy — the `conversationsQueries.infiniteList` shape over
 * `chatApi.listMessages` (GET /api/messages), the same fetcher v1's
 * `/activity` uses, unchanged.
 *
 * WHAT THE ENDPOINT DOES (measured against production, 5 October 2026):
 *  - PAGE pagination, not a cursor: the envelope is `pagination.current_page`
 *    / `last_page`, so `getNextPageParam` reads those, as every v2 infinite
 *    list over a Laravel paginator does.
 *  - `search` is honoured and matches the MESSAGE TEXT only. "Stilk" found the
 *    one question that named Stilk v Myrick; a phrase that appears only in a
 *    conversation's title found nothing beyond the questions that contain it.
 *    The field's label says so.
 *  - `role=user` limits the feed to the reader's own questions and
 *    `exclude_errors` drops failed sends, as v1 asked.
 *
 * Retention and freshness are the conversations list's, for its reasons: 30
 * minutes for the unfiltered list so a return paints instantly, the 5-minute
 * default for each search string, and a re-check on every arrival so a
 * question asked in another tab shows up (announced by the `NewRowsPill`).
 */

/** v1's page size: twenty questions, a little over one phone screen of runs. */
const PER_PAGE = 20;

export interface ActivityListOptions extends ViewerScoped {
  /** Text search (`?search=`). Empty / whitespace is treated as no filter. */
  search?: string;
}

export const activityQueries = {
  all: ['activity'] as const,

  lists: () => [...activityQueries.all, 'list'] as const,

  infiniteList: ({ search, viewerId }: ActivityListOptions) => {
    const trimmed = search?.trim();
    const params: ListMessagesParams = {
      per_page: PER_PAGE,
      role: 'user',
      exclude_errors: true,
      sort_order: 'desc',
      ...(trimmed ? { search: trimmed } : {}),
    };
    return infiniteQueryOptions({
      queryKey: [...activityQueries.lists(), params, { viewerId }] as const,
      queryFn: ({ pageParam }) => chatApi.listMessages({ ...params, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage: MessagesListResponse) => {
        const { current_page, last_page } = lastPage.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      staleTime: STALE_TIMES.standard,
      gcTime: trimmed ? undefined : GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    });
  },
};

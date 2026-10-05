import { queryOptions } from '@tanstack/react-query';
import { chatApi } from '@/lib/api/chat';
import type { ListMessagesParams } from '@/types/chat';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';
import type { ViewerScoped } from '@/v2/features/conversations/queries';

/**
 * Activity query policy — one query per PAGE of `chatApi.listMessages`
 * (GET /api/messages), the same fetcher v1's `/activity` uses, unchanged. The
 * screen is a paged table (owner, 5 October 2026: "a clean paginated table
 * here rather than the timeline"), so each page is its own cache entry and
 * Back to page 2 paints from the cache.
 *
 * WHAT THE ENDPOINT DOES (measured against production, 5 October 2026):
 *  - PAGE pagination, a Laravel paginator: `pagination` holds `current_page`,
 *    `per_page`, `total`, `last_page`, `from` and `to`. A page past the end
 *    answers 200 with no rows, `from` and `to` null, and the true `last_page`,
 *    which is how the screen offers the way back.
 *  - `search` is honoured and matches the MESSAGE TEXT only. "Stilk" found the
 *    one question that named Stilk v Myrick; a phrase that appears only in a
 *    conversation's title found nothing beyond the questions that contain it.
 *    The field's label says so.
 *  - `role=user` limits the feed to the reader's own questions and
 *    `exclude_errors` drops failed sends, as v1 asked.
 *
 * Retention and freshness are the conversations list's, for its reasons: 30
 * minutes for each unfiltered page so a return paints instantly, the 5-minute
 * default for each search string, and a re-check on every arrival so a
 * question asked in another tab shows up on page 1.
 */

/** v1's page size: twenty questions a page. */
export const PER_PAGE = 20;

export interface ActivityListOptions extends ViewerScoped {
  /** Text search (`?search=`). Empty / whitespace is treated as no filter. */
  search?: string;
  /** The page (`?page=`), from 1. */
  page: number;
}

export const activityQueries = {
  all: ['activity'] as const,

  lists: () => [...activityQueries.all, 'list'] as const,

  page: ({ search, page, viewerId }: ActivityListOptions) => {
    const trimmed = search?.trim();
    const params: ListMessagesParams = {
      page,
      per_page: PER_PAGE,
      role: 'user',
      exclude_errors: true,
      sort_order: 'desc',
      ...(trimmed ? { search: trimmed } : {}),
    };
    return queryOptions({
      queryKey: [...activityQueries.lists(), params, { viewerId }] as const,
      queryFn: () => chatApi.listMessages(params),
      staleTime: STALE_TIMES.standard,
      gcTime: trimmed ? undefined : GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    });
  },
};

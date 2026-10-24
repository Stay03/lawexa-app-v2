import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { contentRequestsApi } from '@/lib/api/content-requests';
import { extractApiError } from '@/lib/utils/api-error';
import type { ContentRequestListResponse, SubmitContentRequestData } from '@/types/content-request';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';
import { prependRequest, REQUESTS_PAGE_SIZE } from './model';

/** A 4xx is a settled answer (403 not yours, 404 gone); only a fault is retried, once. */
function retryFaultsOnce(failureCount: number, error: unknown): boolean {
  const { status } = extractApiError(error);
  if (status >= 400 && status < 500) return false;
  return failureCount < 1;
}

/**
 * My requests: the same three calls as v1's screens (`lib/api/content-requests.ts`),
 * wrapped in v2's query policy. Keyed by the viewer, like every v2 list.
 *
 * `REFETCH_ON_VISIT` on the list: the research team changes a request's status
 * from the admin screens, never from here, so an arrival inside the stale window
 * must still ask whether anything moved.
 */
export const requestsQueries = {
  all: ['settings', 'requests'] as const,

  lists: () => [...requestsQueries.all, 'list'] as const,

  list: (viewerId: number | null) =>
    infiniteQueryOptions({
      queryKey: [...requestsQueries.lists(), { viewerId }] as const,
      queryFn: ({ pageParam }) =>
        contentRequestsApi.getList({
          page: pageParam,
          per_page: REQUESTS_PAGE_SIZE,
          sort: 'created_at',
          direction: 'desc',
        }),
      initialPageParam: 1,
      getNextPageParam: (lastPage: ContentRequestListResponse) => {
        const { current_page, last_page } = lastPage.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
      retry: retryFaultsOnce,
    }),

  detail: (uuid: string, viewerId: number | null) =>
    queryOptions({
      queryKey: [...requestsQueries.all, 'detail', uuid, { viewerId }] as const,
      queryFn: async () => (await contentRequestsApi.getByUuid(uuid)).data,
      staleTime: STALE_TIMES.standard,
      refetchOnMount: REFETCH_ON_VISIT,
      retry: retryFaultsOnce,
    }),
};

/**
 * Send a new request. On success the server's row goes to the top of the
 * cached list at once, and the list is then re-read behind it so the count and
 * the pages match the server.
 *
 * `silentError`: a 422 belongs beside its field and a 403 in the form, both
 * drawn by the panel, so the global error toast stays out of it.
 */
export function useSubmitRequest(viewerId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitContentRequestData) => contentRequestsApi.submit(body),
    meta: { silentError: true },
    onSuccess: (response) => {
      const created = response.data;
      queryClient.setQueryData<InfiniteData<ContentRequestListResponse, number>>(
        requestsQueries.list(viewerId).queryKey,
        (data) => prependRequest(data, created),
      );
      queryClient.setQueryData(requestsQueries.detail(created.uuid, viewerId).queryKey, created);
      void queryClient.invalidateQueries({ queryKey: requestsQueries.lists() });
    },
  });
}

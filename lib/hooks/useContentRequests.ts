'use client';

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contentRequestsApi } from '@/lib/api/content-requests';
import type { ContentRequestListParams, SubmitContentRequestData } from '@/types/content-request';

// Query keys factory
export const contentRequestKeys = {
  all: ['content-requests'] as const,
  lists: () => [...contentRequestKeys.all, 'list'] as const,
  list: (params: ContentRequestListParams) => [...contentRequestKeys.lists(), params] as const,
  details: () => [...contentRequestKeys.all, 'detail'] as const,
  detail: (uuid: string) => [...contentRequestKeys.details(), uuid] as const,
};

/**
 * Hook for fetching infinite scrolling content request list
 */
export function useInfiniteContentRequests(params: Omit<ContentRequestListParams, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: [...contentRequestKeys.lists(), 'infinite', params] as const,
    queryFn: ({ pageParam }) => contentRequestsApi.getList({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { current_page, last_page } = lastPage.pagination;
      return current_page < last_page ? current_page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook for fetching single content request by UUID
 */
export function useContentRequest(uuid: string) {
  return useQuery({
    queryKey: contentRequestKeys.detail(uuid),
    queryFn: () => contentRequestsApi.getByUuid(uuid),
    enabled: !!uuid,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for submitting a new content request
 */
export function useSubmitContentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SubmitContentRequestData) => contentRequestsApi.submit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contentRequestKeys.lists() });
    },
  });
}

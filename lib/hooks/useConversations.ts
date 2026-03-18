'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { chatApi } from '@/lib/api/chat';
import type { ListConversationsParams } from '@/types/chat';

// Query keys factory
export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (params: Omit<ListConversationsParams, 'page'>) =>
    [...conversationKeys.lists(), params] as const,
};

/**
 * Hook for fetching infinite scrolling conversation list
 */
export function useInfiniteConversations(
  params: Omit<ListConversationsParams, 'page'> = {}
) {
  return useInfiniteQuery({
    queryKey: [...conversationKeys.lists(), 'infinite', params] as const,
    queryFn: ({ pageParam }) =>
      chatApi.listConversations({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { current_page, last_page } = lastPage.pagination;
      return current_page < last_page ? current_page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

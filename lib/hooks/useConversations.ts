'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { chatApi } from '@/lib/api/chat';
import type { ChatReferenceType, ListConversationsParams } from '@/types/chat';

type ContentConversationType = ChatReferenceType;

// Query keys factory
export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (params: Omit<ListConversationsParams, 'page'>) =>
    [...conversationKeys.lists(), params] as const,
  content: (
    contentType: ContentConversationType,
    id: string,
    params: Omit<ListConversationsParams, 'page'>,
  ) => [...conversationKeys.lists(), 'content', contentType, id, params] as const,
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

/**
 * Hook for the infinite-scrolling list of the user's conversations about a
 * single piece of content (case / note / statute / radar / radar_scan). Backs
 * the "Related conversations" view in the floating chat panel.
 *
 * `id` is a slug (case/note/statute) or uuid (radar/radar_scan). Pass
 * `enabled: false` to keep it idle until the panel is opened.
 */
export function useInfiniteContentConversations(
  contentType: ContentConversationType,
  id: string,
  params: Omit<ListConversationsParams, 'page'> = {},
  options: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: conversationKeys.content(contentType, id, params),
    queryFn: ({ pageParam }) =>
      chatApi.listContentConversations(contentType, id, { ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { current_page, last_page } = lastPage.pagination;
      return current_page < last_page ? current_page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: (options.enabled ?? true) && Boolean(id),
  });
}

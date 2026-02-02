'use client';

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationSharingApi } from '@/lib/api/conversationSharing';
import type {
  SharedConversationsParams,
  TrendingConversationsParams,
} from '@/types/chat';

// Query key factory
export const conversationSharingKeys = {
  all: ['conversationSharing'] as const,
  shared: () => [...conversationSharingKeys.all, 'shared'] as const,
  sharedList: (params: SharedConversationsParams) => [...conversationSharingKeys.shared(), params] as const,
  trending: () => [...conversationSharingKeys.all, 'trending'] as const,
  trendingList: (params: TrendingConversationsParams) => [...conversationSharingKeys.trending(), params] as const,
};

// Conversation detail key (for invalidation)
const conversationKeys = {
  detail: (id: string) => ['conversations', 'detail', id] as const,
};

/**
 * Hook for fetching shared conversations
 */
export function useSharedConversations(params: SharedConversationsParams = {}) {
  return useQuery({
    queryKey: conversationSharingKeys.sharedList(params),
    queryFn: () => conversationSharingApi.getShared(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook for infinite scrolling shared conversations
 */
export function useInfiniteSharedConversations(params: Omit<SharedConversationsParams, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: [...conversationSharingKeys.shared(), 'infinite', params] as const,
    queryFn: ({ pageParam }) => conversationSharingApi.getShared({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { current_page, last_page } = lastPage.pagination;
      return current_page < last_page ? current_page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook for fetching trending conversations
 */
export function useTrendingConversations(params: TrendingConversationsParams = {}) {
  return useQuery({
    queryKey: conversationSharingKeys.trendingList(params),
    queryFn: () => conversationSharingApi.getTrending(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook for infinite scrolling trending conversations
 */
export function useInfiniteTrendingConversations(params: Omit<TrendingConversationsParams, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: [...conversationSharingKeys.trending(), 'infinite', params] as const,
    queryFn: ({ pageParam }) => conversationSharingApi.getTrending({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { current_page, last_page } = lastPage.pagination;
      return current_page < last_page ? current_page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook for publishing a conversation (make it public)
 */
export function usePublishConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => conversationSharingApi.publish(conversationId),
    onSuccess: (_data, conversationId) => {
      // Invalidate the conversation detail cache
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
      // Invalidate shared lists (new public conversation should appear)
      queryClient.invalidateQueries({ queryKey: conversationSharingKeys.shared() });
    },
  });
}

/**
 * Hook for unpublishing a conversation (make it private)
 */
export function useUnpublishConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => conversationSharingApi.unpublish(conversationId),
    onSuccess: (_data, conversationId) => {
      // Invalidate the conversation detail cache
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
      // Invalidate shared lists (unpublished conversation should be removed)
      queryClient.invalidateQueries({ queryKey: conversationSharingKeys.shared() });
      // Invalidate trending (might be removed from trending)
      queryClient.invalidateQueries({ queryKey: conversationSharingKeys.trending() });
    },
  });
}

/**
 * Hook for toggling conversation visibility
 */
export function useToggleConversationVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => conversationSharingApi.toggleVisibility(conversationId),
    onSuccess: (_data, conversationId) => {
      // Invalidate the conversation detail cache
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
      // Invalidate shared lists
      queryClient.invalidateQueries({ queryKey: conversationSharingKeys.shared() });
      // Invalidate trending
      queryClient.invalidateQueries({ queryKey: conversationSharingKeys.trending() });
    },
  });
}

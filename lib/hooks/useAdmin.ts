'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import type { AdminConversationsParams } from '@/types/admin';

// Query key factory for organized caching
export const adminKeys = {
  all: ['admin'] as const,
  conversations: () => [...adminKeys.all, 'conversations'] as const,
  conversationsList: (params: AdminConversationsParams) =>
    [...adminKeys.conversations(), 'list', params] as const,
  conversationDetail: (uuid: string) =>
    [...adminKeys.conversations(), 'detail', uuid] as const,
};

/**
 * Hook for fetching admin conversations list with pagination, filtering, sorting
 */
export function useAdminConversations(params: AdminConversationsParams = {}) {
  return useQuery({
    queryKey: adminKeys.conversationsList(params),
    queryFn: () => adminApi.getConversations(params),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for fetching a single conversation with all messages
 */
export function useAdminConversation(uuid: string) {
  return useQuery({
    queryKey: adminKeys.conversationDetail(uuid),
    queryFn: () => adminApi.getConversation(uuid),
    enabled: !!uuid,
    staleTime: 30 * 1000, // 30 seconds
  });
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { chatApi } from '@/lib/api/chat';
import type { ListMessagesParams } from '@/types/chat';

export const messageKeys = {
  all: ['messages'] as const,
  lists: () => [...messageKeys.all, 'list'] as const,
  list: (params: ListMessagesParams) =>
    [...messageKeys.lists(), params] as const,
};

/**
 * Fetch a paginated page of the authenticated user's messages.
 */
export function useMessages(params: ListMessagesParams = {}) {
  return useQuery({
    queryKey: messageKeys.list(params),
    queryFn: () => chatApi.listMessages(params),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

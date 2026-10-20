'use client';

import { useQuery } from '@tanstack/react-query';
import { adminChatErrorsApi } from '@/lib/api/admin-chat-errors';
import type { ChatErrorSummaryParams, ChatErrorsParams } from '@/types/admin-chat-errors';

export const chatErrorKeys = {
  all: ['admin', 'chat-errors'] as const,
  lists: () => [...chatErrorKeys.all, 'list'] as const,
  list: (params: ChatErrorsParams) => [...chatErrorKeys.lists(), params] as const,
  summaries: () => [...chatErrorKeys.all, 'summary'] as const,
  summary: (params: ChatErrorSummaryParams) => [...chatErrorKeys.summaries(), params] as const,
};

export function useChatErrors(params: ChatErrorsParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: chatErrorKeys.list(params),
    queryFn: () => adminChatErrorsApi.getErrors(params),
    staleTime: 30 * 1000,
    enabled: options?.enabled !== false,
  });
}

export function useChatErrorSummary(
  params: ChatErrorSummaryParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: chatErrorKeys.summary(params),
    queryFn: () => adminChatErrorsApi.getSummary(params),
    staleTime: 30 * 1000,
    enabled: options?.enabled !== false,
  });
}

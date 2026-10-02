'use client';

import { useQuery } from '@tanstack/react-query';

import { chatApi } from '@/lib/api/chat';
import { parseToolResult } from '@/lib/utils/transform-api-messages';
import type { ToolMessage } from '@/types/chat';
import { GC_TIMES } from '@/v2/runtime/query';
import { useV2ChatContext } from '../chat-context';

/**
 * A step's result, fetched the first time the step is opened when the chat
 * download left it out (v2 opens chats with `?results=lazy`; backend's
 * 8f916fab). The step's label and tick never waited on it: they come from the
 * result's metadata. Only the opened body does.
 *
 * A result never changes once written, so a fetched one is kept for the
 * visit (`staleTime: Infinity`) and reopening the step costs nothing. Returns
 * the step with its result filled in, or the fetch's state while it runs.
 */
export function useToolResult(message: ToolMessage, enabled: boolean) {
  const conversationId = useV2ChatContext()?.conversationId ?? null;
  const ref = message.resultRef;
  const needed = !!ref && message.toolResult?.data == null && conversationId !== null;

  const query = useQuery({
    queryKey: ['tool-result', conversationId, ref?.messageId] as const,
    queryFn: async () => {
      const response = await chatApi.getToolResult(conversationId as string, (ref as { messageId: number }).messageId);
      if (!response.success || !response.data) throw new Error(response.message || 'The result did not load.');
      return parseToolResult(response.data);
    },
    enabled: enabled && needed,
    staleTime: Infinity,
    gcTime: GC_TIMES.list,
  });

  if (!needed) return { message, status: 'ready' as const, retry: query.refetch };
  if (query.data) {
    return {
      // The row's own state (a failed step's tick and error) stays the row's.
      message: { ...message, toolResult: { ...query.data, success: message.toolResult?.success ?? query.data.success } },
      status: 'ready' as const,
      retry: query.refetch,
    };
  }
  return { message, status: query.isError ? ('error' as const) : ('loading' as const), retry: query.refetch };
}

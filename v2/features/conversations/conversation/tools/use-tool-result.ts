'use client';

import { useQueries, useQuery } from '@tanstack/react-query';

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
  const { needed, options } = toolResultQuery(conversationId, message, enabled);
  const query = useQuery(options);

  if (!needed) return { message, status: 'ready' as const, retry: query.refetch };
  if (query.data) return { message: withResult(message, query.data), status: 'ready' as const, retry: query.refetch };
  return { message, status: query.isError ? ('error' as const) : ('loading' as const), retry: query.refetch };
}

/**
 * Several finished steps' results at once, through the same cache entries as
 * `useToolResult`, so a card that also asks for one fetches nothing twice. A
 * step whose result is still loading comes back as it is (no data yet).
 */
export function useToolResults(messages: ToolMessage[]): ToolMessage[] {
  const conversationId = useV2ChatContext()?.conversationId ?? null;
  const built = messages.map((message) => toolResultQuery(conversationId, message, message.toolStatus === 'complete'));
  const queries = useQueries({ queries: built.map(({ options }) => options) });
  return messages.map((message, index) => {
    const data = queries[index]?.data;
    return built[index].needed && data ? withResult(message, data) : message;
  });
}

/** Whether a step's result is still to fetch, and the query that fetches it. */
function toolResultQuery(conversationId: string | null, message: ToolMessage, enabled: boolean) {
  const ref = message.resultRef;
  const needed = !!ref && message.toolResult?.data == null && conversationId !== null;
  return {
    needed,
    options: {
      queryKey: ['tool-result', conversationId, ref?.messageId] as const,
      queryFn: async () => {
        const response = await chatApi.getToolResult(conversationId as string, (ref as { messageId: number }).messageId);
        if (!response.success || !response.data) throw new Error(response.message || 'The result did not load.');
        return parseToolResult(response.data);
      },
      enabled: enabled && needed,
      staleTime: Infinity,
      gcTime: GC_TIMES.list,
    },
  };
}

/** The step with its fetched result. The row's own state (a failed step's tick and error) stays the row's. */
function withResult(message: ToolMessage, data: NonNullable<ToolMessage['toolResult']>): ToolMessage {
  return { ...message, toolResult: { ...data, success: message.toolResult?.success ?? data.success } };
}

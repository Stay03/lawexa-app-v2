import { queryOptions } from '@tanstack/react-query';

import { agentConversationsApi } from '@/lib/api/agent-conversations';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * The agent conversations a chat started (sub-agents contract, 3.1), for the
 * side panel: whether one is running, the turn to watch, and whether the
 * reader may type into it. Read when the panel opens and again when a turn in
 * it ends; never polled (the contract adds no poll: the panel watches the
 * running turn's own stream).
 */
export const agentConversationQueries = {
  all: () => ['agent-conversations'] as const,

  of: ({ parentId, viewerId }: { parentId: string; viewerId: number | null }) =>
    queryOptions({
      queryKey: [...agentConversationQueries.all(), parentId, { viewerId }] as const,
      queryFn: async () => {
        const response = await agentConversationsApi.list(parentId);
        if (!response.success) throw new Error(response.message || 'Could not read the agent conversations.');
        return response.data.agent_conversations;
      },
      staleTime: STALE_TIMES.live,
      retry: false,
    }),
};

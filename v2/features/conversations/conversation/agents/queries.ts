import { queryOptions } from '@tanstack/react-query';

import { agentConversationsApi } from '@/lib/api/agent-conversations';
import { STALE_TIMES } from '@/v2/runtime/query';
import { BACKGROUND_JOBS_POLL_MS } from '../../queries';
import { stopsPolling } from '../space-turn';
import { v2EchoConnected } from '@/v2/runtime/realtime/echo';
import { chainPollMs } from './agent-chain';
import { agentsWorking } from './agent-roster';

/**
 * The agent conversations a chat started (sub-agents contract, 3.1): for the
 * agents' rows in the chat (C1) and the side panel, each call's state, the
 * turn to watch, and whether the reader may stop it or type into it.
 *
 * Nothing pushes a change to other readers (Backend, 12 November 2026), so it
 * is read as the chat opens, when a turn in the chat or an agent's streamed
 * turn ends, on a notification about the chat (the spine), and on the jobs'
 * modest beat while an agent is still working: a reader who did not ask
 * learns of the reply that way. A refusal (403, 404) stops the beat.
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
      refetchInterval: (query) =>
        !stopsPolling(query.state.error) && agentsWorking(query.state.data ?? []) ? BACKGROUND_JOBS_POLL_MS : false,
      refetchOnWindowFocus: (query) => !stopsPolling(query.state.error),
    }),
};

/**
 * A chat's agent chain (chain view, thread 694678cf): every agent its turns
 * called, at every depth, the messages held while they work, and whether the
 * chain is open. The server pushes each change (`agent_chain.changed`, read
 * again by the spine and the Space listener), so it is read as the chat
 * opens, on a push, when a turn in the chat ends, and on a 3 s beat only
 * while the chain is open and the socket is down. A refusal (403, 404) stops
 * the beat.
 */
export const agentChainQueries = {
  all: () => ['agent-chain'] as const,

  of: ({ conversationId, viewerId }: { conversationId: string; viewerId: number | null }) =>
    queryOptions({
      queryKey: [...agentChainQueries.all(), conversationId, { viewerId }] as const,
      queryFn: async () => {
        const response = await agentConversationsApi.chain(conversationId);
        if (!response.success) throw new Error(response.message || 'Could not read the agents.');
        return response.data;
      },
      staleTime: STALE_TIMES.live,
      retry: false,
      refetchInterval: (query) => (stopsPolling(query.state.error) ? false : chainPollMs(query.state.data, v2EchoConnected())),
      refetchOnWindowFocus: (query) => !stopsPolling(query.state.error),
    }),
};

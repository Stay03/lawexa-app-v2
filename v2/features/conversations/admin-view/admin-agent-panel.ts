import { adminApi } from '@/lib/api/admin';
import type { ConversationData } from '@/types/chat';
import { conversationsQueries } from '../queries';
import type { AgentPanelSource } from '../conversation/agents/agent-panel-source';
import { agentConversationQueries } from '../conversation/agents/queries';

/**
 * The admin view's agent panel source (Stay, thread 085a980c, 26 November
 * 2026: "make sure other stuff are like for like"): an agent conversation
 * read through `GET /api/admin/conversations/{uuid}` (Backend aee2efb0, which
 * serves agent conversations too, with the owner's fields one for one) and
 * the agents around it through `/agent-conversations`, under the owner's
 * query keys (the admin view keeps its own query client).
 *
 * A SNAPSHOT, as the rest of the admin view: every agent is marked as one
 * nobody here may type into or stop, no running turn is followed, and
 * nothing is read again on a timer or on focus. A Space chat answers 404.
 */
export const ADMIN_AGENT_PANEL: AgentPanelSource = {
  transcript: (args) => ({
    ...conversationsQueries.detail(args),
    // The owner's ConversationData field for field, plus the staff fields the panel does not read.
    queryFn: async () => (await adminApi.getConversation(args.conversationId)).data as unknown as ConversationData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  }),
  agents: (args) => ({
    ...agentConversationQueries.of(args),
    queryFn: async () =>
      (await adminApi.getConversationAgentConversations(args.parentId)).data.agent_conversations.map((agent) => ({
        ...agent,
        can_send: false,
        execution_id: null,
        stream_url: null,
      })),
    refetchInterval: false,
    refetchOnWindowFocus: false,
  }),
};

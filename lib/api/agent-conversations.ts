import { apiClient } from './client';
import type { AgentConversationListResponse, AgentConversationSendResponse } from '@/types/agent-conversations';

/**
 * Agent conversations REST client (sub-agents contract, section 3). The
 * transcript itself is read like any chat (`chatApi.getConversation`), and a
 * running turn is watched on `GET /api/chat/stream/{execution_id}` like any
 * chat's. Every method returns the raw `{ success, message, data }` envelope.
 */
export const agentConversationsApi = {
  /**
   * The agent conversations a chat (or an agent conversation) started, oldest
   * first. `404` for a reader of neither the chat nor its Space, and for a
   * chat that takes no background jobs.
   */
  list: async (conversationUuid: string): Promise<AgentConversationListResponse> => {
    const response = await apiClient.get<AgentConversationListResponse>(`/conversations/${conversationUuid}/agent-conversations`);
    return response.data;
  },

  /**
   * Type into an agent conversation: the agent answers in it, and that answer
   * wakes nobody. `403` for a reader who may not send, `409 PENDING_RESPONSE`
   * while the agent is still answering (the chat's body, with its
   * `stream_url`), `422` when the agent is switched off. Charged as a chat
   * message.
   */
  send: async (agentConversationUuid: string, message: string): Promise<AgentConversationSendResponse> => {
    const response = await apiClient.post<AgentConversationSendResponse>(`/agent-conversations/${agentConversationUuid}/messages`, {
      message,
    });
    return response.data;
  },
};

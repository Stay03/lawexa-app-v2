import type { AgentChain, AgentChainState } from '@/types/agent-chain';
import type { AgentConversation } from '@/types/agent-conversations';

/**
 * The admin view's agent chain, from the agent conversations its route gives
 * (`GET /admin/conversations/{uuid}/agent-conversations`): a snapshot the deck
 * can draw. Each row reads its newest call's state; nothing streams, so no row
 * carries a turn to follow; staff may not type into or stop any of them; the
 * chain is shown closed, so the deck draws no Stop, clock or queued count.
 */
const CALL_STATE: Record<NonNullable<AgentConversation['latest_call']>['state'], AgentChainState> = {
  working: 'running',
  replied: 'replied',
  failed: 'failed',
  cancelled: 'stopped',
};

export function adminChainSnapshot(conversations: readonly AgentConversation[]): AgentChain {
  return {
    agents: conversations.map((conversation) => ({
      ...conversation,
      status: 'idle',
      execution_id: null,
      stream_url: null,
      can_send: false,
      state: conversation.latest_call ? CALL_STATE[conversation.latest_call.state] : 'replied',
      waiting_on: null,
    })),
    held_messages: [],
    chain_open: false,
  };
}

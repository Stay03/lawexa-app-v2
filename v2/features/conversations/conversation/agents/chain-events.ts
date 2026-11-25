import type { QueryClient } from '@tanstack/react-query';

import type { AgentChainChangedEvent, HeldMessagesAnsweredEvent } from '@/types/agent-chain';
import { conversationsQueries } from '../../queries';
import { agentChainQueries, agentConversationQueries } from './queries';

/**
 * The chain's pushed events (chain view, Backend a779b3cc), as the spine
 * (`users.{uuid}`) and the Space listener (`spaces.{uuid}`) hand them over.
 * Both channels carry the same events for a Space chat's owner, so landing
 * one twice only reads the chain again, which costs one read.
 *
 * `agent_chain.changed`: an agent in the chat's chain changed state. The
 * chain and the agents' own list are read again; the jobs too, since an
 * agent's reply ends a job.
 *
 * `held_messages.answered`: the turn answering the held messages started.
 * The open chat attaches to its stream ({@link onHeldMessagesAnswered}); the
 * chain and the transcript are read again, so the held marks clear.
 */

type HeldAnsweredListener = (event: HeldMessagesAnsweredEvent) => void;
const heldAnsweredListeners = new Set<HeldAnsweredListener>();

/** The open chat listens here to attach to the turn answering its held messages. */
export function onHeldMessagesAnswered(listener: HeldAnsweredListener): () => void {
  heldAnsweredListeners.add(listener);
  return () => {
    heldAnsweredListeners.delete(listener);
  };
}

function readChainAgain(queryClient: QueryClient, conversationId: string): void {
  void queryClient.invalidateQueries({ queryKey: [...agentChainQueries.all(), conversationId] });
  void queryClient.invalidateQueries({ queryKey: [...agentConversationQueries.all(), conversationId] });
  void queryClient.invalidateQueries({ queryKey: conversationsQueries.backgroundJobsOf(conversationId) });
}

export function landAgentChainChanged(queryClient: QueryClient, event: Pick<AgentChainChangedEvent, 'conversation_id'>): void {
  if (!event?.conversation_id) return;
  readChainAgain(queryClient, event.conversation_id);
}

export function landHeldMessagesAnswered(queryClient: QueryClient, event: HeldMessagesAnsweredEvent): void {
  if (!event?.conversation_id || !event.execution_id) return;
  for (const listener of heldAnsweredListeners) listener(event);
  readChainAgain(queryClient, event.conversation_id);
  void queryClient.invalidateQueries({ queryKey: [...conversationsQueries.details(), event.conversation_id] });
}

'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { agentConversationsApi } from '@/lib/api/agent-conversations';
import { landAgentChainChanged, landHeldMessagesAnswered } from './chain-events';

/**
 * Stop every agent of a chat (`POST …/agent-chain/stop`, idempotent). With
 * messages held, the turn answering them comes back and lands the way a pushed
 * `held_messages.answered` lands: the marks clear and the open chat follows
 * it. Without, the chain is read again. A refusal leaves a sentence to show.
 */
export function useStopChain(conversationId: string, heldIds: readonly number[]) {
  const queryClient = useQueryClient();
  const [stopping, setStopping] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const stop = async () => {
    if (stopping) return;
    setStopping(true);
    setProblem(null);
    try {
      const response = await agentConversationsApi.stopChain(conversationId);
      if (!response.success) throw new Error(response.message);
      const executionId = response.data.execution_id;
      if (executionId) landHeldMessagesAnswered(queryClient, { conversation_id: conversationId, message_ids: [...heldIds], execution_id: executionId });
      else landAgentChainChanged(queryClient, { conversation_id: conversationId });
    } catch {
      setProblem('The agents could not be stopped. Try again.');
    } finally {
      setStopping(false);
    }
  };
  return { stop, stopping, problem };
}

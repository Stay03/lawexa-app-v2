'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Hourglass, Loader2, Square } from 'lucide-react';

import { agentConversationsApi } from '@/lib/api/agent-conversations';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useV2Session } from '@/v2/runtime/session-context';
import { agentsWorkingWords } from './agent-chain';
import { landAgentChainChanged, landHeldMessagesAnswered } from './chain-events';
import { agentChainQueries } from './queries';

/**
 * AgentsWorkingSlot — while a chat's agents work (chain view, option C; Stay,
 * 25 November 2026, 03:43Z), a line over the message box says what Lawexa
 * waits for, with Stop. The box stays open: a message sent now is held and
 * answered with the report. It sits in the dock above the box, as the rating
 * and plan lines do, so the box never covers it (TEST DATA pictures, 25
 * November 2026: drawn at the foot of the chat, it was under the box).
 *
 * The chain is the one the chat screen reads (same query, read from the
 * cache here, never fetched by this line). Stop ends every agent's work
 * (`POST …/agent-chain/stop`). With messages held, the turn answering them
 * comes back and goes the way a pushed `held_messages.answered` goes: the
 * marks clear and the open chat follows it. Shown only to a reader who may
 * write, while no turn of the chat itself streams.
 */
export function AgentsWorkingSlot({ conversationId, isStreaming }: { conversationId: string; isStreaming: boolean }) {
  const { userId: viewerId } = useV2Session();
  const queryClient = useQueryClient();
  const { data: chain } = useQuery({ ...agentChainQueries.of({ conversationId, viewerId }), enabled: false });
  const [stopping, setStopping] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!chain?.chain_open || isStreaming) return null;
  const heldIds = chain.held_messages.map((held) => held.id);

  const stop = async () => {
    if (stopping) return;
    setStopping(true);
    setProblem(null);
    try {
      const response = await agentConversationsApi.stopChain(conversationId);
      if (!response.success) throw new Error(response.message);
      const executionId = response.data.execution_id;
      if (executionId) landHeldMessagesAnswered(queryClient, { conversation_id: conversationId, message_ids: heldIds, execution_id: executionId });
      else landAgentChainChanged(queryClient, { conversation_id: conversationId });
    } catch {
      setProblem('The agents could not be stopped. Try again.');
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="mb-2 flex justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      {/* The words wrap on a phone rather than lose the held count (TEST DATA pictures, 25 November 2026). */}
      <div className="flex max-w-full min-w-0 items-center gap-3 rounded-2xl border border-border bg-background py-1 pr-1 pl-3 text-xs shadow-sm">
        <p role="status" className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <Hourglass aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 text-pretty">{problem ?? agentsWorkingWords(chain)}</span>
        </p>
        <button
          type="button"
          onClick={() => void stop()}
          disabled={stopping}
          aria-label={stopping ? 'Stopping the agents' : 'Stop the agents'}
          className={cn(
            'v2-interactive inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-semibold text-foreground hover:bg-muted disabled:opacity-60',
            FOCUS_RING,
          )}
        >
          {stopping ? <Loader2 aria-hidden className="size-3 motion-safe:animate-spin" /> : <Square aria-hidden className="size-2.5 fill-current" />}
          Stop
        </button>
      </div>
    </div>
  );
}

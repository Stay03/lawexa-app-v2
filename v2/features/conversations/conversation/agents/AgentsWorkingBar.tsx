'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Hourglass, Loader2, Square } from 'lucide-react';

import { agentConversationsApi } from '@/lib/api/agent-conversations';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useV2ChatContext } from '../chat-context';
import { agentsWorkingWords } from './agent-chain';
import { useAgentChain } from './context';
import { agentChainQueries } from './queries';

/**
 * AgentsWorkingBar — while the chat's agents work (chain view, option C;
 * Stay, 25 November 2026, 03:43Z), a line at the foot of the chat says what
 * Lawexa waits for, with Stop. The composer stays open: a message sent now
 * is held and answered with the report.
 *
 * Stop ends every agent's work (`POST …/agent-chain/stop`). With messages
 * held, Lawexa answers them at once, and the chat follows that turn as it
 * streams; with none, the agents simply stop. Shown only to a reader who may
 * write in the chat, while no turn of the chat itself streams.
 */
export function AgentsWorkingBar() {
  const held = useAgentChain();
  const chat = useV2ChatContext();
  const queryClient = useQueryClient();
  const [stopping, setStopping] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const chain = held?.chain ?? null;
  if (!held || !chat || !chain?.chain_open || chat.isStreaming || !chat.canSend) return null;
  const { followResumedTurn } = chat;
  const words = agentsWorkingWords(chain);

  const stop = async () => {
    if (stopping) return;
    setStopping(true);
    setProblem(null);
    try {
      const response = await agentConversationsApi.stopChain(held.conversationId);
      if (!response.success) throw new Error(response.message);
      if (response.data.execution_id) followResumedTurn(response.data.execution_id);
      void queryClient.invalidateQueries({ queryKey: [...agentChainQueries.all(), held.conversationId] });
    } catch {
      setProblem('The agents could not be stopped. Try again.');
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="flex justify-center px-4 pb-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="flex max-w-full items-center gap-3 rounded-full border border-border bg-background/95 py-1 pr-1 pl-3 text-xs shadow-sm">
        <p role="status" className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <Hourglass aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{problem ?? words}</span>
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

'use client';

import { Bot, CircleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useSidePanel } from '../side-panel/SidePanelContext';
import { agentReplyText, type agentReplies } from './agent-model';

/**
 * AgentReplyRows — under Lawexa's return, one row per agent that answered
 * (sub-agents contract, section 4): the agent's name, the start of its reply,
 * and "Open full", which opens the whole agent conversation beside the chat.
 * An agent that could not reply says so; Lawexa's answer below says why.
 *
 * Never the person's bubble: the return's own text is written for Lawexa.
 * Lawexa answers from the replies right after, in its own turn.
 */
export function AgentReplyRows({ replies }: { replies: ReturnType<typeof agentReplies> }) {
  const panel = useSidePanel();
  return (
    <ul
      aria-label="Replies from other agents"
      className="mx-4 overflow-hidden rounded-2xl border border-border bg-card motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
    >
      {replies.map((reply) => (
        <li key={reply.agent_conversation_id} className="flex items-start gap-3 border-b border-border/60 px-3.5 py-3 last:border-b-0">
          <span
            aria-hidden
            className={cn(
              'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
              reply.failed ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
            )}
          >
            {reply.failed ? <CircleAlert className="size-4" /> : <Bot className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground">{reply.agent.name}</p>
            <p className={cn('mt-0.5 line-clamp-3 text-[13px] leading-relaxed break-words', reply.failed ? 'text-muted-foreground' : 'text-foreground/80')}>
              {agentReplyText(reply)}
            </p>
          </div>
          {panel ? (
            <button
              type="button"
              onClick={() => panel.open({ kind: 'agent', id: reply.agent_conversation_id })}
              aria-label={`Open the full conversation with ${reply.agent.name}`}
              className={cn(
                'v2-interactive mt-0.5 shrink-0 rounded text-[13px] font-semibold text-primary hover:underline',
                FOCUS_RING,
              )}
            >
              Open full
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

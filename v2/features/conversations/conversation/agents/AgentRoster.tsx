'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, CircleAlert, Hourglass, Loader2, Square } from 'lucide-react';

import { chatApi } from '@/lib/api/chat';
import { useAuthStore } from '@/lib/stores/authStore';
import { cn } from '@/lib/utils';
import type { AgentChainState } from '@/types/agent-chain';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { conversationsQueries } from '../../queries';
import { useSidePanel } from '../side-panel/SidePanelContext';
import { formatToolMessage } from '../tools/ToolStepItem';
import type { ChainNode } from './agent-chain';
import { agentInitials, liveWindowText } from './agent-roster';
import { useAgentRowsOf, type ChainParent } from './context';
import { agentChainQueries, agentConversationQueries } from './queries';
import { useAgentStream, type AgentLiveStep } from './use-agent-stream';

/**
 * AgentRoster — the agents a turn called, one row each, after that turn's
 * answer (C1, Stay, 12 November 2026; live agent list, Stay, 25 November
 * 2026, 03:43Z, thread 694678cf). No box around them: each row is the agent's
 * initials, its name, its state, and Stop on the right while it works. Two
 * agents at once are two rows. The agents an agent asked sit indented under
 * it: the law checker under the Issue Spotter. The chat itself is never a row.
 *
 * While an agent works, its lookups show as short lines ("Searched cases for
 * …") and its words stream under them in a short window, from the turn's own
 * stream (`GET /api/chat/stream/{execution_id}`). While it waits for an agent
 * it asked, its row says so ("Waiting for Law Checker"). Once it replied, the
 * start of the reply stays with "Read the reply"; stopped, or unable to
 * reply, the row says so with "Open its conversation".
 *
 * Stop ends the agent's turn (`POST /api/chat/stream/{execution_id}/cancel`):
 * the call settles as stopped and the agent that asked is woken. It shows only
 * while the agent works, and only to a reader the server lets stop it.
 *
 * The rows come from the chat's agent chain, which every reader of the chat
 * reads and the server pushes changes of (agents/context.tsx).
 */
export function AgentRoster({ messageId, parent }: { messageId: number | null; parent?: ChainParent }) {
  const held = useAgentRowsOf(messageId, parent);
  const chatId = held?.conversationId ?? null;
  const queryClient = useQueryClient();

  // A streamed turn ended (replied, stopped, or failed): the chain moves the row on, and the jobs move on too.
  const onTurnEnd = useCallback(() => {
    if (!chatId) return;
    void queryClient.invalidateQueries({ queryKey: [...agentChainQueries.all(), chatId] });
    void queryClient.invalidateQueries({ queryKey: [...agentConversationQueries.all(), chatId] });
    void queryClient.invalidateQueries({ queryKey: conversationsQueries.backgroundJobsOf(chatId) });
  }, [queryClient, chatId]);

  if (!held) return null;
  const askedBy = parent?.name ?? 'Lawexa';
  return (
    <ul aria-label={`Agents ${askedBy} asked`} className="flex flex-col gap-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      {held.rows.map((row) => (
        <AgentRosterRow key={row.conversationId} row={row} onTurnEnd={onTurnEnd} />
      ))}
    </ul>
  );
}

function AgentRosterRow({ row, onTurnEnd }: { row: ChainNode; onTurnEnd: () => void }) {
  const panel = useSidePanel();
  const open = panel ? () => panel.open({ kind: 'agent', id: row.conversationId }) : null;
  return (
    <li className="flex gap-3">
      <AgentFace initials={agentInitials(row.name)} state={row.state} />
      <div className="min-w-0 flex-1">
        <div className="flex min-h-8 items-center justify-between gap-3">
          {/* The state's words are read out as they change: a few times in a turn. */}
          <p aria-live="polite" className="flex min-w-0 items-center gap-2 text-sm">
            <span className="font-semibold text-foreground">{row.name}</span>
            <StateMark state={row.state} />
            <span className={cn('truncate text-xs', row.state === 'failed' ? 'text-destructive' : 'text-muted-foreground')}>
              {row.words}
            </span>
          </p>
          {row.canStop && row.executionId ? <StopPill name={row.name} executionId={row.executionId} /> : null}
        </div>
        {row.executionId ? <LiveWindow key={row.executionId} executionId={row.executionId} onEnd={onTurnEnd} /> : null}
        {row.state === 'replied' ? (
          <>
            {row.replyStart ? (
              <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed break-words text-foreground/85">{row.replyStart}</p>
            ) : null}
            {open ? (
              <button
                type="button"
                onClick={open}
                aria-label={`Read ${row.name}'s reply`}
                className={cn('v2-interactive mt-1 rounded-sm text-xs font-semibold text-primary hover:underline', FOCUS_RING)}
              >
                Read the reply
              </button>
            ) : null}
          </>
        ) : null}
        {(row.state === 'stopped' || row.state === 'failed') && open ? (
          <button
            type="button"
            onClick={open}
            aria-label={`Open the conversation with ${row.name}`}
            className={cn(
              'v2-interactive mt-0.5 rounded-sm text-xs font-semibold text-muted-foreground hover:text-foreground',
              FOCUS_RING,
            )}
          >
            Open its conversation
          </button>
        ) : null}
        {row.children.length > 0 ? (
          <ul aria-label={`Agents ${row.name} asked`} className="mt-3 flex flex-col gap-4 border-l border-border pl-4">
            {row.children.map((child) => (
              <AgentRosterRow key={child.conversationId} row={child} onTurnEnd={onTurnEnd} />
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/** The agent's initials in a disc: gold while it works, waits or replied, quiet once stopped, red when it could not reply. */
function AgentFace({ initials, state }: { initials: string; state: AgentChainState }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        state === 'failed'
          ? 'bg-destructive/15 text-destructive'
          : state === 'stopped'
            ? 'bg-muted text-muted-foreground'
            : 'bg-primary text-primary-foreground',
      )}
    >
      {initials}
      {state === 'running' ? (
        <span className="absolute -inset-1 rounded-full border-2 border-primary/50 motion-safe:animate-pulse" />
      ) : null}
    </span>
  );
}

function StateMark({ state }: { state: AgentChainState }) {
  switch (state) {
    case 'replied':
      return <Check aria-hidden className="size-3.5 shrink-0 text-primary" />;
    case 'failed':
      return <CircleAlert aria-hidden className="size-3.5 shrink-0 text-destructive" />;
    case 'running':
      return <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary motion-safe:animate-pulse" />;
    case 'waiting':
      return <Hourglass aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />;
    case 'stopped':
      return <Square aria-hidden className="size-3 shrink-0 fill-muted-foreground/60 text-muted-foreground/60" />;
  }
}

/**
 * Stop on the agent's row: ends its turn. The press is held until the turn's
 * stream ends and the row moves on, so it cannot be pressed twice.
 */
function StopPill({ name, executionId }: { name: string; executionId: string }) {
  const [stopping, setStopping] = useState<string | null>(null);
  const pending = stopping === executionId;
  const stop = () => {
    const token = useAuthStore.getState().token;
    if (!token || pending) return;
    setStopping(executionId);
    void chatApi.cancelStream(executionId, token);
  };
  return (
    <button
      type="button"
      onClick={stop}
      disabled={pending}
      aria-label={pending ? `Stopping ${name}` : `Stop ${name}`}
      className={cn(
        'v2-interactive inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60',
        FOCUS_RING,
      )}
    >
      {pending ? <Loader2 aria-hidden className="size-3 motion-safe:animate-spin" /> : <Square aria-hidden className="size-2.5 fill-current" />}
      Stop
    </button>
  );
}

/** Three lines of the newest words; the line height is the window's unit. */
const WINDOW_LINES = 3;
const LINE_EM = 1.625;
/** The newest lookups shown as lines while an agent works. */
const STEP_LINES = 3;

/**
 * What the agent does as it streams: its newest lookups as short lines (done
 * ones as "Searched …", the running one as "Searching …"), then its words in
 * a window three lines high, held to its foot so the newest words show, the
 * oldest fading at the top. A caret marks where the words grow; no dots.
 */
function LiveWindow({ executionId, onEnd }: { executionId: string; onEnd: () => void }) {
  const live = useAgentStream(executionId, onEnd);
  const text = live.text ? liveWindowText(live.text) : '';
  const steps = live.steps.slice(-STEP_LINES);
  return (
    <>
      {steps.length > 0 ? (
        <ul aria-label="Its lookups" className="mt-1 flex flex-col gap-0.5">
          {steps.map((step) => (
            <StepLine key={step.key} step={step} />
          ))}
        </ul>
      ) : null}
      {text ? <LiveWords text={text} /> : null}
    </>
  );
}

function StepLine({ step }: { step: AgentLiveStep }) {
  const words = formatToolMessage(step.name, step.parameters, step.done);
  return (
    <li className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      {step.done ? (
        <Check aria-hidden className="size-3 shrink-0" />
      ) : (
        <Loader2 aria-hidden className="size-3 shrink-0 motion-safe:animate-spin" />
      )}
      <span className="truncate">
        {words.action}
        {words.detail ? ` ${words.detail}` : ''}
      </span>
    </li>
  );
}

/**
 * The window itself. The top fades only once the words fill it: a first line
 * alone shows whole. Held to the foot by a column that ends at its bottom, so
 * the words that do not fit leave at the top.
 */
function LiveWords({ text }: { text: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const box = boxRef.current;
    const words = box?.firstElementChild;
    if (!box || !words) return;
    const observer = new ResizeObserver(() => setFull(words.scrollHeight > box.clientHeight + 1));
    observer.observe(words);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={boxRef}
      className="mt-1 flex flex-col justify-end overflow-hidden text-[14px] leading-relaxed break-words text-foreground/85"
      style={{
        maxHeight: `${WINDOW_LINES * LINE_EM}em`,
        maskImage: full ? `linear-gradient(to bottom, transparent, black ${LINE_EM}em)` : undefined,
      }}
    >
      <p>
        {text}
        <span aria-hidden className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-primary motion-safe:animate-pulse" />
      </p>
    </div>
  );
}

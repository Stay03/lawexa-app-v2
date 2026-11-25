'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, CircleAlert, Loader2, Square } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { chatApi } from '@/lib/api/chat';
import { useAuthStore } from '@/lib/stores/authStore';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { conversationsQueries } from '../../queries';
import { useV2ChatContext } from '../chat-context';
import { useSidePanel } from '../side-panel/SidePanelContext';
import { formatToolMessage } from '../tools/ToolStepItem';
import type { ChainNode } from './agent-chain';
import { cardStatus, deckLine, deckStartedAt, elapsedWords, foldLine, settled, type CardStatus, type CardTone, type StepWords } from './agent-deck';
import { agentInitials } from './agent-roster';
import { useAgentRowsOf, useChainHeld, type ChainParent } from './context';
import { agentChainQueries, agentConversationQueries } from './queries';
import { useAgentStream } from './use-agent-stream';
import { useStopChain } from './use-stop-chain';

/**
 * AgentRoster — the agent deck (Stay, 25 November 2026, 22:48Z, thread
 * 694678cf: round 9, version 1), under the turn that asked the agents, where
 * Lawexa's answer shows.
 *
 *  - Lawexa's own line on top while they work: the turn's orb, "5 agents at
 *    work", then "Waiting for 3 agents", a clock from the first call, and
 *    Stop, which ends every agent's work. The message box stays open below
 *    (option C), so Stop lives here and nothing sits above the box.
 *  - One card per agent Lawexa asked, in a column. Each helper's card slides
 *    out under its asker's, and a helper's helper under that. A card shows one
 *    short status line from the agent's own stream ("Searching cases · data
 *    breach", "Searched cases: 3 results", "Writing its reply"), never the
 *    agent's text. Done, it turns green with a few words of its reply, and its
 *    helpers tuck back to thin green edges.
 *  - Once every agent has finished, the deck folds to one line ("5 agents
 *    replied · Show"); Show opens it again.
 *  - A card opens a small popover (a tap, or the pointer resting on it): the
 *    agent and its helpers, how far each got, and "Open its conversation".
 *
 * The rows come from the chat's agent chain, which every reader of the chat
 * reads and the server pushes changes of (agents/context.tsx). In an agent's
 * own panel (`parent`), the deck lists the agents that agent asked, without
 * Lawexa's line.
 */
export function AgentRoster({ messageId, parent }: { messageId: number | null; parent?: ChainParent }) {
  const held = useAgentRowsOf(messageId, parent);
  const chatId = held?.conversationId ?? null;
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);

  // A streamed turn ended (replied, stopped, or failed): the chain moves the row on, and the jobs move on too.
  const onTurnEnd = useCallback(() => {
    if (!chatId) return;
    void queryClient.invalidateQueries({ queryKey: [...agentChainQueries.all(), chatId] });
    void queryClient.invalidateQueries({ queryKey: [...agentConversationQueries.all(), chatId] });
    void queryClient.invalidateQueries({ queryKey: conversationsQueries.backgroundJobsOf(chatId) });
  }, [queryClient, chatId]);

  if (!held || !chatId) return null;
  const rows = held.rows;
  const askedBy = parent?.name ?? 'Lawexa';
  const done = rows.every(settled);

  if (done && !opened) {
    return <FoldedDeck rows={rows} askedBy={askedBy} onShow={() => setOpened(true)} />;
  }
  return (
    <section aria-label={`Agents ${askedBy} asked`} className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      {done ? (
        <button
          type="button"
          onClick={() => setOpened(false)}
          className={cn('v2-interactive w-fit rounded-sm text-xs font-semibold text-muted-foreground hover:text-foreground', FOCUS_RING)}
        >
          Hide the agents
        </button>
      ) : parent ? null : (
        <LawexaLine rows={rows} conversationId={chatId} />
      )}
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <DeckCard key={row.conversationId} node={row} onTurnEnd={onTurnEnd} />
        ))}
      </ul>
    </section>
  );
}

/** Lookups in the card's words, from the transcript's own wording. */
const wordsOf: StepWords = (step) => formatToolMessage(step.name, step.parameters, step.done);

/** The clock on Lawexa's line: time since the first call, ticking only in its timer (never computed in render). */
function useElapsed(startedAt: number | null): string | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [startedAt]);
  return startedAt === null || now === null ? null : elapsedWords(now - startedAt);
}

/** Lawexa's own line over the deck while its agents work, with Stop for all of them. */
function LawexaLine({ rows, conversationId }: { rows: readonly ChainNode[]; conversationId: string }) {
  const { open, heldIds } = useChainHeld();
  const canSend = useV2ChatContext()?.canSend ?? false;
  const { stop, stopping, problem } = useStopChain(conversationId, heldIds);
  const elapsed = useElapsed(deckStartedAt(rows));
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
      <ThinkingOrb state="solving" size={20} className="shrink-0" aria-hidden />
      <span role="status" aria-live="polite" className="text-shimmer min-w-0 truncate font-medium">
        {problem ?? deckLine(rows, heldIds.length)}
      </span>
      {elapsed ? <span className="shrink-0 text-xs text-muted-foreground/70 tabular-nums">· {elapsed}</span> : null}
      {open && canSend ? (
        <button
          type="button"
          onClick={() => void stop()}
          disabled={stopping}
          aria-label={stopping ? 'Stopping the agents' : 'Stop the agents'}
          className={cn(
            'v2-interactive ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60',
            FOCUS_RING,
          )}
        >
          {stopping ? <Loader2 aria-hidden className="size-3 motion-safe:animate-spin" /> : <Square aria-hidden className="size-2.5 fill-current" />}
          Stop
        </button>
      ) : null}
    </div>
  );
}

/** All finished: one green line with every face, the count, and Show. */
function FoldedDeck({ rows, askedBy, onShow }: { rows: readonly ChainNode[]; askedBy: string; onShow: () => void }) {
  const allReplied = rows.every((row) => row.state === 'replied');
  return (
    <button
      type="button"
      onClick={onShow}
      aria-label={`${foldLine(rows)}. Show the agents ${askedBy} asked`}
      className={cn(
        'v2-interactive inline-flex w-fit max-w-full items-center gap-2.5 rounded-full py-1 pr-3.5 pl-1 text-[13px] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
        allReplied
          ? 'bg-emerald-500/10 ring-1 ring-emerald-600/20 dark:bg-emerald-400/10 dark:ring-emerald-400/25'
          : 'bg-muted ring-1 ring-border',
        FOCUS_RING,
      )}
    >
      <span aria-hidden className="flex">
        {rows.map((row, index) => (
          <span key={row.conversationId} style={{ zIndex: rows.length - index }} className={cn(index > 0 && '-ml-1.5')}>
            <Face initials={agentInitials(row.name)} tone={row.state === 'replied' ? 'done' : 'quiet'} size="s" ring />
          </span>
        ))}
      </span>
      <span className="truncate font-semibold text-foreground">{foldLine(rows)}</span>
      <span className={cn('shrink-0 text-xs font-semibold', allReplied ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>Show</span>
    </button>
  );
}

/**
 * One agent's card, with its helpers' cards slid out under it. The line comes
 * from the agent's stream while it runs; a tap, or the pointer resting on the
 * card, opens its popover.
 */
function DeckCard({ node, onTurnEnd }: { node: ChainNode; onTurnEnd: () => void }) {
  return (
    <li className="flex flex-col">
      <AgentPopover node={node} onTurnEnd={onTurnEnd}>
        <StatusOf node={node} onTurnEnd={onTurnEnd}>
          {(status) => <CardFace node={node} status={status} />}
        </StatusOf>
      </AgentPopover>
      {node.children.length > 0 ? <Helpers nodes={node.children} level={1} parentDone={settled(node)} onTurnEnd={onTurnEnd} /> : null}
    </li>
  );
}

/** A card's status: from the agent's own stream while it runs, else from its state. */
function StatusOf({ node, onTurnEnd, children }: { node: ChainNode; onTurnEnd: () => void; children: (status: CardStatus) => React.ReactNode }) {
  if (node.executionId && node.state === 'running') {
    return (
      <LiveStatus key={node.executionId} node={node} executionId={node.executionId} onTurnEnd={onTurnEnd}>
        {children}
      </LiveStatus>
    );
  }
  return <>{children(cardStatus(node, null, wordsOf))}</>;
}

function LiveStatus({
  node,
  executionId,
  onTurnEnd,
  children,
}: {
  node: ChainNode;
  executionId: string;
  onTurnEnd: () => void;
  children: (status: CardStatus) => React.ReactNode;
}) {
  const live = useAgentStream(executionId, onTurnEnd);
  return <>{children(cardStatus(node, { steps: live.steps, writing: live.text.length > 0 }, wordsOf))}</>;
}

const TONE_TEXT: Record<CardTone, string> = {
  working: 'text-primary',
  waiting: 'text-muted-foreground',
  done: 'text-emerald-700 dark:text-emerald-400',
  quiet: 'text-muted-foreground',
  failed: 'text-destructive',
};

function CardFace({ node, status }: { node: ChainNode; status: CardStatus }) {
  return (
    <div
      className={cn(
        'relative z-[3] flex min-w-0 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-colors duration-300',
        status.tone === 'done'
          ? 'bg-emerald-50 ring-1 ring-emerald-600/20 dark:bg-emerald-950 dark:ring-emerald-400/25'
          : status.tone === 'working'
            ? 'bg-background shadow-[0_10px_24px_-18px_rgba(196,149,54,0.55)] ring-1 ring-primary/25'
            : 'bg-background ring-1 ring-border',
      )}
    >
      <Face initials={agentInitials(node.name)} tone={status.tone} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[13.5px] font-semibold text-foreground">{node.name}</span>
        <StatusText status={status} />
      </span>
    </div>
  );
}

/** The one line; a new line fades in over the old, so a change reads as a change. */
function StatusText({ status, small = false }: { status: CardStatus; small?: boolean }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-1.5', small ? 'text-xs' : 'text-[12.5px]', TONE_TEXT[status.tone])}>
      {status.tone === 'working' ? <Loader2 aria-hidden className="size-3 shrink-0 motion-safe:animate-spin" /> : null}
      {status.tone === 'failed' ? <CircleAlert aria-hidden className="size-3 shrink-0" /> : null}
      <span key={status.words} className="truncate motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        {status.words}
      </span>
    </span>
  );
}

/**
 * The helpers' cards under their asker's, each a step narrower: out with its
 * own line while it works or waits, tucked back to a thin edge with its name
 * once it, or its asker, is done.
 */
function Helpers({ nodes, level, parentDone, onTurnEnd }: { nodes: readonly ChainNode[]; level: number; parentDone: boolean; onTurnEnd: () => void }) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.conversationId} className="flex flex-col">
          <AgentPopover node={node} onTurnEnd={onTurnEnd}>
            <StatusOf node={node} onTurnEnd={onTurnEnd}>
              {(status) => <HelperSlip node={node} status={status} level={level} tucked={parentDone || settled(node)} />}
            </StatusOf>
          </AgentPopover>
          {node.children.length > 0 ? (
            <Helpers nodes={node.children} level={level + 1} parentDone={parentDone || settled(node)} onTurnEnd={onTurnEnd} />
          ) : null}
        </div>
      ))}
    </>
  );
}

function HelperSlip({ node, status, level, tucked }: { node: ChainNode; status: CardStatus; level: number; tucked: boolean }) {
  const inset = { marginLeft: `${level * 10}px`, marginRight: `${level * 10}px`, zIndex: 3 - level };
  if (tucked) {
    return (
      <div
        style={inset}
        className={cn(
          'relative -mt-2.5 flex h-7 items-end justify-end rounded-b-xl px-3 pb-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
          status.tone === 'done' ? 'bg-emerald-50 ring-1 ring-emerald-600/20 dark:bg-emerald-950' : 'bg-muted ring-1 ring-border',
        )}
      >
        <span className={cn('flex items-center gap-1 text-[10px] font-semibold', TONE_TEXT[status.tone === 'done' ? 'done' : 'quiet'])}>
          <Face initials={agentInitials(node.name)} tone={status.tone} size="xs" />
          {node.name}
        </span>
      </div>
    );
  }
  return (
    <div
      style={inset}
      className={cn(
        'relative -mt-3 flex min-w-0 items-center gap-2 rounded-b-xl px-3 pt-[18px] pb-2 motion-safe:animate-in motion-safe:slide-in-from-top-3 motion-safe:fade-in motion-safe:duration-300',
        status.tone === 'working' ? 'bg-amber-50 ring-1 ring-primary/25 dark:bg-amber-950/40' : 'bg-muted ring-1 ring-border',
      )}
    >
      <Face initials={agentInitials(node.name)} tone={status.tone} size="xs" />
      <span className="shrink-0 text-xs font-semibold text-foreground">{node.name}</span>
      <StatusText status={status} small />
    </div>
  );
}

function Face({ initials, tone, size = 'm', ring = false }: { initials: string; tone: CardTone; size?: 'm' | 's' | 'xs'; ring?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full font-semibold',
        size === 'm' ? 'size-8 text-[11px]' : size === 's' ? 'size-5 text-[7.5px]' : 'size-4 text-[6.5px]',
        tone === 'done'
          ? 'bg-emerald-600 text-white dark:bg-emerald-500'
          : tone === 'failed'
            ? 'bg-destructive/15 text-destructive'
            : tone === 'working'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
        ring && 'ring-2 ring-background',
      )}
    >
      {initials}
      {tone === 'done' && size === 'm' ? (
        <span className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-background ring-1 ring-emerald-600/25">
          <Check className="size-2.5 text-emerald-700 dark:text-emerald-400" />
        </span>
      ) : null}
    </span>
  );
}

/** How long the pointer rests on a card before its popover opens, and how long it may leave before it closes. */
const HOVER_OPEN_MS = 350;
const HOVER_CLOSE_MS = 200;

/**
 * A card's popover: the agent and its helpers, each with its line, its reply's
 * start once it replied, Stop while it works (for a reader the server lets
 * stop it), and "Open its conversation". A tap opens it anywhere; on a
 * computer the pointer resting on the card opens it too.
 */
function AgentPopover({ node, onTurnEnd, children }: { node: ChainNode; onTurnEnd: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panel = useSidePanel();
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const hover = (event: React.PointerEvent, next: boolean) => {
    if (event.pointerType !== 'mouse') return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), next ? HOVER_OPEN_MS : HOVER_CLOSE_MS);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          onPointerEnter={(event) => hover(event, true)}
          onPointerLeave={(event) => hover(event, false)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${node.name}: what it is doing`}
          className={cn('v2-interactive block w-full min-w-0 rounded-2xl text-left', FOCUS_RING)}
        >
          {children}
        </button>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={6}
        onPointerEnter={(event) => hover(event, true)}
        onPointerLeave={(event) => hover(event, false)}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-80 max-w-[calc(100vw-2rem)] p-3"
      >
        <ul className="flex flex-col gap-2">
          <PopoverRow node={node} level={0} onTurnEnd={onTurnEnd} />
        </ul>
        {panel ? (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              panel.open({ kind: 'agent', id: node.conversationId });
            }}
            className={cn('v2-interactive mt-3 rounded-sm text-xs font-semibold text-primary hover:underline', FOCUS_RING)}
          >
            Open its conversation
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function PopoverRow({ node, level, onTurnEnd }: { node: ChainNode; level: number; onTurnEnd: () => void }) {
  return (
    <>
      <li style={{ paddingLeft: `${level * 14}px` }} className="flex min-w-0 flex-col gap-0.5">
        <StatusOf node={node} onTurnEnd={onTurnEnd}>
          {(status) => (
            <span className="flex min-w-0 items-center gap-2">
              <Face initials={agentInitials(node.name)} tone={status.tone} size="s" />
              <span className="shrink-0 text-[13px] font-semibold text-foreground">{node.name}</span>
              <StatusText status={status} small />
              {node.canStop && node.executionId ? <StopAgent name={node.name} executionId={node.executionId} /> : null}
            </span>
          )}
        </StatusOf>
        {node.state === 'replied' && node.replyStart ? (
          <p className="line-clamp-2 pl-7 text-xs leading-relaxed text-muted-foreground">{node.replyStart}</p>
        ) : null}
      </li>
      {node.children.map((child) => (
        <PopoverRow key={child.conversationId} node={child} level={level + 1} onTurnEnd={onTurnEnd} />
      ))}
    </>
  );
}

/**
 * Stop one agent (`POST /api/chat/stream/{execution_id}/cancel`): the call
 * settles as stopped and its asker is woken. Held until the row moves on, so
 * it cannot be pressed twice.
 */
function StopAgent({ name, executionId }: { name: string; executionId: string }) {
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
        'v2-interactive ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-60',
        FOCUS_RING,
      )}
    >
      {pending ? <Loader2 aria-hidden className="size-2.5 motion-safe:animate-spin" /> : <Square aria-hidden className="size-2 fill-current" />}
      Stop
    </button>
  );
}

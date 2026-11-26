'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, CircleAlert, Loader2, Square } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  const { open: chainOpen, newestCaller } = useChainHeld();
  // After Show or Hide, the control that replaced the pressed one takes the focus (it unmounts the pressed one).
  const focusNext = useRef(false);
  const showRef = useRef<HTMLButtonElement>(null);
  const hideRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    (opened ? hideRef : showRef).current?.focus();
  }, [opened]);

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
  // Lawexa's line, with the chain's Stop and queued count, sits on the chat's newest deck for as long as the chain
  // is open, even once the agents it asked have finished (a helper further down may still work), and on no other
  // deck (review of 60ef98b8). A deck with that line never folds.
  const lineShown = !parent && chainOpen && messageId !== null && messageId === newestCaller;
  const toggle = (next: boolean) => {
    focusNext.current = true;
    setOpened(next);
  };

  if (done && !lineShown && !opened) {
    return <FoldedDeck ref={showRef} rows={rows} askedBy={askedBy} onShow={() => toggle(true)} />;
  }
  return (
    <section aria-label={`Agents ${askedBy} asked`} className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      {lineShown ? (
        <LawexaLine rows={rows} conversationId={chatId} />
      ) : done ? (
        <button
          ref={hideRef}
          type="button"
          onClick={() => toggle(false)}
          className={cn('v2-interactive w-fit rounded-sm text-xs font-semibold text-muted-foreground hover:text-foreground', FOCUS_RING)}
        >
          Hide the agents
        </button>
      ) : null}
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
  const { heldIds } = useChainHeld();
  const canSend = useV2ChatContext()?.canSend ?? false;
  const { stop, stopping, problem } = useStopChain(conversationId, heldIds);
  const elapsed = useElapsed(deckStartedAt(rows));
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
      <ThinkingOrb state="solving" size={20} className="shrink-0" aria-hidden />
      {/* Wraps on a phone rather than lose the queued count (fixture pictures, 26 November 2026). */}
      <span role="status" aria-live="polite" className="text-shimmer min-w-0 font-medium text-pretty">
        {problem ?? deckLine(rows, heldIds.length)}
      </span>
      {elapsed ? <span className="shrink-0 text-xs text-muted-foreground/70 tabular-nums">· {elapsed}</span> : null}
      {canSend ? (
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

/*
 * THE LOOK (Stay, 26 November 2026: "too vibe coded"): the chat's own plain
 * surfaces. A card is the draft card's (`rounded-2xl border bg-card`), a face
 * is the step marker's neutral disc, names and lines use the tool rows' type,
 * and a helper is a row in its asker's card under a left rule, as a lookup sits
 * under its step. Colour is kept for state only, in one small mark: working,
 * done, failed (StateMark).
 */

/** All finished: one plain line with every face, the count, and Show. */
function FoldedDeck({
  rows,
  askedBy,
  onShow,
  ref,
}: {
  rows: readonly ChainNode[];
  askedBy: string;
  onShow: () => void;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  const allReplied = rows.every((row) => row.state === 'replied');
  return (
    <button
      ref={ref}
      type="button"
      onClick={onShow}
      aria-label={`${foldLine(rows)}. Show the agents ${askedBy} asked`}
      className={cn(
        'v2-interactive inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-[13px] transition-colors hover:bg-secondary/50 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
        FOCUS_RING,
      )}
    >
      <span aria-hidden className="flex">
        {rows.map((row, index) => (
          <span key={row.conversationId} style={{ zIndex: rows.length - index }} className={cn(index > 0 && '-ml-1.5')}>
            <Face initials={agentInitials(row.name)} size="s" ring />
          </span>
        ))}
      </span>
      {allReplied ? <StateMark tone="done" /> : null}
      <span className="truncate font-medium text-foreground">{foldLine(rows)}</span>
      <span className="shrink-0 text-xs text-muted-foreground">Show</span>
    </button>
  );
}

/**
 * One agent's card: its own row, and its helpers' rows under it. The line
 * comes from the agent's stream while it runs; a tap, or the pointer resting on
 * a row, opens that agent's popover.
 */
function DeckCard({ node, onTurnEnd }: { node: ChainNode; onTurnEnd: () => void }) {
  return (
    <li className="flex flex-col rounded-2xl border border-border bg-card motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <AgentPopover node={node} onTurnEnd={onTurnEnd}>
        <StatusOf node={node} onTurnEnd={onTurnEnd}>
          {(status) => <CardFace node={node} status={status} />}
        </StatusOf>
      </AgentPopover>
      {node.children.length > 0 ? <Helpers nodes={node.children} onTurnEnd={onTurnEnd} /> : null}
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

/** The line's words: muted, as the tool rows' detail; a failure in the destructive colour, as a failed step. */
const TONE_TEXT: Record<CardTone, string> = {
  working: 'text-muted-foreground',
  waiting: 'text-muted-foreground',
  done: 'text-muted-foreground',
  quiet: 'text-muted-foreground',
  failed: 'text-destructive',
};

function CardFace({ node, status }: { node: ChainNode; status: CardStatus }) {
  // Spans, not divs: the face sits inside the card's button.
  return (
    <span className="flex min-w-0 items-center gap-3 px-3.5 py-3 text-left">
      <Face initials={agentInitials(node.name)} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">{node.name}</span>
        <StatusText status={status} />
      </span>
    </span>
  );
}

/** The one state mark, the only colour in the deck: working, done, failed. Waiting and the rest carry none. */
function StateMark({ tone }: { tone: CardTone }) {
  if (tone === 'working') return <Loader2 aria-hidden className="size-3 shrink-0 text-primary motion-safe:animate-spin" />;
  if (tone === 'done') return <Check aria-hidden strokeWidth={2.5} className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />;
  if (tone === 'failed') return <CircleAlert aria-hidden className="size-3 shrink-0 text-destructive" />;
  return null;
}

/** The one line; a new line fades in over the old, so a change reads as a change. */
function StatusText({ status, small = false }: { status: CardStatus; small?: boolean }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-1.5', small ? 'text-xs' : 'text-[13px]', TONE_TEXT[status.tone])}>
      <StateMark tone={status.tone} />
      <span key={status.words} className="truncate motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        {status.words}
      </span>
    </span>
  );
}

/**
 * The helpers an agent asked, as rows in its card under a left rule (the way a
 * lookup sits under its step), a helper's helper one rule further in. Each row
 * has its own line and opens its own popover.
 */
function Helpers({ nodes, onTurnEnd }: { nodes: readonly ChainNode[]; onTurnEnd: () => void }) {
  return (
    <ul aria-label="Helpers" className="mb-2.5 ml-[29px] mr-3 flex flex-col gap-0.5 border-l border-border pl-3">
      {nodes.map((node) => (
        <li key={node.conversationId} className="flex flex-col">
          <AgentPopover node={node} onTurnEnd={onTurnEnd}>
            <StatusOf node={node} onTurnEnd={onTurnEnd}>
              {(status) => <HelperRow node={node} status={status} />}
            </StatusOf>
          </AgentPopover>
          {node.children.length > 0 ? <Helpers nodes={node.children} onTurnEnd={onTurnEnd} /> : null}
        </li>
      ))}
    </ul>
  );
}

function HelperRow({ node, status }: { node: ChainNode; status: CardStatus }) {
  return (
    <span className="flex min-w-0 items-center gap-2 px-1.5 py-1.5">
      <Face initials={agentInitials(node.name)} size="xs" />
      <span className="shrink-0 text-[13px] font-medium text-foreground">{node.name}</span>
      <StatusText status={status} small />
    </span>
  );
}

/** An agent's initials on the step marker's neutral disc; its state is the line's mark, never the face's colour. */
function Face({ initials, size = 'm', ring = false }: { initials: string; size?: 'm' | 's' | 'xs'; ring?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-muted-foreground',
        size === 'm' ? 'size-8 text-[11px]' : size === 's' ? 'size-5 text-[7.5px]' : 'size-5 text-[7.5px]',
        ring && 'ring-2 ring-card',
      )}
    >
      {initials}
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
  // Focus moves into the popover only when a keyboard opened it; a pointer (a hover above all) must never pull
  // the focus out of the message box.
  const byKeyboard = useRef(false);
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
  // Opens only for a pointer that moves onto the card: a card drawn under a resting pointer (Show pressed, the
  // deck opening under it) is not a hover (fixture pictures, 26 November 2026).
  const moved = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse' || (event.movementX === 0 && event.movementY === 0)) return;
    // Back on the card from its open popover: keep it open (clear the close the leave started).
    if (open) {
      if (timer.current) clearTimeout(timer.current);
      return;
    }
    hover(event, true);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* The trigger: a tap opens and closes it, Enter or Space opens it with the focus inside (so a keyboard
          reaches Stop and Open its conversation), and its name is what it shows: the agent and its line. */}
      <PopoverTrigger asChild>
        <button
          type="button"
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') byKeyboard.current = true;
          }}
          onPointerDown={() => {
            byKeyboard.current = false;
          }}
          onPointerMove={moved}
          onPointerLeave={(event) => hover(event, false)}
          className={cn('v2-interactive block w-full min-w-0 rounded-xl text-left transition-colors hover:bg-secondary/50', FOCUS_RING)}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        onPointerEnter={(event) => hover(event, true)}
        onPointerLeave={(event) => hover(event, false)}
        onOpenAutoFocus={(event) => {
          if (!byKeyboard.current) event.preventDefault();
          byKeyboard.current = false;
        }}
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
              <Face initials={agentInitials(node.name)} size="s" />
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

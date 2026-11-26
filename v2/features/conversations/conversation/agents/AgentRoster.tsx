'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Loader2, Square } from 'lucide-react';
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
import './deck.css';

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

  const rows = held?.rows ?? NO_ROWS;
  const askedBy = parent?.name ?? 'Lawexa';
  const done = rows.length > 0 && rows.every(settled);
  // Lawexa's line, with the chain's Stop and queued count, sits on the chat's newest deck for as long as the chain
  // is open, even once the agents it asked have finished (a helper further down may still work), and on no other
  // deck (review of 60ef98b8). A deck with that line never folds.
  const lineShown = !parent && chainOpen && messageId !== null && messageId === newestCaller;
  const wantFolded = done && !lineShown && !opened;
  // Which agents, in which states, the fold has landed for: a deck already done when drawn starts folded; one that
  // finishes on screen plays the fold first (deck.css), and a new set of agents folds again when it finishes.
  const foldKey = rows.map((row) => `${row.conversationId}:${row.state}`).join('|');
  const [landed, setLanded] = useState<string | null>(() => (wantFolded ? foldKey : null));
  const toggle = (next: boolean) => {
    focusNext.current = true;
    // Hide plays the same fold as finishing does.
    if (!next) setLanded(null);
    setOpened(next);
  };

  if (!held || !chatId) return null;
  if (wantFolded && landed === foldKey) {
    return <FoldedDeck ref={showRef} rows={rows} askedBy={askedBy} onShow={() => toggle(true)} />;
  }
  const folding = wantFolded;
  return (
    <section aria-label={`Agents ${askedBy} asked`} className="v2-deck flex flex-col gap-3">
      {lineShown ? (
        <LawexaLine rows={rows} conversationId={chatId} />
      ) : done && opened ? (
        // Only on a deck the reader opened: a deck folding by itself shows no Hide (it would flash for the fold).
        <button
          ref={hideRef}
          type="button"
          onClick={() => toggle(false)}
          className={cn('v2-interactive w-fit rounded-sm text-xs font-semibold text-muted-foreground hover:text-foreground', FOCUS_RING)}
        >
          Hide the agents
        </button>
      ) : folding && !parent ? (
        // Lawexa's line has gone with the last reply: its room closes with the fold, so the deck does not jump up.
        <span aria-hidden className="v2-deck-line-gone" />
      ) : null}
      {/* The deck's room closes as it folds and opens as it unfolds (deck.css), so nothing around it jumps. */}
      <div className={cn('v2-deck-body', folding && 'is-folding', opened && !folding && 'is-unfolding')}>
        <ul
          className={cn('v2-deck-stack', folding && 'is-folding', opened && !folding && 'is-unfolding')}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget && event.animationName === 'v2-deck-fold-away') setLanded(foldKey);
          }}
        >
          {rows.map((row, index) => (
            <DeckCard key={row.conversationId} node={row} index={index} onTurnEnd={onTurnEnd} />
          ))}
        </ul>
      </div>
    </section>
  );
}

const NO_ROWS: readonly ChainNode[] = [];

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

/** All finished: one green line with every face, the count, and Show (the mock's folded line). */
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
    <div className="v2-deck">
      <button
        ref={ref}
        type="button"
        onClick={onShow}
        aria-label={`${foldLine(rows)}. Show the agents ${askedBy} asked`}
        className={cn('v2-interactive v2-deck-fold is-arriving', !allReplied && 'is-mixed', FOCUS_RING)}
      >
        <span aria-hidden className="v2-deck-faces">
          {rows.map((row, index) => (
            <span key={row.conversationId} style={{ zIndex: rows.length - index }} className="flex">
              <Face initials={agentInitials(row.name)} tone={row.state === 'replied' ? 'done' : 'quiet'} size="s" />
            </span>
          ))}
        </span>
        <span className="truncate font-semibold">{foldLine(rows)}</span>
        <span className="v2-deck-fold-more">Show</span>
      </button>
    </div>
  );
}

/**
 * One agent's card, with its helpers' cards slid out under it. The line comes
 * from the agent's stream while it runs; a tap, or the pointer resting on the
 * card, opens its popover.
 */
function DeckCard({ node, index, onTurnEnd }: { node: ChainNode; index: number; onTurnEnd: () => void }) {
  return (
    <li className="flex flex-col" style={{ ['--i' as string]: index }}>
      <AgentPopover node={node} onTurnEnd={onTurnEnd}>
        <StatusOf node={node} onTurnEnd={onTurnEnd}>
          {(status) => <CardFace node={node} status={status} />}
        </StatusOf>
      </AgentPopover>
      {node.children.length > 0 ? <Helpers nodes={node.children} level={1} parentDone={settled(node)} onTurnEnd={onTurnEnd} /> : null}
    </li>
  );
}

/** A card's status, and its reply's words so far (empty unless it streams them now). */
type StatusChildren = (status: CardStatus, writing: string) => React.ReactNode;

/**
 * A card's status: from the agent's own stream while it runs, else from its state. One component whatever the
 * state, so the card under it stays the same element as its agent starts, waits and replies (a new element would
 * slide out again instead of moving; frame samples, 26 November 2026).
 */
function StatusOf({ node, onTurnEnd, children }: { node: ChainNode; onTurnEnd: () => void; children: StatusChildren }) {
  const running = node.executionId && node.state === 'running' ? node.executionId : null;
  const live = useAgentStream(running, onTurnEnd);
  const status = cardStatus(node, running ? { steps: live.steps, writing: live.text.length > 0 } : null, wordsOf);
  return <>{children(status, running ? live.text : '')}</>;
}

/** The card's ring as the mock draws it: gold at work, green done, plain otherwise. */
const CARD_TONE: Record<CardTone, string> = {
  working: 'is-working',
  waiting: '',
  done: 'is-done',
  quiet: '',
  failed: '',
};

function CardFace({ node, status }: { node: ChainNode; status: CardStatus }) {
  // Spans, not divs: the face sits inside the card's button.
  return (
    <span className={cn('v2-deck-card', CARD_TONE[status.tone])}>
      <Face initials={agentInitials(node.name)} tone={status.tone} />
      <span className="v2-deck-meta">
        <span className="v2-deck-name">{node.name}</span>
        <StatusText status={status} />
      </span>
    </span>
  );
}

/** The step's colour: gold at work, green done, muted waiting, red failed. */
const STEP_TONE: Record<CardTone, string> = {
  working: '',
  waiting: 'is-muted',
  done: 'is-done',
  quiet: 'is-muted',
  failed: 'is-failed',
};

/** The one line; a new line fades in over the old, so a change reads as a change. */
function StatusText({ status }: { status: CardStatus }) {
  return (
    <span className={cn('v2-deck-step', STEP_TONE[status.tone])}>
      {status.tone === 'working' ? <span aria-hidden className="v2-deck-spin" /> : null}
      {status.tone === 'failed' ? <CircleAlert aria-hidden className="size-3 shrink-0" /> : null}
      <span key={status.words} className="v2-deck-fade">
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

/** A helper's card: one element from the slide out to the tuck, so the change is a motion, not a swap. */
function HelperSlip({ node, status, level, tucked }: { node: ChainNode; status: CardStatus; level: number; tucked: boolean }) {
  const failed = status.tone === 'failed';
  return (
    <span
      className={cn(
        'v2-deck-slip is-arriving',
        level === 2 && 'is-l2',
        level >= 3 && 'is-l3',
        tucked ? 'is-tucked' : status.tone !== 'working' && 'is-waiting',
        failed && 'is-failed',
      )}
    >
      {tucked ? (
        <span key="peek" className="v2-deck-peek v2-deck-fade">
          <Face initials={agentInitials(node.name)} tone={failed ? 'failed' : 'done'} size="xs" />
          {node.name}
          {/* A tucked helper that could not reply says so, not only in colour. */}
          {failed ? <span className="font-normal">· {status.words}</span> : null}
        </span>
      ) : (
        <>
          <Face initials={agentInitials(node.name)} tone={status.tone} size="s" />
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="v2-deck-name shrink-0">{node.name}</span>
            {/* A helper waiting on its own helper says so in the mock's words; the helper's slip is right under it. */}
            <StatusText status={waitingOnHelper(status)} />
          </span>
        </>
      )}
    </span>
  );
}

/** An agent waiting on its own helper, in the mock's words (a slip and the popover; the card names the helper). */
function waitingOnHelper(status: CardStatus): CardStatus {
  return status.tone === 'waiting' ? { ...status, words: 'waiting on its helper' } : status;
}

/** The end of an agent's reply so far, from a word's start: the popover's live line. */
function writingTail(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= LIVE_TAIL) return flat;
  const cut = flat.slice(-LIVE_TAIL);
  const space = cut.indexOf(' ');
  return `…${space >= 0 ? cut.slice(space + 1) : cut}`;
}

const LIVE_TAIL = 120;

/** The face as the mock draws it: gold at work, grey waiting or still, green done. */
const FACE_TONE: Record<CardTone, string> = {
  working: '',
  waiting: 'is-idle',
  done: 'is-done',
  quiet: 'is-idle',
  failed: 'is-failed',
};

function Face({ initials, tone, size = 'm' }: { initials: string; tone: CardTone; size?: 'm' | 's' | 'xs' }) {
  return (
    <span aria-hidden className={cn('v2-deck-face', FACE_TONE[tone], size === 's' && 'is-s', size === 'xs' && 'is-xs')}>
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
          className={cn('v2-interactive block w-full min-w-0 rounded-2xl text-left', FOCUS_RING)}
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
        // The mock's popover: 330px on a computer, the card's width on a phone, a hairline ring and a long soft shadow.
        className="v2-deck w-[330px] max-w-[calc(100vw-2rem)] items-start gap-[9px] rounded-[14px] bg-(--deck-card) px-3.5 py-3 text-[12.5px] leading-normal text-(--deck-fg) shadow-[0_0_0_1px_var(--deck-line),0_18px_40px_-18px_var(--deck-shadow)] ring-0 max-sm:w-(--radix-popover-trigger-width)"
      >
        <ul className="flex w-full min-w-0 flex-col gap-[9px]">
          <PopoverRow node={node} level={0} onTurnEnd={onTurnEnd} />
        </ul>
        {panel ? (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              panel.open({ kind: 'agent', id: node.conversationId });
            }}
            className={cn('v2-interactive rounded-sm text-[12.5px] leading-none font-semibold text-(--deck-gold) hover:underline', FOCUS_RING)}
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
      <li style={{ paddingLeft: `${level * 14}px` }} className="flex min-w-0 flex-col gap-[9px]">
        <StatusOf node={node} onTurnEnd={onTurnEnd}>
          {(status, writing) => (
            <>
              <span className="flex min-w-0 items-center gap-2">
                <Face initials={agentInitials(node.name)} tone={status.tone} size="s" />
                <span className={cn('v2-deck-name shrink-0', level > 0 && 'is-s')}>{node.name}</span>
                <StatusText status={waitingOnHelper(status)} />
                {node.canStop && node.executionId ? <StopAgent name={node.name} executionId={node.executionId} /> : null}
              </span>
              {/* Its reply's words as they come (the mock's live line, with its caret). */}
              {writing ? (
                <p className="v2-deck-live">
                  {writingTail(writing)}
                  <span aria-hidden className="v2-deck-caret" />
                </p>
              ) : null}
            </>
          )}
        </StatusOf>
        {node.state === 'replied' && node.replyStart ? (
          <p className="v2-deck-live is-reply line-clamp-2">{node.replyStart}</p>
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
      title={`Stop ${name}`}
      className={cn(
        'v2-interactive ml-auto inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-(--deck-line) text-(--deck-fg) hover:bg-(--deck-paper) disabled:opacity-60',
        FOCUS_RING,
      )}
    >
      {pending ? <Loader2 aria-hidden className="size-2.5 motion-safe:animate-spin" /> : <Square aria-hidden className="size-2 fill-current" />}
    </button>
  );
}

'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { CLOSED, AuthedEventSource } from '@/lib/stream/authed-event-source';
import { useAuthStore } from '@/lib/stores/authStore';
import type { TextDeltaEvent, TextResetEvent, ToolCallingEvent, ToolCompleteEvent } from '@/types/chat';
import { createLiveSeqFilter } from '@/v2/runtime/chat-engine/live-seq';
import { stepsOnCalling, stepsOnComplete, type AgentLiveStep } from './agent-live-steps';

export type { AgentLiveStep } from './agent-live-steps';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** The events that end a turn's stream (docs/streaming/frontend-streaming-guide.md). */
const TERMINAL_EVENTS = ['completed', 'error', 'cancelled', 'timeout', 'end'] as const;

export interface AgentLiveTurn {
  /** The answer as it streams, for the turn's current iteration. */
  text: string;
  /** Every lookup of the turn so far, oldest first, each marked done when it ends. */
  steps: AgentLiveStep[];
}

const EMPTY: AgentLiveTurn = { text: '', steps: [] };

function parse<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * One open turn's stream, shared by everyone who watches it: its card, a
 * helper's card under it, its popover, its side panel. Opened by the first
 * reader, closed when the last one leaves or the turn ends (review of
 * 60ef98b8: a card, its popover and the panel each opened their own, so five
 * agents with helpers held fifteen connections and re-read the chain thirty
 * times as they ended; the server's comfortable ceiling is about four).
 */
interface SharedTurn {
  live: AgentLiveTurn;
  readers: Set<() => void>;
  /** What to do when the turn ends; each distinct callback runs once. */
  onEnds: Map<() => void, number>;
  ended: boolean;
  close: () => void;
}

const turns = new Map<string, SharedTurn>();

function open(executionId: string): SharedTurn {
  const turn: SharedTurn = { live: EMPTY, readers: new Set(), onEnds: new Map(), ended: false, close: () => {} };
  const set = (next: (held: AgentLiveTurn) => AgentLiveTurn) => {
    turn.live = next(turn.live);
    for (const read of turn.readers) read();
  };
  const source = new AuthedEventSource(`${API_BASE_URL}/api/chat/stream/${executionId}`, {
    getToken: () => useAuthStore.getState().token,
  });
  const repeated = createLiveSeqFilter();
  let iteration = -1;
  const end = () => {
    if (turn.ended) return;
    turn.ended = true;
    source.close();
    for (const onEnd of [...turn.onEnds.keys()]) onEnd();
  };
  const on = (type: string, handler: (event: MessageEvent) => void) =>
    source.addEventListener(type, (event) => {
      if (repeated(event.data)) return;
      handler(event);
    });

  on('text_delta', (event) => {
    const delta = parse<TextDeltaEvent>(event.data);
    if (!delta || delta.agent_slug) return;
    const fresh = delta.iteration !== iteration;
    iteration = delta.iteration;
    set((held) => ({ ...held, text: (fresh ? '' : held.text) + delta.delta }));
  });
  on('text_reset', (event) => {
    const reset = parse<TextResetEvent>(event.data);
    if (!reset || reset.agent_slug) return;
    set((held) => ({ ...held, text: '' }));
  });
  on('tool_calling', (event) => {
    const calling = parse<ToolCallingEvent>(event.data);
    if (!calling || calling.agent_slug) return;
    set((held) => ({ ...held, steps: stepsOnCalling(held.steps, calling) }));
  });
  on('tool_complete', (event) => {
    const complete = parse<ToolCompleteEvent>(event.data);
    if (!complete || complete.agent_slug) return;
    set((held) => ({ ...held, steps: stepsOnComplete(held.steps, complete) }));
  });
  for (const type of TERMINAL_EVENTS) {
    on(type, (event) => {
      // A connection failure is an `error` with no data: the reader retries on its own.
      if (type === 'error' && !event.data) return;
      end();
    });
  }
  // Given up (an expired login, a turn that is gone): the saved transcript is the truth.
  source.onerror = () => {
    if (source.readyState === CLOSED) end();
  };
  turn.close = () => {
    turn.ended = true;
    source.close();
  };
  return turn;
}

function ensure(executionId: string): SharedTurn {
  let turn = turns.get(executionId);
  if (!turn) {
    turn = open(executionId);
    turns.set(executionId, turn);
  }
  return turn;
}

/** The last reader and the last end callback gone: close the connection and forget the turn. */
function release(executionId: string, turn: SharedTurn) {
  if (turn.readers.size > 0 || turn.onEnds.size > 0) return;
  turn.close();
  if (turns.get(executionId) === turn) turns.delete(executionId);
}

/** Join a turn's stream; the returned function leaves it. */
function join(executionId: string, read: () => void): () => void {
  const turn = ensure(executionId);
  turn.readers.add(read);
  return () => {
    turn.readers.delete(read);
    release(executionId, turn);
  };
}

/**
 * useAgentStream — watches one running turn of an agent conversation, for its
 * card in the chat, its popover and its side panel (sub-agents contract, 3.4):
 * `GET /api/chat/stream/{execution_id}` through the same authed reader the
 * chat uses, so the login token never sits in the address. The answer streams
 * in as it is written; its lookups are listed as they start and end. When the
 * turn ends, `onEnd` runs once (one run per distinct callback, however many
 * readers pass it), and the caller reads the saved state again.
 *
 * Every reader of one execution id shares one connection (see SharedTurn).
 * An event relayed twice on the connection (same seq) is dropped before it is
 * applied, as the chat's own stream does (live-seq.ts).
 */
export function useAgentStream(executionId: string | null, onEnd: () => void): AgentLiveTurn {
  // No turn running (null): nothing to watch. A card passes its own state either way, so it stays one element
  // whether its agent works or not (a slip's tuck is a motion, not a new card).
  const subscribe = useCallback((read: () => void) => (executionId ? join(executionId, read) : () => undefined), [executionId]);
  const live = useSyncExternalStore(
    subscribe,
    () => (executionId ? (turns.get(executionId)?.live ?? EMPTY) : EMPTY),
    () => EMPTY,
  );

  // Register the end callback for as long as this reader stays, keyed by the callback itself: the cards of one
  // deck pass the same one (a stable useCallback) and so share one run; the side panel's is another. Callers pass a
  // stable callback, or it re-registers each render.
  useEffect(() => {
    if (!executionId) return;
    const turn = ensure(executionId);
    turn.onEnds.set(onEnd, (turn.onEnds.get(onEnd) ?? 0) + 1);
    return () => {
      const count = (turn.onEnds.get(onEnd) ?? 1) - 1;
      if (count > 0) turn.onEnds.set(onEnd, count);
      else turn.onEnds.delete(onEnd);
      release(executionId, turn);
    };
  }, [executionId, onEnd]);

  return live;
}

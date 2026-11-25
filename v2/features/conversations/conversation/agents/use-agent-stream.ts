'use client';

import { useEffect, useRef, useState } from 'react';

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
  /** The step the agent is taking now (`tool_calling`), until its text resumes. */
  step: { name: string; parameters: Record<string, unknown> } | null;
  /** Every lookup of the turn so far, oldest first, each marked done when it ends. */
  steps: AgentLiveStep[];
}

function parse<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * useAgentStream — watches one running turn of an agent conversation, for its
 * row in the chat and its side panel (sub-agents contract, 3.4):
 * `GET /api/chat/stream/{execution_id}` through the same authed reader the
 * chat uses, so the login token never sits in the address. The answer streams
 * in as it is written; its lookups are listed as they start and end. When the
 * turn ends, `onEnd` runs once, and the caller reads the saved state again.
 *
 * An event relayed twice on the connection (same seq) is dropped before it is
 * applied, as the chat's own stream does (live-seq.ts).
 *
 * One mount per turn: callers key the live view by the execution id, so a new
 * turn starts from nothing.
 */
export function useAgentStream(executionId: string, onEnd: () => void): AgentLiveTurn {
  const [live, setLive] = useState<AgentLiveTurn>({ text: '', step: null, steps: [] });
  // The latest onEnd, so a new callback each render does not reopen the stream.
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    const source = new AuthedEventSource(`${API_BASE_URL}/api/chat/stream/${executionId}`, {
      getToken: () => useAuthStore.getState().token,
    });
    const repeated = createLiveSeqFilter();
    let iteration = -1;
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      source.close();
      onEndRef.current();
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
      setLive((held) => ({ ...held, text: (fresh ? '' : held.text) + delta.delta, step: null }));
    });
    on('text_reset', (event) => {
      const reset = parse<TextResetEvent>(event.data);
      if (!reset || reset.agent_slug) return;
      setLive((held) => ({ ...held, text: '' }));
    });
    on('tool_calling', (event) => {
      const calling = parse<ToolCallingEvent>(event.data);
      if (!calling || calling.agent_slug) return;
      setLive((held) => ({
        ...held,
        step: { name: calling.tool_call.name, parameters: calling.tool_call.parameters ?? {} },
        steps: stepsOnCalling(held.steps, calling),
      }));
    });
    on('tool_complete', (event) => {
      const complete = parse<ToolCompleteEvent>(event.data);
      if (!complete || complete.agent_slug) return;
      setLive((held) => ({ ...held, steps: stepsOnComplete(held.steps, complete) }));
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
    return () => {
      ended = true;
      source.close();
    };
  }, [executionId]);

  return live;
}

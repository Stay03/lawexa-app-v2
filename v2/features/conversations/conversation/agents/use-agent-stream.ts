'use client';

import { useEffect, useRef, useState } from 'react';

import { CLOSED, AuthedEventSource } from '@/lib/stream/authed-event-source';
import { useAuthStore } from '@/lib/stores/authStore';
import type { TextDeltaEvent, TextResetEvent, ToolCallingEvent } from '@/types/chat';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** The events that end a turn's stream (docs/streaming/frontend-streaming-guide.md). */
const TERMINAL_EVENTS = ['completed', 'error', 'cancelled', 'timeout', 'end'] as const;

export interface AgentLiveTurn {
  /** The answer as it streams, for the turn's current iteration. */
  text: string;
  /** The step the agent is taking now (`tool_calling`), until its text resumes. */
  step: { name: string; parameters: Record<string, unknown> } | null;
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
 * useAgentStream — watches one running turn of an agent conversation in the
 * side panel (sub-agents contract, 3.4): `GET /api/chat/stream/{execution_id}`
 * through the same authed reader the chat uses, so the login token never sits
 * in the address. The answer streams in as it is written; the step the agent
 * takes shows meanwhile. When the turn ends, `onEnd` runs once, and the panel
 * reads the saved transcript again.
 *
 * One mount per turn: the panel keys its live row by the execution id, so a
 * new turn starts from nothing.
 */
export function useAgentStream(executionId: string, onEnd: () => void): AgentLiveTurn {
  const [live, setLive] = useState<AgentLiveTurn>({ text: '', step: null });
  // The latest onEnd, so a new callback each render does not reopen the stream.
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    const source = new AuthedEventSource(`${API_BASE_URL}/api/chat/stream/${executionId}`, {
      getToken: () => useAuthStore.getState().token,
    });
    let iteration = -1;
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      source.close();
      onEndRef.current();
    };

    source.addEventListener('text_delta', (event) => {
      const delta = parse<TextDeltaEvent>(event.data);
      if (!delta || delta.agent_slug) return;
      const fresh = delta.iteration !== iteration;
      iteration = delta.iteration;
      setLive((held) => ({ text: (fresh ? '' : held.text) + delta.delta, step: null }));
    });
    source.addEventListener('text_reset', (event) => {
      const reset = parse<TextResetEvent>(event.data);
      if (!reset || reset.agent_slug) return;
      setLive((held) => ({ ...held, text: '' }));
    });
    source.addEventListener('tool_calling', (event) => {
      const calling = parse<ToolCallingEvent>(event.data);
      if (!calling || calling.agent_slug) return;
      setLive((held) => ({ ...held, step: { name: calling.tool_call.name, parameters: calling.tool_call.parameters ?? {} } }));
    });
    for (const type of TERMINAL_EVENTS) {
      source.addEventListener(type, (event) => {
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

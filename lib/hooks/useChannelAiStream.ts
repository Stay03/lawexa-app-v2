'use client';

import { useEffect, useRef, useState } from 'react';

import { useAuthStore } from '@/lib/stores/authStore';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type ChannelAiStreamPhase =
  | 'connecting'
  | 'thinking'
  | 'streaming'
  | 'done'
  | 'error';

export interface ChannelAiStream {
  text: string;
  phase: ChannelAiStreamPhase;
}

/**
 * Lean, best-effort SSE consumer for the "watch Lawexa type" glance (Phase 6).
 *
 * Attaches to the SAME `/api/chat/stream/{execution_id}` transport personal
 * chat uses, but keeps only the visible text + a coarse phase — no watchdog,
 * polling, reconnect machinery, or message-array state. The authoritative reply
 * always lands as a normal `message.created` in the feed, so this preview is
 * purely optional and disposable.
 *
 * The component that renders this is keyed per `executionId` (see
 * ChannelConversation), so a fresh mount resets state — this hook never resets
 * state in cleanup, it only closes the source.
 */
export function useChannelAiStream(executionId: string): ChannelAiStream {
  const token = useAuthStore((s) => s.token);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<ChannelAiStreamPhase>('connecting');
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token || !executionId) return;

    const encodedToken = encodeURIComponent(token);
    const streamUrl = `${API_BASE_URL}/api/chat/stream/${executionId}?token=${encodedToken}`;
    const eventSource = new EventSource(streamUrl);
    sourceRef.current = eventSource;

    const close = () => {
      eventSource.close();
      if (sourceRef.current === eventSource) sourceRef.current = null;
    };

    // Late attach may carry the buffered prefix of the in-flight answer.
    eventSource.addEventListener('connected', (e) => {
      const data = (e as MessageEvent).data;
      let accumulated: string | undefined;
      try {
        const parsed = JSON.parse(data) as { accumulated_text?: string };
        accumulated = parsed.accumulated_text;
      } catch {
        accumulated = undefined;
      }
      if (accumulated) setText(accumulated);
      setPhase('streaming');
    });

    eventSource.addEventListener('text_delta', (e) => {
      let delta = '';
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as { delta?: string };
        delta = parsed.delta ?? '';
      } catch {
        delta = '';
      }
      setText((prev) => prev + delta);
      setPhase('streaming');
    });

    // Model retried this turn — drop the buffered prefix.
    eventSource.addEventListener('text_reset', () => {
      setText('');
    });

    eventSource.addEventListener('thinking', () => {
      setPhase('thinking');
    });

    eventSource.addEventListener('completed', (e) => {
      let content: string | undefined;
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as {
          content?: string;
          message?: string;
        };
        content = parsed.content ?? parsed.message;
      } catch {
        content = undefined;
      }
      setText((prev) => content ?? prev);
      setPhase('done');
      close();
    });

    eventSource.addEventListener('error', (e) => {
      // Named `error` events carry data; browser connection errors go to onerror.
      if (!(e as MessageEvent).data) return;
      setPhase('error');
      close();
    });

    eventSource.addEventListener('cancelled', () => {
      setPhase('done');
      close();
    });

    // Terminal for the whole stream — close so the browser can't auto-reconnect.
    eventSource.addEventListener('end', () => {
      setPhase((prev) => (prev === 'error' ? 'error' : 'done'));
      close();
    });

    eventSource.onerror = () => {
      if (sourceRef.current !== eventSource) return;
      // readyState 2 = CLOSED: permanently dead. Otherwise the browser is
      // auto-reconnecting (CONNECTING) — don't fight it.
      if (eventSource.readyState === 2) {
        setPhase('error');
        close();
      }
    };

    return () => {
      eventSource.close();
      if (sourceRef.current === eventSource) sourceRef.current = null;
    };
  }, [executionId, token]);

  return { text, phase };
}

'use client';

import { memo, useState } from 'react';
import { AlertCircle, Check, Copy, RotateCcw, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useStreamingText,
  useStreamingReasoning,
  type EngineMessage,
  type StreamingSource,
} from '@/v2/runtime/chat-engine';
import type { ChatMessage } from '@/types/chat';
import { ChatContent } from '../markdown/ChatContent';
import { ReasoningTrace } from '../reasoning/ReasoningTrace';

/**
 * AssistantMessageRow — the streaming answer row, and the proof of the "list never
 * re-renders on tokens" property.
 *
 * The structural message object is referentially STABLE while tokens arrive (the
 * engine appends deltas to a separate per-message store, never to the messages
 * array), and this component is `React.memo`'d, so token growth NEVER re-renders
 * the list or any sibling row. The live text/reasoning reach ONLY this row through
 * `useStreamingText` / `useStreamingReasoning` (isolated `useSyncExternalStore`
 * subscriptions keyed by message id) — so exactly one row repaints per ~60ms flush.
 *
 * When finalized, the row reads `message.content` / `message.reasoning` (the engine
 * writes them onto the structural message and clears the live stores), so there is
 * no dependence on stale streaming state.
 */
export const AssistantMessageRow = memo(function AssistantMessageRow({
  message,
  streamingText,
  reasoning,
  isInteracted,
  isLast,
  canRegenerate,
  onRegenerate,
}: {
  message: EngineMessage;
  streamingText: StreamingSource;
  reasoning: StreamingSource;
  isInteracted: boolean;
  isLast: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
}) {
  const isStreaming = message.isStreaming ?? false;

  // Live subscriptions — only this row re-renders on flush (see docblock).
  const live = useStreamingText(streamingText, message.id);
  const liveReasoning = useStreamingReasoning(reasoning, message.id);

  // TERMINAL DRAIN. The smoother may still be revealing the tail of a FINISHED
  // answer (see `finish` in stream-smoother.ts): the engine writes the full text
  // and flips `isStreaming` in one commit, so without this the undrained ~350ms
  // of already-arrived text would land in a single frame — the end-of-answer pop.
  // While draining, `live` is a strict PREFIX of the authoritative
  // `message.content`, and reading it is what turns that snap into a smooth
  // landing. The predicate IS the safety net: the moment this layer stops offering
  // a prefix — cursor dropped or cleared, smoothing disabled, or a different
  // server-canonical text — the FULL `message.content` renders immediately. The
  // worst failure mode is the old pop; text can never be stranded.
  const draining =
    !isStreaming &&
    live.length > 0 &&
    live.length < message.content.length &&
    message.content.startsWith(live);
  const text = isStreaming || draining ? live : message.content;
  const reasoningText = isStreaming ? liveReasoning : message.reasoning ?? '';
  const partial = (message as ChatMessage).partial;
  // Actions wait for the landing: mid-drain `text` is a prefix, so Copy would copy a
  // truncated answer and the buttons would be pushed down as the tail arrives.
  const showActions = !isStreaming && !draining && message.content.trim().length > 0;

  return (
    <div className="w-full">
      <ReasoningTrace text={reasoningText} isStreaming={isStreaming} reasoningMs={message.reasoningMs} />

      {/* Rendered while STREAMING even with no text yet: in the `line` release style
          the first unit is deliberately held until it is complete, and ChatContent's
          skeleton bar is what stands in for it. Gating on `text` alone left that
          opening beat blank (the transcript's activity status has already stepped
          aside once the assistant placeholder exists). With empty text and the
          `flow` style this renders a zero-height prose container, so nothing about
          the current look changes. */}
      {(text || isStreaming) && (
        // The two gates are passed SEPARATELY because they want different answers
        // during a drain: the per-word fade and the "generating" pill stay on (text
        // is still appearing; a half-revealed card tag must not flash raw XML), but
        // the `line` stand-in bar must not — the answer is complete, so a pulsing
        // placeholder under it would promise a line that is never coming.
        <ChatContent
          content={text}
          isStreaming={isStreaming}
          isDraining={draining}
          isInteracted={isInteracted}
        />
      )}

      {partial && (
        <div
          className={cn(
            'mt-1 flex items-center gap-1.5 text-xs',
            partial.reason === 'cancelled' ? 'text-muted-foreground' : 'text-destructive',
          )}
        >
          {partial.reason === 'cancelled' ? (
            <>
              <Square className="h-3 w-3" />
              <span>Stopped</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3" />
              <span>Interrupted</span>
            </>
          )}
        </div>
      )}

      {showActions && (
        <MessageActions
          text={text}
          showRegenerate={isLast && canRegenerate}
          onRegenerate={onRegenerate}
        />
      )}
    </div>
  );
});

/**
 * Real, working message actions (§C DROP: v1's dead hover-only copy/thumbs). Copy
 * writes to the clipboard. The row is always rendered at a quiet resting opacity
 * (so it is reachable on touch — the hover-only pattern was invisible on touch),
 * brightening on hover for pointer devices.
 *
 * "ASK AGAIN" (honesty over illusion): the action re-sends the last user turn, which
 * genuinely appends a NEW turn to the server thread ([Q, A1, Q, A2]) — there is no
 * backend regenerate endpoint. Presenting it as an in-place "regenerate" that
 * replaces A1 would be a lie the moment the page reloads and re-hydrates the real
 * server history (A1 would still be there). So it is labeled "Ask again" — what it
 * actually does. A true in-place regenerate is a future backend ask (logged).
 */
function MessageActions({
  text,
  showRegenerate,
  onRegenerate,
}: {
  text: string;
  showRegenerate: boolean;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions) — no-op; the button
      // simply doesn't confirm. Nothing to surface.
    }
  };

  return (
    <div className="mt-1.5 flex items-center gap-1 opacity-70 transition-opacity hover:opacity-100">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy message'}
        className="v2-interactive text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5 transition-colors"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
      </button>
      {showRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          aria-label="Ask again"
          title="Ask this question again (adds a new turn)"
          className="v2-interactive text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Ask again
        </button>
      )}
    </div>
  );
}

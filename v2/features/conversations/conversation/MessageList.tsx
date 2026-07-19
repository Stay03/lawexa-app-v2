'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  isErrorMessage,
  isToolMessage,
  isHandoverMessage,
  type ConversationReference,
  type ErrorMessage,
} from '@/types/chat';
import type { EngineMessage, StreamingSource } from '@/v2/runtime/chat-engine';
import { groupMessages, type MessageGroup } from './message-groups';
import { UserMessageRow } from './rows/UserMessageRow';
import { AssistantMessageRow } from './rows/AssistantMessageRow';
import { HandoverRow } from './rows/HandoverRow';
import { ErrorRow } from './rows/ErrorRow';
import { CompactToolChain } from './tools/CompactToolChain';
import { ActivityStatus } from './ActivityStatus';
import { ReferenceChips } from './ReferenceChips';

/**
 * MessageList — the natively-virtualized, memoized transcript with chat scroll
 * etiquette.
 *
 * NO-LIST-RERENDER-ON-TOKENS. The engine keeps the messages array referentially
 * stable while tokens flow (deltas go to a per-message store, never to setMessages),
 * so this component does not re-render on tokens. Grouping is `useMemo`'d on that
 * stable array reference, so a parent re-render that does NOT change the messages
 * (e.g. the ~8s narration tick) reuses the SAME group objects — and every heavy row
 * is `React.memo`'d, so those rows hold instead of re-reconciling. The live
 * token/reasoning reach ONLY the streaming row via its own `useStreamingText`
 * subscription; the list and its sibling rows never re-render on a token.
 *
 * VIRTUALIZATION. `@tanstack/react-virtual` is not installed (and the version the
 * standards name doesn't exist on the registry — see the wave report), so rather
 * than force-fit a fragile windowing of streaming content, off-screen rows are
 * virtualized natively with `content-visibility: auto` + `contain-intrinsic-size:
 * auto` (the browser skips rendering/layout off-screen and remembers measured
 * height — no scroll jump). The active/last group is never containment-virtualized.
 *
 * SCROLL ETIQUETTE (foundation-standards §5). Follow only within ~40px of the
 * bottom; any upward scroll disengages instantly; a jump-to-latest pill shows the
 * count of messages since detach; sending always scrolls into view. A ResizeObserver
 * on the content wrapper keeps the view pinned to the newest text WHILE pinned — an
 * imperative scroll, so streaming growth never re-renders the list. All setState
 * happens in callbacks (scroll / observer / click); effects only sync refs and
 * scroll imperatively (React Compiler-clean).
 */
const BOTTOM_THRESHOLD_PX = 40;

/** First tool/handover start, else first streaming placeholder — pure. */
function computeStreamStart(messages: readonly EngineMessage[]): number | null {
  for (const m of messages) {
    if (isToolMessage(m) || isHandoverMessage(m)) return m.timestamp.getTime();
  }
  for (const m of messages) {
    if (m.role === 'assistant' && m.isStreaming) return m.timestamp.getTime();
  }
  return null;
}

export interface MessageListProps {
  messages: readonly EngineMessage[];
  streamingText: StreamingSource;
  reasoning: StreamingSource;
  isStreaming: boolean;
  isLoadingHistory: boolean;
  error: string | null;
  narration: string | null;
  references: ConversationReference[];
  canRegenerate: boolean;
  onRegenerate: () => void;
  onRetry: () => void;
}

export function MessageList({
  messages,
  streamingText,
  reasoning,
  isStreaming,
  isLoadingHistory,
  error,
  narration,
  references,
  canRegenerate,
  onRegenerate,
  onRetry,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const messagesLenRef = useRef(messages.length);
  const detachBaselineRef = useRef(messages.length);
  const isStreamingRef = useRef(isStreaming);
  const [showPill, setShowPill] = useState(false);
  const [pillCount, setPillCount] = useState(0);

  // Keyed on the (structurally stable) messages reference — stable group objects
  // across token flushes and unrelated parent re-renders, so GroupRow's memo holds.
  const groups = useMemo(() => groupMessages(messages), [messages]);
  const streamStartTime = useMemo(() => computeStreamStart(messages), [messages]);
  const lastGroupIndex = groups.length - 1;
  const lastMessage = messages[messages.length - 1];
  const showActivity =
    isStreaming && (!!narration || (!!lastMessage && lastMessage.role !== 'assistant'));

  // Sync refs + imperative scroll on a new turn. No setState here (Compiler-clean):
  // scrolling to the bottom fires the scroll handler, which resets the pill.
  useEffect(() => {
    isStreamingRef.current = isStreaming;
    const prevLen = messagesLenRef.current;
    messagesLenRef.current = messages.length;
    const last = messages[messages.length - 1];
    if (last && last.role === 'user' && messages.length > prevLen) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight; // sending always scrolls into view
    }
  }, [messages, isStreaming]);

  // Keep pinned to the newest content while at the bottom; else surface the pill.
  // All setState lives in this observer CALLBACK (external-system subscription).
  useEffect(() => {
    const content = contentRef.current;
    const scroller = scrollRef.current;
    if (!content || !scroller) return;
    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) {
        scroller.scrollTop = scroller.scrollHeight;
        return;
      }
      const newSince = messagesLenRef.current - detachBaselineRef.current;
      if (newSince > 0) {
        setShowPill(true);
        setPillCount(newSince);
      } else if (isStreamingRef.current) {
        setShowPill(true);
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Scroll handler (event callback — setState allowed). Disengage on any upward
  // scroll; re-engage + clear the pill at the bottom.
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distance <= BOTTOM_THRESHOLD_PX;
    atBottomRef.current = atBottom;
    if (atBottom) {
      detachBaselineRef.current = messagesLenRef.current;
      setShowPill(false);
      setPillCount(0);
    } else {
      setShowPill(true);
    }
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    // The resulting scroll event runs handleScroll, which resets the pill.
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div ref={contentRef} className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
          {references.length > 0 && (
            <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
              <ReferenceChips references={references} />
            </div>
          )}

          {isLoadingHistory && <HistorySkeleton />}

          {groups.map((group, gi) => (
            <GroupRow
              key={groupKey(group, gi)}
              group={group}
              virtualize={gi < lastGroupIndex}
              isLastGroup={gi === lastGroupIndex}
              hasLaterUserTurn={
                group.type === 'single' &&
                group.message.role === 'assistant' &&
                groups.slice(gi + 1).some((g) => g.type === 'single' && g.message.role === 'user')
              }
              streamingText={streamingText}
              reasoning={reasoning}
              isStreaming={isStreaming}
              canRegenerate={canRegenerate}
              onRegenerate={onRegenerate}
              onRetry={onRetry}
            />
          ))}

          {showActivity && (
            <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
              <ActivityStatus startTime={streamStartTime} narration={narration} />
            </div>
          )}

          {error && (
            <div className="border-destructive/30 bg-destructive/10 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
              <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-destructive flex-1 font-medium">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive h-7 shrink-0 gap-1.5 text-xs"
                onClick={onRetry}
                disabled={isStreaming}
              >
                <RotateCcw className="h-3 w-3" />
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Jump-to-latest pill — count of messages since detach (§5). Symmetric
          fade/slide both directions (standing rule #24). */}
      <div
        aria-hidden={!showPill}
        className={[
          'pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 transition-all duration-200 motion-reduce:transition-none',
          showPill ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        ].join(' ')}
      >
        <Button
          size="sm"
          variant="secondary"
          className={[
            'v2-interactive h-9 gap-1.5 rounded-full px-3 shadow-lg',
            showPill ? 'pointer-events-auto' : 'pointer-events-none',
          ].join(' ')}
          onClick={jumpToLatest}
          tabIndex={showPill ? 0 : -1}
        >
          <ArrowDown className="h-4 w-4" />
          {pillCount > 0 ? `${pillCount} new` : 'Latest'}
        </Button>
      </div>
    </div>
  );
}

function groupKey(group: MessageGroup, index: number): string {
  if (group.type === 'single') return group.message.id;
  if (group.type === 'tool-chain') return `tool-${group.messages[0]?.id ?? index}`;
  return `handover-${group.handover.id}`;
}

/**
 * One rendered group. Memoized so a structural change only re-renders the groups
 * that actually changed. Off-screen groups are natively virtualized via
 * content-visibility (never the active/last group).
 */
const GroupRow = memo(function GroupRow({
  group,
  virtualize,
  isLastGroup,
  hasLaterUserTurn,
  streamingText,
  reasoning,
  isStreaming,
  canRegenerate,
  onRegenerate,
  onRetry,
}: {
  group: MessageGroup;
  virtualize: boolean;
  isLastGroup: boolean;
  hasLaterUserTurn: boolean;
  streamingText: StreamingSource;
  reasoning: StreamingSource;
  isStreaming: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
  onRetry: () => void;
}) {
  // Native windowing for off-screen rows; `auto` remembers measured height so a
  // scrolled-away row returns to the exact same size (no jump).
  const style = virtualize
    ? ({ contentVisibility: 'auto', containIntrinsicSize: 'auto 240px' } as const)
    : undefined;

  let body: React.ReactNode;
  if (group.type === 'handover-group') {
    body = (
      <HandoverRow
        handover={group.handover}
        toolMessages={group.toolMessages}
        streamingText={streamingText}
      />
    );
  } else if (group.type === 'tool-chain') {
    body = <CompactToolChain messages={group.messages} />;
  } else {
    const message = group.message;
    if (isErrorMessage(message)) {
      body = (
        <ErrorRow message={message as ErrorMessage} onRetry={onRetry} isStreaming={isStreaming} />
      );
    } else if (message.role === 'user') {
      body = <UserMessageRow message={message} />;
    } else {
      body = (
        <AssistantMessageRow
          message={message}
          streamingText={streamingText}
          reasoning={reasoning}
          isInteracted={hasLaterUserTurn}
          isLast={isLastGroup}
          canRegenerate={canRegenerate}
          onRegenerate={onRegenerate}
        />
      );
    }
  }

  return <div style={style}>{body}</div>;
});

/** Skeleton-first history load — occupies plausible geometry, no text flash. */
function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex justify-end">
        <div className="bg-muted h-10 w-2/3 animate-pulse rounded-3xl" />
      </div>
      <div className="space-y-2">
        <div className="bg-muted h-4 w-full animate-pulse rounded" />
        <div className="bg-muted h-4 w-11/12 animate-pulse rounded" />
        <div className="bg-muted h-4 w-4/5 animate-pulse rounded" />
      </div>
      <div className="flex justify-end">
        <div className="bg-muted h-10 w-1/2 animate-pulse rounded-3xl" />
      </div>
      <div className="space-y-2">
        <div className="bg-muted h-4 w-full animate-pulse rounded" />
        <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
      </div>
    </div>
  );
}

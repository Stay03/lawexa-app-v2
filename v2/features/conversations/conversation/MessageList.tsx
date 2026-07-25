'use client';

import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { TranscriptSkeleton } from './skeletons';

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
 * height — no scroll jump). The last few groups — the screenful the reader lands on
 * — are never containment-virtualized; see UNVIRTUALIZED_TAIL for why an estimated
 * tail made the first paint settle visibly.
 *
 * FIRST PAINT. The opening scroll position is set in a LAYOUT effect, so the first
 * frame the user sees is already at the bottom of the conversation. The transcript
 * then fades in rather than cutting in. Both are below, each with its own note.
 *
 * SCROLL ETIQUETTE (foundation-standards §5). Follow only within ~40px of the
 * bottom; any upward scroll disengages instantly; a jump-to-latest pill shows the
 * count of messages since detach; sending always scrolls into view. A ResizeObserver
 * on the content wrapper keeps the view pinned to the newest text WHILE pinned — an
 * imperative scroll, so streaming growth never re-renders the list. All setState
 * happens in callbacks (scroll / observer / click); effects only sync refs and
 * scroll imperatively (React Compiler-clean).
 */
/** 80px: headroom for the EASED bottom-follow (it trails the true bottom by a
 *  fraction of a line mid-ease, which must still count as "at bottom"); a real
 *  user scroll-up of more than this still detaches instantly. */
const BOTTOM_THRESHOLD_PX = 80;

/**
 * How many groups at the END of the transcript are exempt from native
 * virtualization, on top of the last one.
 *
 * WHY THIS IS NOT ZERO (the owner's "the messages just load jumpy"). Off-screen
 * groups carry `contain-intrinsic-size: auto 240px`, so before a group has ever
 * been rendered the browser SIZES IT AT A GUESS. On a fresh mount every group
 * except the last is a guess, which means `scrollHeight` — the number the
 * scroll-to-bottom below aims at — is a guess too. The view lands near the bottom,
 * the real groups around it then render at their true heights, the total height
 * moves, and the follower corrects: content visibly settling under the reader.
 *
 * Four real groups is about one phone screenful, so the region the user actually
 * looks at on arrival is measured rather than estimated. Everything further up
 * stays virtualized and resolves off-screen, where a height change costs nothing
 * (the browser's scroll anchoring absorbs it and the follower is already pinned to
 * a bottom that did not move).
 */
const UNVIRTUALIZED_TAIL = 3;

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server — React warns that a
 * layout effect does nothing during SSR, and the conversation screen does server-
 * render (with an empty transcript, so the browser branch is the only one that ever
 * has work to do). Resolved ONCE at module scope, so the hook call site below is
 * unconditional and rules-of-hooks holds.
 */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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
  const followRafRef = useRef<number | null>(null);

  /**
   * THE JUMP-TO-LATEST PILL, AS ONE DERIVED VALUE.
   *
   * `null` means the reader is at the bottom. Any other value is the message count
   * captured at the moment they scrolled away, so "how many have I not seen?" is
   * `messages.length - detachedAt`, computed during render.
   *
   * IT USED TO BE A REF READ INSIDE THE ResizeObserver, AND THAT WAS A REAL BUG.
   * The observer callback is delivered after layout but BEFORE paint, while the
   * effect that refreshed the message-count ref is passive and runs after it. During
   * streaming the flaw was invisible: the transcript grows dozens of times, so a
   * later callback always caught up. But a merge from another tab grows the
   * transcript exactly ONCE — that single callback read the pre-merge count, got
   * zero, and the pill never appeared at all. Deriving the count removes the
   * ordering question instead of racing it, and takes two pieces of state and two
   * refs out of the component.
   */
  const [detachedAt, setDetachedAt] = useState<number | null>(null);
  const showPill = detachedAt !== null;
  const pillCount = detachedAt === null ? 0 : Math.max(0, messages.length - detachedAt);

  // Keyed on the (structurally stable) messages reference — stable group objects
  // across token flushes and unrelated parent re-renders, so GroupRow's memo holds.
  const groups = useMemo(() => groupMessages(messages), [messages]);
  const streamStartTime = useMemo(() => computeStreamStart(messages), [messages]);
  const lastGroupIndex = groups.length - 1;
  const lastMessage = messages[messages.length - 1];
  const showActivity =
    isStreaming && (!!narration || (!!lastMessage && lastMessage.role !== 'assistant'));

  // ── THE FIRST PAINT LANDS AT THE BOTTOM, BEFORE THE BROWSER DRAWS ANYTHING. ──
  //
  // Owner: "the messages just load on the page jumpy". This was the whole of it.
  // Nothing set the scroll position for the first render, so the browser drew the
  // transcript at scrollTop 0 — the START of the conversation — and only afterwards
  // did the ResizeObserver below fire, schedule a frame, and snap to the bottom. So
  // every open painted at least one frame of the wrong end of the conversation and
  // then jumped the full height of it.
  //
  // A LAYOUT effect is the fix, not a passive one: it runs after the DOM is updated
  // and BEFORE the browser paints, so the very first frame the user sees is already
  // at the bottom. There is no jump left to smooth, because there is no jump.
  //
  // Assigning past the maximum clamps to it, so `scrollHeight` needs no arithmetic
  // and cannot overshoot. It fires on the commit where the transcript first has
  // content — the same effect covers a warm cache (content in the first render) and
  // a cold fetch (content arriving later) — and the ref makes it once per mount, so
  // it can never fight a user who has scrolled up. `MessageList` remounts per
  // conversation, so the next conversation gets its own first landing.
  const didInitialScrollRef = useRef(false);
  useIsomorphicLayoutEffect(() => {
    if (didInitialScrollRef.current || messages.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    didInitialScrollRef.current = true;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Sync the length ref + imperative scroll on a new turn. No setState here
  // (Compiler-clean): scrolling to the bottom fires the scroll handler, which
  // re-attaches and so clears the pill.
  useEffect(() => {
    const prevLen = messagesLenRef.current;
    messagesLenRef.current = messages.length;
    const last = messages[messages.length - 1];
    if (last && last.role === 'user' && messages.length > prevLen) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight; // sending always scrolls into view
    }
  }, [messages]);

  // Keep pinned to the newest content while at the bottom. The observer now has ONE
  // job — the eased bottom-follow — because the pill is derived from render state
  // (see `detachedAt`) instead of being pushed from here. It sets no state at all.
  //
  // EASED BOTTOM-FOLLOW (owner "jumpy on new line", smoothing pass 2): the old
  // instantaneous `scrollTop = scrollHeight` yanked the viewport a full line-height
  // in one frame every time the streaming text WRAPPED — smooth horizontal reveal,
  // discrete vertical hops. The follower lerps toward the bottom over a few frames
  // instead, so vertical follow matches the text's butter. It only ever scrolls
  // DOWN while pinned; the ease's transient gap stays under BOTTOM_THRESHOLD_PX,
  // so it can never self-detach. Pin/detach/pill logic is unchanged.
  useEffect(() => {
    const content = contentRef.current;
    const scroller = scrollRef.current;
    if (!content || !scroller) return;

    const followBottom = () => {
      followRafRef.current = null;
      const el = scrollRef.current;
      if (!el || !atBottomRef.current) return;
      const target = el.scrollHeight - el.clientHeight;
      const diff = target - el.scrollTop;
      if (diff <= 1) {
        el.scrollTop = target;
        return;
      }
      // BIG jump (history load, end-of-stream snap, card expand): SNAP. Easing a
      // >threshold gap leaves a residual the scroll handler reads as a user
      // scroll-up (its own scrollTop write fires `scroll`), detaching the pin and
      // stranding the view ~25% down with a spurious pill (round-3 review, HIGH).
      // Only the sub-line growth of normal streaming — the case the ease exists
      // for — glides.
      if (diff > BOTTOM_THRESHOLD_PX) {
        el.scrollTop = target;
        return;
      }
      el.scrollTop += Math.max(1, diff * 0.25);
      followRafRef.current = requestAnimationFrame(followBottom);
    };

    const observer = new ResizeObserver(() => {
      if (!atBottomRef.current) return;
      if (followRafRef.current == null) {
        followRafRef.current = requestAnimationFrame(followBottom);
      }
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      if (followRafRef.current != null) cancelAnimationFrame(followRafRef.current);
    };
  }, []);

  // Scroll handler (event callback — setState allowed). Disengage on any upward
  // scroll; re-engage at the bottom. Capturing `messages.length` HERE is what makes
  // the count honest: it is the number of messages the reader had actually seen at
  // the moment they looked away, taken from this render's own value rather than
  // from a ref that some other callback may not have refreshed yet.
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distance <= BOTTOM_THRESHOLD_PX;
    atBottomRef.current = atBottom;
    if (atBottom) {
      setDetachedAt(null);
    } else if (detachedAt === null) {
      // Only the FIRST scroll away sets the mark — later scrolls while already
      // detached must not keep resetting it, or the count would never grow.
      setDetachedAt(messages.length);
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
        {/* Bottom padding clears the FLOATING composer that ConversationScreen lays
            over this scroll region (the pill is absolute/out-of-flow, so the transcript
            must reserve room for its last message to scroll clear of it). The height is
            measured live into `--v2-conv-dock-h` by ConversationScreen and grows with
            the composer's staging; the fallback covers the pre-measure first paint. The
            extra 1rem is a resting gap above the pill's soft top fade. */}
        <div
          ref={contentRef}
          className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-6 pb-[calc(var(--v2-conv-dock-h,7rem)+1rem)]"
        >
          {references.length > 0 && (
            <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
              <ReferenceChips references={references} />
            </div>
          )}

          {isLoadingHistory && <TranscriptSkeleton />}

          {/* The transcript FADES IN rather than cutting in (standing rule #24 —
              nothing appears abruptly). The wrapper mounts on the commit that first
              has groups, so the fade plays exactly once per open: over the deleted
              route/history skeleton on a cold load, and on arrival at the bottom on
              a warm one. It stays mounted afterwards, so streaming never replays it.
              Its own `gap-6` keeps the column's rhythm unchanged by the extra
              element. */}
          {groups.length > 0 && (
            <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
              {groups.map((group, gi) => (
                <GroupRow
                  key={groupKey(group, gi)}
                  group={group}
                  // The last few groups are never virtualized — see
                  // UNVIRTUALIZED_TAIL. They are the screenful the reader lands on,
                  // so they must be MEASURED, not estimated, or the view settles
                  // under them after the first paint.
                  virtualize={gi < lastGroupIndex - UNVIRTUALIZED_TAIL}
                  isLastGroup={gi === lastGroupIndex}
                  hasLaterUserTurn={
                    group.type === 'single' &&
                    group.message.role === 'assistant' &&
                    groups
                      .slice(gi + 1)
                      .some((g) => g.type === 'single' && g.message.role === 'user')
                  }
                  streamingText={streamingText}
                  reasoning={reasoning}
                  isStreaming={isStreaming}
                  canRegenerate={canRegenerate}
                  onRegenerate={onRegenerate}
                  onRetry={onRetry}
                />
              ))}
            </div>
          )}

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
          fade/slide both directions (standing rule #24). Its `bottom` clears the
          FLOATING composer (same `--v2-conv-dock-h` measure the transcript pads with),
          so it rides just above the pill instead of behind it. */}
      <div
        aria-hidden={!showPill}
        className={[
          'pointer-events-none absolute bottom-[calc(var(--v2-conv-dock-h,7rem)+1rem)] left-1/2 -translate-x-1/2 transition-all duration-200 motion-reduce:transition-none',
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
          {/* Named, not counted, at one — "New message" is what the reader is
              actually being told, and one is the common case now that a message
              can arrive from another tab. */}
          {pillCount === 0
            ? 'Latest'
            : pillCount === 1
              ? 'New message'
              : `${pillCount} new messages`}
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

'use client';

import {
  Fragment,
  memo,
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { ArrowDown, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  isErrorMessage,
  type ConversationReference,
  type ErrorMessage,
} from '@/types/chat';
import type { EngineMessage, StreamingSource } from '@/v2/runtime/chat-engine';
import { useScrollAnchoring } from '@/v2/runtime/scroll-anchoring';
import { groupMessages, type MessageGroup } from './message-groups';
import { computeStreamStart } from './stream-start';
import { splitOpenTail, type OpenTailLimit } from './open-tail';
import { UserMessageRow } from './rows/UserMessageRow';
import { AssistantMessageRow } from './rows/AssistantMessageRow';
import { HandoverRow } from './rows/HandoverRow';
import { ErrorRow } from './rows/ErrorRow';
import { CompactToolChain } from './tools/CompactToolChain';
import { ActivityStatus } from './ActivityStatus';
import { ReferenceChips } from './ReferenceChips';
import { TranscriptSkeleton } from './skeletons';
import { openDefersBlocks } from './markdown/defer-plan';
import { ScrollKeepContext, type ScrollKeep } from './markdown/scroll-keep-context';
import { followOnResize, nearBottom, readsAtBottom } from './scroll-pin';

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

/** Every scroll the list makes itself. The handler compares the position a
 *  scroll event finds with the one written here (`readsAtBottom`), so the
 *  list's own scrolls, and growth that leaves the view where they put it, never
 *  read as the reader moving away. Read back after the write: the browser
 *  clamps it. */
function scrollOwn(el: HTMLDivElement, ownTop: RefObject<number | null>, top: number) {
  el.scrollTop = top;
  ownTop.current = el.scrollTop;
}

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
 * — AS LONG AS THE BROWSER KEEPS THE READER'S PLACE. That sentence used to end
 * "the browser's scroll anchoring absorbs it", stated as a fact about browsers.
 * It is a fact about Chrome and Firefox. Safari has never implemented scroll
 * anchoring, so on an iPhone or a Mac every guessed height that resolved above
 * the viewport moved the page under the reader: "when scrolling up it looks very
 * glitchy and broken", reported on both, in this screen and in channels.
 *
 * So virtualization is now gated on the capability itself
 * ({@link useScrollAnchoring}). Where the browser cannot hold the reader's
 * place, every group is measured and nothing settles; where it can, the
 * optimisation is untouched, and Safari 27 will earn it back by itself.
 */
const UNVIRTUALIZED_TAIL = 3;

/**
 * How much of the chat the FIRST frame of an open draws: the newest messages,
 * until the text they draw is about two phone screens (OPEN_TAIL_CHARS), and
 * never more than OPEN_TAIL_MESSAGES of them.
 *
 * MOVE FIRST, FILL SECOND (Stay, 8 October 2026: the second tap on the same
 * chat "seems kind of slow"). A chat already in memory used to draw every
 * message and its markdown before the screen could move: 1.6-1.9 s on a
 * 38-message chat against 0.3-0.4 s for the first tap, which moves to a
 * skeleton (live, phone, CPU x4). The trace had nothing else: no network, just
 * the whole chat drawn, plus every collapsible measuring itself and the message
 * box reading its height, each of which lays out the page as it stands.
 *
 * So an open draws only the newest messages, which are the screenful the reader
 * lands on, as real text. The rest arrive after the first frame has been
 * painted, in a transition React can interrupt; by then the screen has moved,
 * and the layout reads above ran against a short page.
 *
 * TWO SCREENS OF TEXT, NOT EIGHT MESSAGES (speed step 3). The cut was a count,
 * and eight messages are four answers, every block of each parsed before the
 * first paint where the screen shows the end of the last one: on a chat of
 * long answers the opening frame drew four times the text it showed. The cut
 * now stops once the text drawn covers about two screens, the one the reader
 * lands on and the one a first scroll up reaches (open-tail.ts; a tool chain
 * or a handover draws its titles and counts no text), so the opening frame's
 * parse is bounded by the screen and not by the chat. A chat of short
 * messages still draws up to eight. The groups the first frame draws are the
 * newest, so they are never virtualized (UNVIRTUALIZED_TAIL) and the frame is
 * measured, not estimated, whatever its size.
 *
 * NOT useDeferredValue: a Next navigation is itself a transition, and inside a
 * transition useDeferredValue returns the full value at once, so the whole
 * chat still drew before the move (measured: 1.82-1.92 s became 1.48-1.56 s on
 * the long chat, the short and medium chats unchanged).
 *
 * THE OPEN STARTS WITH THE FIRST MESSAGES, NOT THE MOUNT. A cold open mounts
 * this list over a skeleton, before the transcript is here. The rest used to
 * follow two frames after the mount, so by the time the history landed the
 * list was already drawing everything, and the whole chat drew in the frame the
 * skeleton went. The two frames now count from the commit that first has
 * messages, so a cold open draws the newest first as well.
 *
 * The cut never falls inside a tool chain or a handover group (open-tail.ts),
 * so every row of the first frame stays mounted when the rest arrives.
 */
const OPEN_TAIL_MESSAGES = 8;
/** About two phone screens of prose: a screen holds about 1,500 characters. */
const OPEN_TAIL_CHARS = 3_000;
const OPEN_TAIL: OpenTailLimit = { messages: OPEN_TAIL_MESSAGES, chars: OPEN_TAIL_CHARS };

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server — React warns that a
 * layout effect does nothing during SSR, and the conversation screen does server-
 * render (with an empty transcript, so the browser branch is the only one that ever
 * has work to do). Resolved ONCE at module scope, so the hook call site below is
 * unconditional and rules-of-hooks holds.
 */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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
  /**
   * Told when the reader scrolls away from the bottom (true) and back (false),
   * the same moments the "Latest" pill appears and leaves. The screen uses it
   * to fold away the composer's country chip, which otherwise floats over the
   * text the reader scrolled up to read (#16, Stay's option 2, 4 October 2026).
   */
  onScrolledUpChange?: (scrolledUp: boolean) => void;
  /** Name who asked each user turn: a space chat on a server with B4. */
  showAuthors: boolean;
  /** The server-verified viewer, whose own turns read "You". */
  viewerId: number | null;
  /** The activity row's resting label while a colleague's turn runs. */
  restingLabel?: string;
  /** When that colleague's turn started (epoch ms): the row's clock runs from
   *  it rather than from the rows this screen drew. */
  heldSince?: number | null;
}

export function MessageList({
  messages: latestMessages,
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
  onScrolledUpChange,
  showAuthors,
  viewerId,
  restingLabel,
  heldSince = null,
}: MessageListProps) {
  // What this render draws (see OPEN_TAIL): until the first frame has been
  // painted, the newest messages only; from then on, all of them. Everything
  // below reads this list, so the scroll and pill logic always describe what
  // is on the page.
  const [showAll, setShowAll] = useState(false);
  // The transcript fades in only when this list mounted while the history was
  // still loading (a cold open: it replaces a skeleton). Opened from memory,
  // it fading in from 0 meant a blank page for a moment under a composer that
  // was already solid (frame strip, 8 October 2026). Read once, at mount.
  const [fadeIn] = useState(() => isLoadingHistory);
  const openTail = useMemo(() => splitOpenTail(latestMessages, OPEN_TAIL), [latestMessages]);
  const messages = showAll ? latestMessages : openTail.newest;
  // A chat with messages left to fill in above the first frame sits at the
  // bottom of the scroller, so the older messages arriving above never move
  // the text the reader is looking at. A chat drawn whole in its first frame
  // keeps its top-down layout.
  const anchorBottom = openTail.older.length > 0;
  const hasMessages = latestMessages.length > 0;
  useEffect(() => {
    // Counted from the first commit with messages (see OPEN_TAIL).
    if (!hasMessages) return;
    // Two frames: the first runs before the opening frame is painted, the
    // second after it, so the move is always on screen before the rest draws.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => startTransition(() => setShowAll(true)));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [hasMessages]);
  // The open is over one frame after the commit that drew the whole chat
  // with its messages in it (on a cold open, the history arriving). Until
  // then a long answer that mounts may parse its last blocks first and the
  // rest right after (markdown/defer-plan.ts); a row that mounts later, where
  // the reader may be looking, parses whole.
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!showAll || !hasMessages) return;
    const frame = requestAnimationFrame(() => setOpened(true));
    return () => cancelAnimationFrame(frame);
  }, [showAll, hasMessages]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const messagesLenRef = useRef(messages.length);
  const followRafRef = useRef<number | null>(null);
  /** Where the list's own last scroll left the view (`scrollOwn`), so the
   *  scroll event that write fires never reads as the reader moving away. */
  const ownScrollTopRef = useRef<number | null>(null);
  /** Where the last scroll event found the view, so a shrink's clamp can be
   *  told from the reader's own scroll (`clampedToBottom`). */
  const lastScrollTopRef = useRef<number | null>(null);

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
  const activityStart = heldSince ?? streamStartTime;
  const lastGroupIndex = groups.length - 1;
  /** Off-screen groups are only estimated where the browser can keep the
   *  reader's place while the estimate is corrected. See the module. */
  const canAnchor = useScrollAnchoring();
  /**
   * What the answers need to defer blocks on this open and keep the reader's
   * place when they swap (markdown/scroll-keep-context.ts). The open lands at
   * the bottom (the layout effect below); a reader who has scrolled away
   * before a row mounts, or a turn still running, means that row parses whole.
   */
  const landsAtBottom = openDefersBlocks({
    opened,
    scrolledUp: detachedAt !== null,
    turnRunning: isStreaming,
  });
  const scrollKeep = useMemo<ScrollKeep>(
    () => ({
      scrollerRef: scrollRef,
      atBottomRef,
      anchoring: canAnchor,
      landsAtBottom,
      keepPlace: (fix) => {
        const el = scrollRef.current;
        if (!el) return;
        scrollOwn(el, ownScrollTopRef, fix === 'bottom' ? el.scrollHeight : el.scrollTop + fix);
      },
    }),
    [canAnchor, landsAtBottom],
  );
  /**
   * WHILE A TURN IS RUNNING, THIS ROW IS ALWAYS ON (owner, July 25: "as long as it's
   * still streaming that part should always show").
   *
   * It used to also require narration, or a last message that was not an assistant
   * row. Both extra terms were wrong once the model started writing: the controller
   * expires narration after 8s (NARRATION_TTL_MS) so the calm line can fall back to
   * its resting label — but that fallback never got a chance, because the expiry
   * flipped this condition false and took the ORB with it. The row vanished
   * mid-answer, which is exactly when the reader most wants to know work is still
   * happening.
   *
   * `ActivityStatus` already renders the resting label when narration is null, so
   * the TTL now does what its own docstring says instead of hiding the region.
   */
  const showActivity = isStreaming;

  /**
   * WHERE THE ACTIVITY ROW GOES — above the answer, not below it (owner, July 25).
   *
   * It used to render after every group, so once the model began writing, the orb
   * and its narration sat UNDER the growing text and were shoved further down the
   * page by every token. The indicator for the work chased its own output.
   *
   * It now sits immediately BEFORE the answer being written: anchored under the tool
   * steps that produced it, with the text growing beneath it. When no answer has
   * started yet (tools still running) that same rule puts it last, which is still
   * "immediately above where the answer will appear" — one rule, both cases.
   *
   * `groups.length` means "after everything"; any smaller index means "before that
   * group". `-1` is "not shown".
   */
  const lastGroup = groups[lastGroupIndex];
  // The answer BEING WRITTEN, not any assistant row: in a space chat the screen
  // can follow a colleague's turn while the transcript still ends with the
  // finished answer to an earlier question (Spaces F4), and the row belongs
  // after that answer, not above it. The engine's placeholder carries
  // `isStreaming: true` until its turn ends, so the reader's own turn places
  // the row exactly as before.
  const lastGroupIsAnswer =
    lastGroup?.type === 'single' &&
    lastGroup.message.role === 'assistant' &&
    lastGroup.message.isStreaming === true;
  const activityIndex = !showActivity
    ? -1
    : lastGroupIsAnswer
      ? lastGroupIndex
      : groups.length;

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
    scrollOwn(el, ownScrollTopRef, el.scrollHeight);
  }, [messages.length]);

  // When the rest of an opened chat arrives above the first frame's messages, a
  // reader still at the bottom stays there before the browser paints. Chrome's
  // scroll anchoring would hold the place on its own; Safari has none (see
  // UNVIRTUALIZED_TAIL), and the follower below only catches up a frame later.
  useIsomorphicLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !didInitialScrollRef.current || !atBottomRef.current) return;
    scrollOwn(el, ownScrollTopRef, el.scrollHeight);
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
      if (el) scrollOwn(el, ownScrollTopRef, el.scrollHeight); // sending always scrolls into view
    }
  }, [messages]);

  // Keep pinned to the newest content while at the bottom. The observer follows a
  // pinned view's growth and adopts a clamp as the list's own position
  // (followOnResize); the pill is derived from render state (see `detachedAt`)
  // instead of being pushed from here, so it sets no state at all.
  //
  // EASED BOTTOM-FOLLOW (owner "jumpy on new line", smoothing pass 2): the old
  // instantaneous `scrollTop = scrollHeight` yanked the viewport a full line-height
  // in one frame every time the streaming text WRAPPED — smooth horizontal reveal,
  // discrete vertical hops. Growth within BOTTOM_THRESHOLD_PX lerps toward the
  // bottom over a few frames instead, so vertical follow matches the text's
  // butter; bigger growth snaps before paint. The follow only scrolls DOWN, and
  // the ease's transient gap stays under the threshold, so it never self-detaches.
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
        scrollOwn(el, ownScrollTopRef, target);
        return;
      }
      // BIG jump (history load, end-of-stream snap, card expand): SNAP. Easing a
      // >threshold gap leaves a residual the scroll handler reads as a user
      // scroll-up (its own scrollTop write fires `scroll`), detaching the pin and
      // stranding the view ~25% down with a spurious pill (round-3 review, HIGH).
      // Only the sub-line growth of normal streaming — the case the ease exists
      // for — glides.
      if (diff > BOTTOM_THRESHOLD_PX) {
        scrollOwn(el, ownScrollTopRef, target);
        return;
      }
      scrollOwn(el, ownScrollTopRef, el.scrollTop + Math.max(1, diff * 0.25));
      followRafRef.current = requestAnimationFrame(followBottom);
    };

    // A pinned view only (followOnResize): a clamp to the bottom becomes the
    // list's own position, so the clamp's scroll event never detaches; growth
    // past the threshold snaps before this frame paints; smaller growth glides.
    const observer = new ResizeObserver(() => {
      const el = scrollRef.current;
      if (!el) return;
      const next = followOnResize(el, ownScrollTopRef.current, atBottomRef.current, BOTTOM_THRESHOLD_PX);
      ownScrollTopRef.current = next.ownTop;
      if (next.snapTo !== null) {
        scrollOwn(el, ownScrollTopRef, next.snapTo);
        return;
      }
      if (next.ease && followRafRef.current == null) {
        followRafRef.current = requestAnimationFrame(followBottom);
      }
    });
    // The BORDER box: the dock's height reaches the content as bottom padding
    // (`--v2-conv-dock-h`), which leaves the content box as it was. Watching
    // that box missed every dock change: the measured height replacing the
    // 7 rem fallback on open, and the composer growing a line as the reader
    // types, which left the newest rows under the dock (Spaces F4 review S2).
    observer.observe(content, { box: 'border-box' });
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
    // Pinned by distance, or because the view sits where the list's own last
    // scroll put it and only the page under it grew; a detached view a shrink
    // clamped to the bottom stays detached (scroll-pin.ts).
    const atBottom = readsAtBottom(
      el,
      ownScrollTopRef.current,
      atBottomRef.current,
      BOTTOM_THRESHOLD_PX,
      lastScrollTopRef.current,
    );
    lastScrollTopRef.current = el.scrollTop;
    atBottomRef.current = atBottom;
    if (atBottom) {
      if (detachedAt !== null) onScrolledUpChange?.(false);
      setDetachedAt(null);
    } else if (detachedAt === null) {
      // Only the FIRST scroll away sets the mark — later scrolls while already
      // detached must not keep resetting it, or the count would never grow.
      setDetachedAt(messages.length);
      onScrolledUpChange?.(true);
    }
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    // A detached reader a shrink clamped to the bottom is already there, so a
    // scroll to it moves nothing and fires no event: re-attach here instead.
    if (nearBottom(el)) {
      atBottomRef.current = true;
      ownScrollTopRef.current = el.scrollTop;
      lastScrollTopRef.current = el.scrollTop;
      if (detachedAt !== null) onScrolledUpChange?.(false);
      setDetachedAt(null);
      return;
    }
    // Otherwise the scroll's events run handleScroll, which resets the pill.
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="v2-quiet-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {/* Bottom padding clears the FLOATING composer that ConversationScreen lays
            over this scroll region (the pill is absolute/out-of-flow, so the transcript
            must reserve room for its last message to scroll clear of it). The height is
            measured live into `--v2-conv-dock-h` by ConversationScreen and grows with
            the composer's staging; the fallback covers the pre-measure first paint. The
            extra 1rem is a resting gap above the pill's soft top fade. */}
        <div
          ref={contentRef}
          className={cn(
            'mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-6 pb-[calc(var(--v2-conv-dock-h,7rem)+1rem)]',
            anchorBottom && 'min-h-full justify-end',
          )}
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
            <ScrollKeepContext.Provider value={scrollKeep}>
              <div
                className={cn(
                  'flex flex-col gap-6',
                  fadeIn && 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
                )}
              >
                {groups.map((group, gi) => (
                  <Fragment key={groupKey(group, gi)}>
                    {gi === activityIndex && (
                      <ActivityRow startTime={activityStart} narration={narration} restingLabel={restingLabel} />
                    )}
                    <GroupRow
                      group={group}
                      // The last few groups are never virtualized — see
                      // UNVIRTUALIZED_TAIL. They are the screenful the reader lands
                      // on, so they must be MEASURED, not estimated, or the view
                      // settles under them after the first paint.
                      virtualize={canAnchor && gi < lastGroupIndex - UNVIRTUALIZED_TAIL}
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
                      showAuthor={showAuthors}
                      viewerId={viewerId}
                    />
                  </Fragment>
                ))}
                {/* `activityIndex === groups.length` — nothing is being written yet, so
                    the row sits after the last group, which is still immediately above
                    where the answer will appear. */}
                {activityIndex === groups.length && (
                  <ActivityRow startTime={activityStart} narration={narration} restingLabel={restingLabel} />
                )}
              </div>
            </ScrollKeepContext.Provider>
          )}

          {/* The one case the in-list placements cannot cover: activity with no
              groups at all (a turn whose first event is narration). */}
          {groups.length === 0 && showActivity && (
            <ActivityRow startTime={activityStart} narration={narration} restingLabel={restingLabel} />
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

/** The activity row's own entrance, shared by the three places it can be placed. */
function ActivityRow({
  startTime,
  narration,
  restingLabel,
}: {
  startTime: number | null;
  narration: string | null;
  restingLabel?: string;
}) {
  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <ActivityStatus startTime={startTime} narration={narration} restingLabel={restingLabel} />
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
  showAuthor,
  viewerId,
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
  showAuthor: boolean;
  viewerId: number | null;
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
      body = <UserMessageRow message={message} showAuthor={showAuthor} viewerId={viewerId} />;
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

'use client';

import {
  Fragment,
  memo,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { ArrowDown, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  isErrorMessage,
  isEventMessage,
  type ConversationReference,
  type ErrorMessage,
  type MessageReplyTo,
} from '@/types/chat';
import type { EngineMessage, StreamingSource } from '@/v2/runtime/chat-engine';
import { turnRowCount } from '@/v2/runtime/turn-rows';
import { useScrollAnchoring } from '@/v2/runtime/scroll-anchoring';
import { groupMessages, isLineGroup, lastTurnGroupIndex, type MessageGroup } from './message-groups';
import { computeStreamStart } from './stream-start';
import { splitOpenTail, type OpenTailLimit } from './open-tail';
import { UserMessageRow } from './rows/UserMessageRow';
import { AssistantMessageRow } from './rows/AssistantMessageRow';
import { DaySeparator } from './rows/DaySeparator';
import { LawexaAnswerMark } from './rows/LawexaAnswerMark';
import { dayLabel, useNowMinute } from './day-label';
import { spaceMarks } from './space-marks';
import { HandoverRow } from './rows/HandoverRow';
import { ErrorRow } from './rows/ErrorRow';
import { EventLineRow } from './rows/EventLineRow';
import { CompactToolChain } from './tools/CompactToolChain';
import { CreatedQuizCards } from './cards/CreatedQuizCard';
import { isFileListStep } from './files/chat-files';
import { ChatFileListCard } from './files/ChatFileListCard';
import { runningSteps } from './tools/running-steps';
import { ActivityStatus } from './ActivityStatus';
import { ReferenceChips } from './ReferenceChips';
import { TranscriptSkeleton } from './skeletons';
import { openDefersBlocks } from './markdown/defer-plan';
import { ScrollKeepContext, type ScrollKeep } from './markdown/scroll-keep-context';
import { followOnResize, nearBottom, readsAtBottom } from './scroll-pin';
import { quoteTone, savedIdOf, type QuoteTone } from './reply-target';
import { TurnActionsSheet, type HeldTurn } from './rows/TurnActionsSheet';

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

/** How long a message a jump lands on stays washed (the channel feed's length). */
const FLASH_MS = 1200;

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
  /** When the reader sent their running turn, in a redacted chat only: the
   *  clock runs from it, so the redaction wait before the stream counts. */
  sentAt?: number | null;
  /** A redacted chat: each question shows "Sent as redacted" and what was hidden. */
  redacted?: boolean;
  /** The chat's own heading (title and space) at the top of the transcript,
   *  where a list page carries its title; scrolls away with the messages. */
  masthead?: ReactNode;
  /** Each person's colour index in a space chat, by uuid (member-colour.ts);
   *  null on a personal chat, whose bubbles stay plain. */
  memberColours?: ReadonlyMap<string, number> | null;
  /** The reader's uuid, for the turns this client drew (they carry no author). */
  viewerUuid?: string | null;
  /** The transcript starts at the screen's top on a chat route, so its scroller
   *  passes under the open bar (shell.css `.v2-shell[data-v2-chat]`); false when
   *  something sits above it (the confidential banner). */
  underBar?: boolean;
  /**
   * Make a message the reply target (the composer's quote bar). Null where the
   * reader cannot reply: a personal chat, or a reader who may not send. Must be
   * a stable function: every row receives it.
   */
  onReply?: ((target: MessageReplyTo) => void) | null;
  /** A message to scroll to and flash once the chat has opened (`/c/{id}?m={id}`). */
  jumpTo?: number | null;
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
  sentAt = null,
  redacted = false,
  masthead = null,
  underBar = false,
  memberColours = null,
  viewerUuid = null,
  onReply = null,
  jumpTo = null,
}: MessageListProps) {
  // A user turn's colour: its author's, or the reader's own for the row this
  // client drew. A withheld or missing author has none.
  const colourOf = (message: EngineMessage): number | null => {
    if (!memberColours || message.role !== 'user') return null;
    const uuid = message.drawnHere ? viewerUuid : message.author?.uuid;
    return uuid ? (memberColours.get(uuid) ?? null) : null;
  };
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
   * GO TO A MESSAGE (a reply's quote, a notification's `?m=`): scroll it to the
   * middle of the view and wash it for {@link FLASH_MS}, as the channel feed's
   * `flashMessage` does. The wash is a DOM stamp (`data-flash`), not state, so
   * no memoised row re-renders for it. The scroll is the reader's as far as the
   * list is concerned: it leaves the bottom, so "Latest" offers the way back.
   * False when the message is not on the page.
   */
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpToMessage = useCallback((messageId: number, options?: { instant?: boolean }) => {
    const root = scrollRef.current;
    const row = root?.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
    if (!root || !row) return false;
    // Off the bottom before the scroll, not after its event: a row that grows
    // meanwhile (an answer's deferred blocks parsing, a colour arriving) would
    // otherwise snap a still-pinned view back to the bottom (rendered check,
    // 14 October 2026: `?m=` landed at the bottom in Chromium).
    atBottomRef.current = false;
    if (followRafRef.current != null) {
      cancelAnimationFrame(followRafRef.current);
      followRafRef.current = null;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const smooth = !options?.instant && !reduced;
    row.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
    // Rows above the tail are sized by estimate until they draw (GroupRow's
    // `content-visibility`), so a long smooth scroll can end beside the row:
    // once it has stopped, centre it once more, without animation.
    if (smooth) {
      root.addEventListener('scrollend', () => row.scrollIntoView({ block: 'center', behavior: 'auto' }), { once: true });
    }
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    for (const other of root.querySelectorAll('[data-flash]')) other.removeAttribute('data-flash');
    row.setAttribute('data-flash', '');
    flashTimerRef.current = setTimeout(() => {
      row.removeAttribute('data-flash');
      flashTimerRef.current = null;
    }, FLASH_MS);
    return true;
  }, []);
  const jumpFromQuote = useCallback((messageId: number) => void jumpToMessage(messageId), [jumpToMessage]);
  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  /** The question a long press opened the actions sheet for (touch). */
  const [held, setHeld] = useState<HeldTurn | null>(null);
  const closeSheet = useCallback(() => setHeld(null), []);
  const replyFromSheet = useCallback((target: MessageReplyTo) => onReply?.(target), [onReply]);

  // A notification's `?m=`: once the chat has opened at the bottom and every
  // row is drawn, go to that message, once per target. A chat opened from the
  // device's copy may not have it yet: the try repeats as rows arrive (the
  // server's newer ones), as the channel feed's deep link does. A message no
  // longer in the chat leaves the reader at the bottom.
  const jumpedToRef = useRef<number | null>(null);
  const rowCount = latestMessages.length;
  useEffect(() => {
    if (!opened || jumpTo === null || jumpedToRef.current === jumpTo) return;
    const frame = requestAnimationFrame(() => {
      if (jumpToMessage(jumpTo, { instant: true })) jumpedToRef.current = jumpTo;
    });
    return () => cancelAnimationFrame(frame);
  }, [opened, jumpTo, jumpToMessage, rowCount]);

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
  //
  // It counts TURNS, never lines: a draft's "edited" line (Stay, 30 October
  // 2026, 02:16Z, thread 1e44eb39) is not a new message, so `detachedAt` holds
  // the turn count and the pill subtracts from the turn count.
  const [detachedAt, setDetachedAt] = useState<number | null>(null);
  const turnCount = useMemo(() => turnRowCount(messages), [messages]);
  const showPill = detachedAt !== null;
  const pillCount = detachedAt === null ? 0 : Math.max(0, turnCount - detachedAt);

  // Keyed on the (structurally stable) messages reference — stable group objects
  // across token flushes and unrelated parent re-renders, so GroupRow's memo holds.
  const groups = useMemo(() => groupMessages(messages), [messages]);
  // A space chat's date separators and Lawexa marks (space-marks.ts); a
  // personal chat draws neither.
  const marks = useMemo(() => (showAuthors ? spaceMarks(groups) : null), [groups, showAuthors]);
  const nowMinute = useNowMinute();
  const streamStartTime = useMemo(() => computeStreamStart(messages), [messages]);
  const activityStart = heldSince ?? sentAt ?? streamStartTime;
  const lastGroupIndex = groups.length - 1;
  // The last TURN's group: a line after the answer (a draft's "edited" line)
  // leaves the answer being written, its "Ask again" and the working row where
  // they were.
  const lastTurnIndex = lastTurnGroupIndex(groups);
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
  const lastGroup = groups[lastTurnIndex];
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
      ? lastTurnIndex
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
      setDetachedAt(turnCount);
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
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      data-v2-chat-list=""
      data-under-bar={underBar ? '' : undefined}
    >
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        data-v2-chat-scroller=""
        // `relative`: the transcript's own absolutely placed nodes (the author
        // line's sr-only "Asked by …") take THIS scroller as their containing
        // block, so it clips them. Without it they escaped to the next scroll
        // container, the shell's content region, and made it scroll: the whole
        // chat could be dragged up the screen (real-server pass 10, 13 October
        // 2026: the region at 3528 px in a 664 px view).
        className="v2-quiet-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
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
          {/* The chat's heading, for screen readers only (ConversationMasthead).
              No wrapper: an in-flow box would take a row of the column and its
              `gap-6`, pushing the first message down. */}
          {masthead}

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
                    {marks?.[gi]?.day ? <DaySeparator label={dayLabel(marks[gi].day, nowMinute)} /> : null}
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
                      isLastGroup={gi === lastTurnIndex}
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
                      viewerUuid={viewerUuid}
                      colourIndex={group.type === 'single' ? colourOf(group.message) : null}
                      quoteTone={
                        group.type === 'single' && group.message.role === 'user' && group.message.replyTo
                          ? quoteTone(group.message.replyTo, memberColours)
                          : 'plain'
                      }
                      answerMark={marks?.[gi]?.answer ?? null}
                      onReply={onReply}
                      onJump={jumpFromQuote}
                      onHold={setHeld}
                      redacted={redacted}
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

      {/* One actions sheet for the transcript, opened by a long press on a
          question (touch). Only where the reader can reply. */}
      {onReply && <TurnActionsSheet held={held} onReply={replyFromSheet} onClose={closeSheet} />}
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
  viewerUuid,
  colourIndex,
  quoteTone: quoteColour,
  answerMark,
  onReply,
  onJump,
  onHold,
  redacted,
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
  viewerUuid: string | null;
  /** A user turn's member colour in a space chat (member-colour.ts), or null. */
  colourIndex: number | null;
  /** The colour of the message a reply quotes. */
  quoteTone: QuoteTone;
  /** In a space chat, where an answer starts: Lawexa's mark with this time. */
  answerMark: Date | null;
  onReply: ((target: MessageReplyTo) => void) | null;
  onJump: (messageId: number) => void;
  onHold: (held: HeldTurn) => void;
  /** A redacted chat: each question carries its "Sent as redacted" line. */
  redacted: boolean;
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
    // A quiz Lawexa made shows as a card after the chain, so the reader sees
    // it without opening the step (quiz from a source, 23 October 2026).
    // In a running turn, a stored step with no result yet is still running
    // (running-steps.ts), so it reads "Making a quiz", not stopped. A refusal
    // shows no card when a later step in the answer made the quiz.
    const steps = runningSteps(group.messages, isStreaming && isLastGroup);
    // The files a step listed show as one card each (the file list in chat,
    // piece a; Stay, 23 October 2026): a tap opens one in the side panel.
    const fileSteps = steps.filter(isFileListStep);
    body = (
      <>
        <CompactToolChain messages={steps} />
        <CreatedQuizCards steps={steps} />
        {fileSteps.map((step) => (
          <ChatFileListCard key={step.id} message={step} />
        ))}
      </>
    );
  } else {
    const message = group.message;
    if (isEventMessage(message)) {
      body = <EventLineRow line={message} />;
    } else if (isErrorMessage(message)) {
      body = (
        <ErrorRow message={message as ErrorMessage} onRetry={onRetry} isStreaming={isStreaming} />
      );
    } else if (message.role === 'user') {
      body = (
        <UserMessageRow
          message={message}
          showAuthor={showAuthor}
          viewerId={viewerId}
          viewerUuid={viewerUuid}
          colourIndex={colourIndex}
          quoteTone={quoteColour}
          onReply={onReply}
          onJump={onJump}
          onHold={onHold}
          redacted={redacted}
        />
      );
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
          onReply={onReply}
        />
      );
    }
  }

  // A question or an answer is found by its saved id (a reply's quote, `?m=`).
  // A line is never a reply's target, so it carries no id to jump to.
  const messageId = group.type === 'single' && !isLineGroup(group) ? savedIdOf(group.message) : null;
  return (
    <div
      style={style}
      data-message-id={messageId ?? undefined}
      // The jump's wash: `jumpToMessage` stamps `data-flash` on this node, and
      // the transition plays the fade both ways. -mx/px keep the content where it was.
      className="-mx-2 rounded-2xl px-2 transition-colors duration-500 data-flash:bg-primary/10 motion-reduce:transition-none"
    >
      {answerMark ? <LawexaAnswerMark time={answerMark} /> : null}
      {body}
    </div>
  );
});

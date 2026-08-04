'use client';

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowDown, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Channel, Message } from '@/types/collab';
import type { ChannelReadReporter } from '@/v2/features/channels/mark-read';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import {
  buildFeedItems,
  flattenMessages,
  mergeOutboxRows,
  newestRealMessageUuid,
  unreadAnchorUuid,
} from '../feed-model';
import {
  useToggleReaction,
  useTogglePin,
  useToggleSave,
} from '../engagement-mutations';
import {
  anchoredTurns,
  unanchoredTurns,
  type RespondingTurn,
} from '../lawexa/turns';
import { useEditChannelMessage, useDeleteChannelMessage, useSendChannelMessage, useDiscardFailedMessage } from '../message-mutations';
import { canManageChannel, isLocalMessageUuid } from '../model';
import { channelsQueries } from '../queries';
import { outboxGet, useOutboxMessages } from '../send-outbox';
import type { TypingUser } from '../room';
import { ChannelFeedSkeleton, FeedErrorState, FeedEmptyState } from '../screen/states';
import { MessageActionsSheet } from './MessageActionsSheet';
import { MessageGroupRow } from './MessageGroupRow';
import type { MessageRowActions } from './MessageRow';
import { QuizGameCard } from './QuizGameCard';
import { RespondingRow } from './RespondingRow';
import { DaySeparator, UnreadDivider } from './separators';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * ChannelFeed — the member-only transcript: day separators, author runs, the
 * gold unread divider with land-at-line, the jump-to-latest pill, `?m=`
 * deep-link landing, the send ladder's row actions, and the mark-read
 * viewport trigger. Phase-5 W2; sources: plan W2 item 3,
 * foundation-standards §5 (scroll etiquette + mark-read triggers),
 * design-research DIRECTIONS 3/9/10/11 (binding) — 2026-08-04.
 *
 * SCROLL CONTRACT (the conversation screen's proven mechanics, ported):
 *  - the FIRST paint lands where the reader should start — the `?m=` target,
 *    else the unread divider, else the bottom — set in a LAYOUT effect so no
 *    wrong-end frame ever draws;
 *  - "Load older" prepends preserve the reading position exactly
 *    (height-delta restore);
 *  - auto-follow only while at the bottom (~80px), via an eased rAF follower
 *    that snaps on big jumps; any upward scroll disengages instantly;
 *  - new messages NEVER move focus or the viewport when detached — they only
 *    grow the pill's count (messages since detach, derived in render);
 *  - the reader's own send always scrolls into view.
 *
 * MARK-READ (§5, via the W1 hook — this feed only REPORTS): a bottom
 * sentinel's visibility gates `reportNewestVisible(newestRealUuid)`; the
 * dwell/visibility logic lives in `useChannelReadPointer`. Esc marks read
 * now; the jump pill's click marks read now; the send trigger is wired by
 * the screen through the composer.
 *
 * A11Y (DIRECTION 11, acceptance criteria): the transcript is a PRE-MOUNTED
 * `role="log"` polite region (it exists before any message arrives, so
 * arrivals announce); rows are APG feed articles — `aria-posinset`/
 * `aria-setsize` over author runs, `aria-busy` while a page loads, PageUp/
 * PageDown move focus between articles, Ctrl+Home/End jump to the ends. New
 * arrivals never move focus (nothing here focuses on data).
 *
 * DEEP LINKS (`?m=`, W1 carry-forward N5): the target is flash-washed via a
 * DOM `data-flash` attribute (no React state — rows stay memo-stable and the
 * wash can't re-render the list). A target older than the loaded pages pulls
 * up to {@link TARGET_FETCH_PAGE_CAP} older pages before giving up silently —
 * mention deep-links overwhelmingly point into the newest page.
 *
 * W3 ADDITIONS:
 *  - ENGAGEMENT: react / pin / save dispatchers join the stable row-actions
 *    object, so the hover cluster and the touch sheet drive one set of
 *    mutations (`../engagement-mutations.ts` owns the optimism and the quiet
 *    429 handling).
 *  - LAWEXA: `respondingTurns` splice a "responding" row under the message
 *    that summoned each one; turns whose event carried no `message_uuid`
 *    (digest §F.7) render at the FOOT of the transcript instead, above the
 *    mark-read sentinel. Watching is feed-local single-slot state — one glance
 *    at a time keeps the transcript readable, and the panel is lazy anyway.
 *  - JUMP HANDLE: {@link ChannelFeedHandle} lets the screen's pinned/saved
 *    panels land on a message. It reuses the SAME bounded page-pull the `?m=`
 *    deep link uses, so a pin from last week resolves exactly like a
 *    notification link — and, unlike a URL write, it costs no navigation and
 *    can't fight the router's cached search params.
 */

const BOTTOM_THRESHOLD_PX = 80;
const UNVIRTUALIZED_TAIL = 3;
const FLASH_MS = 1600;
const TARGET_FETCH_PAGE_CAP = 5;

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** What the screen can ask the feed to do imperatively (panels + deep jumps). */
export interface ChannelFeedHandle {
  /** Scroll to a message and wash it. Pulls older pages when it isn't loaded,
   *  and gives up silently rather than erroring on a stale target. */
  jumpToMessage: (messageUuid: string) => void;
}

export interface ChannelFeedProps {
  channel: Channel;
  viewerId: number | null;
  viewerUuid: string | null;
  reporter: ChannelReadReporter;
  /** False while another tab covers the feed (the pane stays mounted but
   *  invisible) — gates the mark-read report: an invisible newest message is
   *  NOT "in the viewport" (§5's clause, taken literally). */
  active: boolean;
  /** `?m=` deep-link target (navigation-time value; prop changes re-arm). */
  targetMessageUuid: string | null;
  typingUsers: readonly TypingUser[];
  /** Live Lawexa summons in this channel (room-owned; stable reference). */
  respondingTurns: readonly RespondingTurn[];
  /** Imperative handle for the pinned/saved panels' "jump to message". */
  ref?: React.Ref<ChannelFeedHandle>;
  /** The floating composer (or the non-member notice) — the feed positions
   *  it in its bottom overlay and reserves transcript clearance for it. */
  composer: React.ReactNode;
  /** Stage a reply in the composer (screen-owned state). */
  onStartReply: (message: Message) => void;
  /** The empty state's one action: focus the composer (DIRECTION 13). */
  onFocusComposer: () => void;
  /** Open the sessions sheet on one session (screen-owned surface). */
  onViewAiSession: (sessionUuid: string) => void;
  /** Open the channel's live-quiz mode on a game (screen-owned `?game=`) —
   *  the quiz system cards' Join / results action (W6). */
  onOpenGame: (gameUuid: string) => void;
}

export function ChannelFeed({
  channel,
  viewerId,
  viewerUuid,
  reporter,
  active,
  targetMessageUuid,
  typingUsers,
  respondingTurns,
  composer,
  onStartReply,
  onFocusComposer,
  onViewAiSession,
  onOpenGame,
  ref,
}: ChannelFeedProps) {
  const {
    data,
    isPending,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery(
    channelsQueries.messages({ channelUuid: channel.uuid, viewerId }),
  );

  const editMutation = useEditChannelMessage(channel.uuid);
  const deleteMutation = useDeleteChannelMessage(channel.uuid);
  const retryMutation = useSendChannelMessage(channel.uuid);
  const discardFailed = useDiscardFailedMessage(channel.uuid);
  const reactionMutation = useToggleReaction(channel.uuid);
  const pinMutation = useTogglePin(channel.uuid);
  const saveMutation = useToggleSave(channel.uuid);

  /* ── The transcript = cache pages + any outbox rows a refetch evicted.
        The cache is refetchable state (join-time reconcile, reconnect
        invalidation) and server pages can never contain an unacknowledged
        row — the outbox is that row's durable home, merged back here so a
        background refetch can NEVER silently drop an unsent message (§5's
        ban, structurally enforced). Cache-present rows are not duplicated,
        and the merge is CHRONOLOGICAL (audit L13) so a failed send keeps the
        place it was written in instead of drifting to the end. ─────────────── */
  const cachedMessages = useMemo(() => flattenMessages(data?.pages), [data]);
  const outboxRows = useOutboxMessages(channel.uuid);
  const messages = useMemo(
    () => mergeOutboxRows(cachedMessages, outboxRows),
    [cachedMessages, outboxRows],
  );
  const newestReal = useMemo(
    () => newestRealMessageUuid(messages, isLocalMessageUuid),
    [messages],
  );

  /* ── The unread anchor, captured ONCE at open (§5: persists for the view
        session). Guarded render-adjust — React's sanctioned form — because
        it must exist in the SAME render the divider first draws in, so the
        landing layout-effect can find the element. ───────────────────────── */
  const [anchor, setAnchor] = useState<{ uuid: string | null } | null>(null);
  if (anchor === null && messages.length > 0) {
    setAnchor({ uuid: unreadAnchorUuid(messages, channel.unread_count ?? 0) });
  }

  /* ── Lawexa turns: anchored under their summon, or (when the event omitted
        `message_uuid` — digest §F.7) at the foot of the transcript. Both maps
        are derived, so a turn ending removes its row with no other state. ── */
  const anchoredByMessage = useMemo(
    () => anchoredTurns(respondingTurns),
    [respondingTurns],
  );
  const floatingTurns = useMemo(
    () => unanchoredTurns(respondingTurns),
    [respondingTurns],
  );
  /** Which turn's live stream the reader is watching — one at a time, and a
   *  lingering id whose turn has ended simply matches nothing (that IS the
   *  auto-hide; no effect needed to clear it). */
  const [watchedExecutionId, setWatchedExecutionId] = useState<string | null>(null);
  const toggleWatch = useCallback((executionId: string) => {
    setWatchedExecutionId((current) =>
      current === executionId ? null : executionId,
    );
  }, []);

  // Items carry their APG article ordinal (1-based) so no counter mutates
  // during render (React Compiler immutability rule).
  const { renderItems, groupCount } = useMemo(() => {
    const items = buildFeedItems(messages, anchor?.uuid ?? null, anchoredByMessage);
    const withOrdinals: { item: (typeof items)[number]; groupOrdinal: number }[] = [];
    let ordinal = 0;
    for (const item of items) {
      if (item.kind === 'group') ordinal += 1;
      withOrdinals.push({ item, groupOrdinal: item.kind === 'group' ? ordinal : 0 });
    }
    return { renderItems: withOrdinals, groupCount: ordinal };
  }, [messages, anchor, anchoredByMessage]);

  /* ── Refs for the scroll contract ─────────────────────────────────────── */
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const didInitialScrollRef = useRef(false);
  /** A history pull in flight: the viewport's distance from the CONTENT
   *  BOTTOM at request time. Bottom-anchored (not the old-scrollHeight
   *  delta, which was only correct at scrollTop 0 — audit H3), restored in a
   *  layout effect when the fetch settles, and it suppresses the follower
   *  while armed so a mid-pull resize can never teleport the view. */
  const pendingRestoreRef = useRef<number | null>(null);
  const atBottomRef = useRef(true);
  const followRafRef = useRef<number | null>(null);
  const messagesLenRef = useRef(messages.length);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Jump pill: a TIME watermark captured at detach (audit H1). The count
        is "messages strictly newer than the newest message the reader had
        when they looked away" — so a history PREPEND (older by definition)
        can never inflate it, only genuine arrivals count (DIRECTION 10). ── */
  const [detachedWatermark, setDetachedWatermark] = useState<number | null>(null);
  const showPill = detachedWatermark !== null;
  const pillCount = useMemo(() => {
    if (detachedWatermark === null) return 0;
    // Chronological list: scan from the newest end and stop at the first
    // message at/before the watermark — O(new arrivals), not O(history).
    let count = 0;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (!(Date.parse(messages[i].created_at) > detachedWatermark)) break;
      count += 1;
    }
    return count;
  }, [messages, detachedWatermark]);

  /* ── Feed-owned row interaction state ─────────────────────────────────── */
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  /** The long-pressed row, held by UUID rather than by value: the sheet shows
   *  live toggle state (saved / pinned / reacted), so it must read the CURRENT
   *  cached row — a captured object would freeze the moment of the press and
   *  show a stale "Save" after the save landed. It also closes itself when the
   *  message is deleted out from under it. */
  const [sheetMessageUuid, setSheetMessageUuid] = useState<string | null>(null);
  const sheetMessage = useMemo(
    () =>
      sheetMessageUuid === null
        ? null
        : (messages.find((message) => message.uuid === sheetMessageUuid) ?? null),
    [messages, sheetMessageUuid],
  );
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);

  /** Flash-wash + scroll a loaded message into view (DOM-only — no state).
   *  `instant` is the INITIAL landing's mode (audit M7): the first frames
   *  must not sweep down from the top, so the opening scroll snaps; only
   *  post-load flashes (reply jumps, late deep-link resolution) glide. */
  const flashMessage = useCallback((uuid: string, options?: { instant?: boolean }) => {
    const root = rootRef.current;
    const el = root?.querySelector<HTMLElement>(`[data-message-uuid="${CSS.escape(uuid)}"]`);
    if (!el) return false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({
      block: 'center',
      behavior: options?.instant || reduced ? 'auto' : 'smooth',
    });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    for (const other of root?.querySelectorAll('[data-flash]') ?? []) {
      other.removeAttribute('data-flash');
    }
    el.setAttribute('data-flash', '');
    flashTimerRef.current = setTimeout(() => {
      el.removeAttribute('data-flash');
      flashTimerRef.current = null;
    }, FLASH_MS);
    return true;
  }, []);

  /** Arm a history pull's position restore, bottom-anchored (audit H3). */
  const beginHistoryPull = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    pendingRestoreRef.current = el.scrollHeight - el.scrollTop;
  }, []);

  const consumedTargetRef = useRef<string | null>(null);

  /* ── Imperative jump (pinned / saved panels). A REQUEST, not a target: it
        carries a nonce so asking for the SAME message twice re-arms the
        resolver instead of being swallowed as "already consumed". It shares
        the `?m=` resolver below, so an unloaded pin pulls history exactly like
        a notification deep link.

        `fromTarget` IS THE EXPIRY, and it exists because a panel jump must not
        outlive the navigation it happened during. A request is honoured only
        while the `?m=` prop is still the value it was made against; the moment
        a LATER navigation changes that prop, the stale request is ignored and
        the new deep link wins. Without it the first panel jump would sit in
        state forever and every subsequent `?m=` arriving at this already-
        mounted channel — every mention toast, every push — would resolve to
        nothing. Expressed as a derived comparison rather than an effect that
        clears state, so there is no setState-in-effect and no ordering race
        between the clear and the next prop. ──────────────────────────────── */
  const [jumpRequest, setJumpRequest] = useState<{
    uuid: string;
    key: string;
    /** The `?m=` value in force when this jump was requested (`null` = none). */
    fromTarget: string | null;
  } | null>(null);
  const jumpNonceRef = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      jumpToMessage: (messageUuid: string) => {
        // Already on screen: flash it now, with no state change at all.
        if (flashMessage(messageUuid)) return;
        jumpNonceRef.current += 1;
        setJumpRequest({
          uuid: messageUuid,
          key: `${messageUuid}#${jumpNonceRef.current}`,
          fromTarget: targetMessageUuid,
        });
      },
    }),
    [flashMessage, targetMessageUuid],
  );

  /** What the resolver is currently chasing. A panel jump outranks the `?m=`
   *  it was made during (it is the reader's more recent intent), but a NEWER
   *  `?m=` outranks the panel jump (see `fromTarget` above). Memoised so the
   *  resolver effect keys on a CHANGE of target, not on every render — a fresh
   *  object literal would re-run it on any unrelated re-render. */
  const activeTarget = useMemo(() => {
    if (jumpRequest !== null && jumpRequest.fromTarget === targetMessageUuid) {
      return { uuid: jumpRequest.uuid, key: jumpRequest.key };
    }
    return targetMessageUuid
      ? { uuid: targetMessageUuid, key: targetMessageUuid }
      : null;
  }, [jumpRequest, targetMessageUuid]);

  /* ── First paint lands at the right place (layout effect: no wrong-end
        frame). Priority: `?m=` target (when already loaded) → unread line →
        bottom. ─────────────────────────────────────────────────────────── */
  useIsomorphicLayoutEffect(() => {
    if (didInitialScrollRef.current || messages.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    didInitialScrollRef.current = true;

    if (targetMessageUuid && flashMessage(targetMessageUuid, { instant: true })) {
      // Consumed HERE so the passive target effect below doesn't re-flash
      // the same landing (the audit's double-flash note).
      consumedTargetRef.current = targetMessageUuid;
      return;
    }

    const divider = el.querySelector<HTMLElement>('[data-unread-divider]');
    if (divider) {
      // Land AT the line: the divider sits a beat below the top so the last
      // read message is still visible above it for context.
      el.scrollTop = Math.max(0, divider.offsetTop - 96);
      atBottomRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD_PX;
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [messages.length, targetMessageUuid, flashMessage]);

  /* ── History-pull restore — LAYOUT effect (audit H3+M4): the corrected
        position must be set before paint (Safari has no scroll anchoring; a
        passive restore paints one wrong frame). Keyed to FETCH SETTLEMENT,
        not "messages changed": while `isFetchingNextPage` is true the effect
        defers, so a realtime arrival racing the pull cannot consume the
        restore; the fetch's own completion (data change, or a failure's
        fetching→false transition) executes it. Bottom-anchored math makes a
        failed pull's restore an exact no-op. ─────────────────────────────── */
  useIsomorphicLayoutEffect(() => {
    if (pendingRestoreRef.current === null || isFetchingNextPage) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight - pendingRestoreRef.current;
    pendingRestoreRef.current = null;
    atBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD_PX;
  }, [data, isFetchingNextPage]);

  /* ── Own-send scroll (passive effect, ref sync). ──────────────────────── */
  useEffect(() => {
    const el = scrollRef.current;
    const prevLen = messagesLenRef.current;
    messagesLenRef.current = messages.length;
    if (!el) return;
    const last = messages[messages.length - 1];
    if (
      last &&
      messages.length > prevLen &&
      isLocalMessageUuid(last.uuid) &&
      outboxGet(last.uuid)?.status === 'sending'
    ) {
      // Sending always scrolls into view (§5).
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  /* ── Eased bottom-follower (ported from the conversation screen). ─────── */
  useEffect(() => {
    const content = contentRef.current;
    const scroller = scrollRef.current;
    if (!content || !scroller) return;

    const followBottom = () => {
      followRafRef.current = null;
      const el = scrollRef.current;
      // Never follow while a history-pull restore is armed: the pull's
      // height growth is ABOVE the viewport, and chasing the bottom here
      // would teleport a deep-link pull into old history (audit M4).
      if (!el || !atBottomRef.current || pendingRestoreRef.current !== null) return;
      const target = el.scrollHeight - el.clientHeight;
      const diff = target - el.scrollTop;
      if (diff <= 1) {
        el.scrollTop = target;
        return;
      }
      // Big jumps snap — easing them leaves a residual the scroll handler
      // reads as a user scroll-up (spurious detach; the conversation screen's
      // round-3 HIGH). Only sub-line growth glides.
      if (diff > BOTTOM_THRESHOLD_PX) {
        el.scrollTop = target;
        return;
      }
      el.scrollTop += Math.max(1, diff * 0.25);
      followRafRef.current = requestAnimationFrame(followBottom);
    };

    const observer = new ResizeObserver(() => {
      if (!atBottomRef.current || pendingRestoreRef.current !== null) return;
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

  /* ── Composer-dock clearance, measured live (no CLS; the overlay floats
        over the transcript, so the transcript reserves its height). ──────── */
  useEffect(() => {
    const dock = dockRef.current;
    const root = rootRef.current;
    if (!dock || !root) return;
    const sync = () => {
      root.style.setProperty('--v2-chan-dock-h', `${dock.offsetHeight}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(dock);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--v2-chan-dock-h');
    };
  }, []);

  /* ── Mark-read viewport clause: a bottom sentinel reports the newest REAL
        message while it is visible; the W1 hook owns dwell + visibility. ─── */
  const [bottomVisible, setBottomVisible] = useState(false);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => setBottomVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0 },
    );
    observer.observe(node);
    // Cleanup rides the callback-ref contract: React calls with null on
    // unmount, and this closure's observer dies with the node.
    return () => observer.disconnect();
  }, []);
  const reportNewestVisible = reporter.reportNewestVisible;
  useEffect(() => {
    reportNewestVisible(active && bottomVisible ? newestReal : null);
  }, [active, bottomVisible, newestReal, reportNewestVisible]);

  /* ── Targets outside the loaded pages (`?m=` deep links AND panel jumps):
        pull older pages, bounded. Each pull is position-restored
        (`beginHistoryPull`), so the viewport holds still while pages arrive;
        giving up (no more pages, or the page cap) leaves the reader exactly
        where they were. The per-target page budget resets with each new
        request, so a second jump is not starved by the first one's spend. ── */
  const targetFetchCountRef = useRef(0);
  const budgetForKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeTarget || consumedTargetRef.current === activeTarget.key) return;
    if (messages.length === 0) return;

    if (budgetForKeyRef.current !== activeTarget.key) {
      budgetForKeyRef.current = activeTarget.key;
      targetFetchCountRef.current = 0;
    }

    if (messages.some((message) => message.uuid === activeTarget.uuid)) {
      consumedTargetRef.current = activeTarget.key;
      // Covers the post-landing arrival, a late navigation to an already-open
      // channel (the initial-scroll effect runs once), and every panel jump.
      if (didInitialScrollRef.current) flashMessage(activeTarget.uuid);
      return;
    }
    if (hasNextPage && !isFetchingNextPage && targetFetchCountRef.current < TARGET_FETCH_PAGE_CAP) {
      targetFetchCountRef.current += 1;
      beginHistoryPull();
      void fetchNextPage();
      return;
    }
    if (!hasNextPage || targetFetchCountRef.current >= TARGET_FETCH_PAGE_CAP) {
      // Give up silently — the feed stays where it is (never an error state
      // for a stale deep link or a pin older than the page budget).
      consumedTargetRef.current = activeTarget.key;
    }
  }, [
    activeTarget,
    messages,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    flashMessage,
    beginHistoryPull,
  ]);

  /* ── Scroll + keyboard handlers (event callbacks — setState allowed). ─── */
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distance <= BOTTOM_THRESHOLD_PX;
    atBottomRef.current = atBottom;
    if (atBottom) {
      setDetachedWatermark(null);
    } else if (detachedWatermark === null) {
      // Capture the newest message's moment — only strictly-newer arrivals
      // will count (prepends are older and never can; audit H1).
      const newest = messages[messages.length - 1];
      setDetachedWatermark(
        newest ? Date.parse(newest.created_at) : Number.NEGATIVE_INFINITY,
      );
    }
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (el) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
    }
    // Jump-pill click is a mark-read trigger (§5).
    if (newestReal) reporter.markReadNow(newestReal);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Esc = mark read (§5).
    if (event.key === 'Escape' && newestReal) {
      reporter.markReadNow(newestReal);
      return;
    }
    // APG feed traversal between articles (DIRECTION 11).
    const isTraversal =
      event.key === 'PageDown' ||
      event.key === 'PageUp' ||
      (event.ctrlKey && (event.key === 'Home' || event.key === 'End'));
    if (!isTraversal) return;
    const root = rootRef.current;
    if (!root) return;
    const articles = Array.from(
      root.querySelectorAll<HTMLElement>('[data-feed-article]'),
    );
    if (articles.length === 0) return;
    const active = document.activeElement;
    const currentIndex = articles.findIndex(
      (article) => article === active || article.contains(active),
    );
    let next: HTMLElement | undefined;
    if (event.ctrlKey && event.key === 'Home') next = articles[0];
    else if (event.ctrlKey && event.key === 'End') next = articles[articles.length - 1];
    else if (currentIndex === -1) return;
    else if (event.key === 'PageDown') next = articles[Math.min(currentIndex + 1, articles.length - 1)];
    else next = articles[Math.max(currentIndex - 1, 0)];
    if (next) {
      event.preventDefault();
      next.focus();
      next.scrollIntoView({ block: 'nearest' });
    }
  };

  const handleLoadOlder = () => {
    beginHistoryPull();
    void fetchNextPage();
  };

  /* ── Row actions (stable object — rows are memoised on it). ───────────── */
  const editMutate = editMutation.mutate;
  const deleteMutate = deleteMutation.mutate;
  const retryMutate = retryMutation.mutate;
  const reactionMutate = reactionMutation.mutate;
  const pinMutate = pinMutation.mutate;
  const saveMutate = saveMutation.mutate;
  const rowActions = useMemo<MessageRowActions>(
    () => ({
      onStartReply,
      onStartDelete: (message) => setDeleteTarget(message),
      onStartEdit: (message) => setEditingUuid(message.uuid),
      onCloseEdit: () => setEditingUuid(null),
      onSaveEdit: (messageUuid, content, callbacks) =>
        editMutate({ messageUuid, content }, callbacks),
      onRetrySend: (message) => {
        const entry = outboxGet(message.uuid);
        // Only a FAILED row may re-POST — a double-tap on a row whose send
        // is still in flight must not duplicate the message (audit L8).
        if (!entry || entry.status !== 'failed') return;
        retryMutate({
          content: entry.content,
          replyToUuid: entry.replyToUuid,
          retryLocalUuid: message.uuid,
        });
      },
      onDiscardFailed: discardFailed,
      onOpenActions: (message) => setSheetMessageUuid(message.uuid),
      onJumpToMessage: (messageUuid) => {
        flashMessage(messageUuid);
      },
      // Engagement never applies to an unacknowledged row — there is no server
      // uuid to address yet. The cluster is already hidden while a row is in
      // the outbox (`canAct`), so this guard is belt-and-braces for the sheet.
      onToggleReaction: (message, emoji) => {
        if (isLocalMessageUuid(message.uuid)) return;
        reactionMutate({ messageUuid: message.uuid, emoji });
      },
      onTogglePin: (message) => {
        if (isLocalMessageUuid(message.uuid)) return;
        pinMutate({ messageUuid: message.uuid, pinned: message.is_pinned !== true });
      },
      onToggleSave: (message) => {
        if (isLocalMessageUuid(message.uuid)) return;
        saveMutate({ messageUuid: message.uuid, saved: message.is_bookmarked !== true });
      },
      onViewAiSession,
    }),
    [
      onStartReply,
      editMutate,
      retryMutate,
      discardFailed,
      flashMessage,
      reactionMutate,
      pinMutate,
      saveMutate,
      onViewAiSession,
    ],
  );

  const isChannelAdmin = canManageChannel(channel);
  const sheetIsMine =
    !!sheetMessage?.author &&
    !!viewerUuid &&
    sheetMessage.author.uuid === viewerUuid;

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div ref={rootRef} className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        role="log"
        aria-label={`Messages in ${channel.name}`}
        aria-busy={isPending || isFetchingNextPage}
        className="v2-quiet-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {/* The log region is PRE-MOUNTED (it exists before any message), so
            assistive tech has the live region registered before arrivals. */}
        <div
          ref={contentRef}
          className="mx-auto flex w-full max-w-3xl flex-col px-4 pt-4 pb-[calc(var(--v2-chan-dock-h,6rem)+0.75rem)]"
        >
          {isPending ? (
            <ChannelFeedSkeleton />
          ) : isError ? (
            <FeedErrorState onRetry={() => void refetch()} />
          ) : /* WHAT RENDERS, NOT WHAT LOADED. A message can exist and still
                 draw nothing (a session reset is dropped from the feed), so a
                 channel whose only message is a reset must still offer the
                 write-the-first-message state instead of an empty column. The
                 state also CLAIMS there is no history, so it waits until there
                 is none left to fetch — with older pages outstanding the feed
                 branch renders, carrying its "Load older messages" button. */
          renderItems.length === 0 && !hasNextPage ? (
            <FeedEmptyState
              channelName={channel.name}
              description={channel.description}
              onWriteFirstMessage={onFocusComposer}
            />
          ) : (
            <div className="flex flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
              {hasNextPage ? (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadOlder}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage && (
                      <Loader2 aria-hidden className="size-4 animate-spin" />
                    )}
                    Load older messages
                  </Button>
                </div>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  This is the beginning of {channel.name}.
                </p>
              )}

              {renderItems.map(({ item, groupOrdinal }) => {
                switch (item.kind) {
                  case 'day':
                    return <DaySeparator key={item.key} label={item.label} />;
                  case 'unread':
                    return <UnreadDivider key={item.key} />;
                  case 'quiz-card':
                    return (
                      <QuizGameCard
                        key={item.key}
                        message={item.message}
                        channelUuid={channel.uuid}
                        viewerId={viewerId}
                        onOpenGame={onOpenGame}
                      />
                    );
                  case 'responding':
                    return (
                      <RespondingRow
                        key={item.key}
                        turn={item.turn}
                        watching={watchedExecutionId === item.turn.executionId}
                        // Spliced under its summon — draw it attached.
                        attached
                        onToggleWatch={toggleWatch}
                      />
                    );
                  case 'group':
                    return (
                      <MessageGroupRow
                        key={item.key}
                        author={item.author}
                        isAi={item.isAi}
                        messages={item.messages}
                        posinset={groupOrdinal}
                        setsize={groupCount}
                        virtualize={groupOrdinal <= groupCount - 1 - UNVIRTUALIZED_TAIL}
                        viewerUuid={viewerUuid}
                        isChannelAdmin={isChannelAdmin}
                        editingUuid={editingUuid}
                        actions={rowActions}
                      />
                    );
                }
              })}

              {/* Turns whose `.ai.turn_started` carried no `message_uuid`
                  (digest §F.7's contradiction) can't be anchored, so they
                  queue here at the foot of the transcript — a designed
                  fallback, in summon order, not a degraded anchor. */}
              {floatingTurns.map((turn) => (
                <RespondingRow
                  key={turn.executionId}
                  turn={turn}
                  watching={watchedExecutionId === turn.executionId}
                  onToggleWatch={toggleWatch}
                />
              ))}

              {/* The mark-read sentinel: "the newest message is in the
                  viewport" ≙ this line is. */}
              <div ref={sentinelRef} aria-hidden className="h-px" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom overlay — jump pill, typing whisper line, then the composer.
          Out of flow (absolute), so nothing here can shift the transcript;
          the measured dock var reserves clearance instead. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
        {/* Jump-to-latest pill — gold, counted, symmetric tween, inert when
            hidden (NewRowsPill DNA pointed downward). */}
        <div
          aria-hidden={!showPill}
          className={cn(
            'mb-2 flex justify-center transition-all duration-200 motion-reduce:transition-none',
            showPill ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          )}
        >
          <button
            type="button"
            inert={!showPill}
            onClick={jumpToLatest}
            className={cn(
              'v2-interactive inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium shadow-lg',
              'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]',
              'transition-[transform,background-color] duration-150 motion-reduce:transition-none',
              showPill ? 'pointer-events-auto' : 'pointer-events-none',
              FOCUS_RING,
            )}
          >
            <ArrowDown aria-hidden className="size-4" />
            {pillCount === 0
              ? 'Latest'
              : pillCount === 1
                ? '1 new message'
                : `${pillCount} new messages`}
          </button>
        </div>

        {/* Typing whisper — ONE quiet line above the composer, never stacked
            bubbles (DIRECTION 7). The row is always mounted at fixed height,
            so appearing text never shifts the composer. */}
        <div className="mx-auto h-5 w-full max-w-xs px-4 text-xs text-muted-foreground sm:max-w-md">
          {/* No live region here: typing is presence noise, and announcing
              every typer change would spam screen readers (audit L12). */}
          <span
            className={cn(
              'inline-block max-w-full truncate rounded bg-background/80 px-1 backdrop-blur-sm',
              'transition-opacity duration-200 motion-reduce:transition-none',
              typingUsers.length > 0 ? 'opacity-100' : 'opacity-0',
            )}
          >
            {typingLabel(typingUsers)}
          </span>
        </div>

        <div ref={dockRef} className="pointer-events-auto v2-safe-bottom">
          {composer}
        </div>
      </div>

      {/* Touch action sheet — one per feed. */}
      <MessageActionsSheet
        message={sheetMessage}
        canEdit={sheetIsMine}
        canDelete={sheetIsMine || isChannelAdmin}
        onClose={() => setSheetMessageUuid(null)}
        onReply={(message) => onStartReply(message)}
        onEdit={(message) => setEditingUuid(message.uuid)}
        onDelete={(message) => setDeleteTarget(message)}
        onToggleReaction={rowActions.onToggleReaction}
        onTogglePin={rowActions.onTogglePin}
        onToggleSave={rowActions.onToggleSave}
        onViewAiSession={rowActions.onViewAiSession}
      />

      {/* Delete confirm — one per feed, destructive red. */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the message for everyone in the channel. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutate(deleteTarget.uuid);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function typingLabel(users: readonly TypingUser[]): string {
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0].name} is typing…`;
  if (users.length === 2) {
    return `${users[0].name} and ${users[1].name} are typing…`;
  }
  return 'Several people are typing…';
}

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
import { useRouter } from 'next/navigation';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { ArrowDown, Loader2, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type { Channel, Message, SlimUser } from '@/types/collab';
import type { ChannelReadReporter } from '@/v2/features/channels/mark-read';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
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
import { useStartThread } from '../threads/mutations';
import { ChannelFeedSkeleton, ChannelIntro, FeedErrorState } from '../screen/states';
import { channelDisplayName } from '../thread-model';
import { DayDivider, QuietSystemLine, UnreadDivider } from './FeedDivider';
import { ThreadOpening } from './ThreadOpening';
import { formatImageTarget } from './image-target';
import { MessageActionsSheet } from './MessageActionsSheet';
import { MessageGroupRow } from './MessageGroupRow';
import { MessageImageViewer } from './MessageImageViewer';
import type { MessageRowActions } from './MessageRow';
import { QuizCardPreview } from './QuizCardPreview';
import { QuizGameCard } from './QuizGameCard';
import { RespondingRow } from './RespondingRow';
import { useTextSelectMode } from './use-text-select-mode';
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
 * ChannelFeed — the member-only transcript: day dividers, author runs, the
 * gold unread line with land-at-line, the jump-to-latest pill, `?m=`
 * deep-link landing, the send ladder's row actions, and the mark-read
 * viewport trigger. Phase-5 W2; sources: plan W2 item 3,
 * foundation-standards §5 (scroll etiquette + mark-read triggers),
 * design-research DIRECTIONS 3/9/10/11 (binding) — 2026-08-04.
 *
 * W2 REDESIGN WAVE (2026-08-05), all of it INSIDE the mechanics below rather
 * than beside them:
 *  - the two non-message lines gained a hierarchy ({@link DayDivider} recedes,
 *    {@link UnreadDivider} spans the column and carries "Mark as read");
 *  - the head of history and the empty state became the SAME block
 *    ({@link ChannelIntro}), so a channel says what it is for every time you
 *    reach its beginning, not only on the day it was empty;
 *  - the typing whisper moved OUT of this file and onto the composer's own top
 *    edge, where it is left-aligned to the text column instead of centred
 *    under the middle of the page.
 * Nothing in the scroll contract moved.
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
 * wash can't re-render the list).
 *
 * ── REACHING A MESSAGE THAT IS NOT LOADED (2026-08-12) ─────────────────────
 * There are four ways a reader asks to be taken to a message — a `?m=` deep
 * link, the pinned/saved panels, a reply quote, a row in the replies index —
 * and since this wave there is ONE path behind all four ({@link
 * ChannelFeedProps.ref} and `rowActions.onJumpToMessage` are the same
 * callback). What that path does depends on where the message is:
 *
 *  1. ON SCREEN — flash it. No request, no state.
 *  2. NOT LOADED — open a WINDOW around it: `GET .../messages?around_message_uuid=`
 *     answers with the page it sits on plus roughly half a page either side, in
 *     ONE request. Measured 2026-08-12: the jump that used to cost five page
 *     pulls (and often failed anyway) now costs one.
 *  3. THE WINDOW ROUTE FAILED for any reason other than the server's refusal —
 *     fall back to the old bounded hunt, up to {@link TARGET_FETCH_PAGE_CAP}
 *     older pages.
 *  4. 422, or history exhausted — the message is not in this channel. Say so.
 *
 * A WINDOW IS A SECOND CACHE ENTRY, NOT A SPLICE (`queries.ts` states the key
 * geography). Grafting the window onto the live pages would put the jumped-to
 * message directly under the oldest loaded one with a gap of unfetched history
 * between them and nothing saying so. So the feed shows EITHER the live
 * transcript OR one contiguous window, and `readingThePast` — derived from the
 * pages themselves, never tracked — is which. While the past is on screen the
 * read pointer reports nothing (the foot of a window is not the newest
 * message), unacknowledged sends stay in the outbox rather than being drawn
 * under a message from last week, and the jump pill becomes "Jump to present".
 * Paging works in BOTH directions from a window, on the two cursors it came
 * back with; paging one all the way up to the present turns it back into a live
 * transcript with no state change anywhere.
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
 *    panels land on a message. It reuses the SAME resolver the `?m=` deep link
 *    uses, so a pin from last week resolves exactly like a notification link —
 *    and, unlike a URL write, it costs no navigation and can't fight the
 *    router's cached search params.
 *
 * SELECT TEXT (@arthur, 2026-08-07) gives one message's words back to the
 * finger, and it is owned here for the same reason the action sheet is: only
 * one message may be in it at a time, and "one at a time" is only a rule if one
 * thing enforces it. Like the deep-link wash it is a DOM stamp, so nothing about
 * it re-renders a row. See `use-text-select-mode.ts` for how the mode ends, and
 * why a scroll is deliberately not one of the ways.
 *
 * PICTURES OPEN HERE, NOT IN A TAB (owner, 2026-08-06). `?image=` is this
 * component's own overlay param — the precedent is `ListsTab`'s `?list=` — and
 * it is owned here rather than by the screen because only this component holds
 * the array the viewer resolves against. See {@link MessageImageViewer}.
 *
 * READ-ONLY MODE (`canParticipate: false`) — a space member previewing a
 * `space_public` channel they never joined. THE TRANSCRIPT IS THE SAME
 * TRANSCRIPT: same shaping, same grouping, same scroll contract, same deep
 * links, same reply-quote jumps. What leaves is every WRITE: the row action
 * cluster and the long-press sheet, the delete confirm, the empty state's
 * "write the first message", and the quiz cards' Join. What also leaves —
 * and this is the part a redesign must not put back — is EVERY READ-POINTER
 * REPORT: `POST /read` is refused for a previewer, so the bottom sentinel
 * reports nothing, Esc marks nothing and the jump pill only scrolls. A
 * previewer therefore has no unread state at all, which is also why no unread
 * divider is drawn (`channel.unread_count` is members-only and simply absent).
 */

const BOTTOM_THRESHOLD_PX = 80;
const UNVIRTUALIZED_TAIL = 3;
const FLASH_MS = 1600;
const TARGET_FETCH_PAGE_CAP = 5;
/** One sentence for the two ways a message can be out of reach for good — the
 *  server's 422, and a history that has been read to its end without it. They
 *  mean the same thing to the reader, so they say the same thing. */
const MESSAGE_NOT_HERE = "Couldn't find that message here.";

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** What the screen can ask the feed to do imperatively (panels + deep jumps). */
export interface ChannelFeedHandle {
  /** Scroll to a message and wash it. Opens a window around it when it isn't
   *  loaded (one request), and says so in the transcript's own quiet notice
   *  rather than erroring when it cannot be reached at all. */
  jumpToMessage: (messageUuid: string) => void;
}

export interface ChannelFeedProps {
  channel: Channel;
  /** The parent channel's name when `channel` is a THREAD — {@link
   *  ThreadOpening} names where the root came from. `null` on an ordinary
   *  channel, and while the name is still resolving. */
  parentName: string | null;
  viewerId: number | null;
  viewerUuid: string | null;
  reporter: ChannelReadReporter;
  /** May the viewer write in this channel? False for a previewer — see the
   *  READ-ONLY MODE note above. Every write affordance and every read-pointer
   *  report hangs off this one flag. */
  canParticipate: boolean;
  /** False while another tab covers the feed (the pane stays mounted but
   *  invisible) — gates the mark-read report: an invisible newest message is
   *  NOT "in the viewport" (§5's clause, taken literally). */
  active: boolean;
  /** `?m=` deep-link target (navigation-time value; prop changes re-arm). */
  targetMessageUuid: string | null;
  /** Faces for {@link ChannelIntro}'s presence stack (screen-owned roster). */
  members: readonly SlimUser[];
  /** Live Lawexa summons in this channel (room-owned; stable reference). */
  respondingTurns: readonly RespondingTurn[];
  /** Imperative handle for the pinned/saved panels' "jump to message". */
  ref?: React.Ref<ChannelFeedHandle>;
  /** The floating composer (or the non-member notice) — the feed positions
   *  it in its bottom overlay and reserves transcript clearance for it. */
  composer: React.ReactNode;
  /** Stage a reply in the composer (screen-owned state). */
  onStartReply: (message: Message) => void;
  /** The intro's one action when the channel is empty: focus the composer. */
  onFocusComposer: () => void;
  /** Open the roster from the intro's presence stack. Omitted where closed. */
  onOpenRoster?: () => void;
  /** The intro's invite affordance — channel admins only. */
  onAddPeople?: () => void;
  /** Open the sessions sheet on one session (screen-owned surface). */
  onViewAiSession: (sessionUuid: string) => void;
  /** Open the channel's live-quiz mode on a game (screen-owned `?game=`) —
   *  the quiz system cards' Join / results action (W6). */
  onOpenGame: (gameUuid: string) => void;
}

export function ChannelFeed({
  channel,
  parentName,
  viewerId,
  viewerUuid,
  reporter,
  canParticipate,
  active,
  targetMessageUuid,
  members,
  respondingTurns,
  composer,
  onStartReply,
  onFocusComposer,
  onOpenRoster,
  onAddPeople,
  onViewAiSession,
  onOpenGame,
  ref,
}: ChannelFeedProps) {
  /** A thread is a ROUTE (`/channels/{threadUuid}`) — the screen keys itself by
   *  channel and remounts wholesale, and it is the same address the
   *  notification dispatcher already pushes. So opening one is a push, not a
   *  mode this component could hold. */
  const router = useRouter();

  const editMutation = useEditChannelMessage(channel.uuid);
  const deleteMutation = useDeleteChannelMessage(channel.uuid);
  const retryMutation = useSendChannelMessage(channel.uuid);
  const discardFailed = useDiscardFailedMessage(channel.uuid);
  const reactionMutation = useToggleReaction(channel.uuid);
  const pinMutation = useTogglePin(channel.uuid);
  const saveMutation = useToggleSave(channel.uuid);
  const startThreadMutation = useStartThread(channel.uuid);
  /** NO THREADS INSIDE THREADS. One level is the server's rule, not a taste —
   *  `createThread` answers 422 from inside one — so the verb is absent rather
   *  than present-and-failing, in both input worlds. */
  const canBranch = !channel.is_thread;

  /* ── Refs for the scroll contract ─────────────────────────────────────────
        HOISTED ABOVE THE DATA, and that is a change of order rather than of
        substance: a jump can now decide WHICH history is on screen, so the
        target resolver has to be settled before the transcript's source can
        be. Everything from here to `activeTarget` reads no server data. ── */
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
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        the `?m=` resolver below, so an unloaded pin resolves exactly like a
        notification deep link.

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

  /**
   * Ask to be taken to a message. ONE ENTRANCE for all four ways a reader asks:
   * the pinned/saved panels (through {@link ChannelFeedHandle}), a reply quote,
   * a row in the replies index, and the AI sessions sheet's "summoned by".
   *
   * IT WAS NOT ONE ENTRANCE BEFORE, and that is the unfinished half of the
   * owner's 2026-08-12 report. The panels went through the resolver; the reply
   * quote and the replies index called `flashMessage` and stopped there — so
   * tapping a quote whose message was not loaded did not merely fail to reach
   * it, it never asked for it, and the notice built for exactly that failure
   * could not appear either. The paths are now the same path.
   */
  const requestJump = useCallback(
    (messageUuid: string) => {
      // Already on screen: flash it now, with no state change at all.
      if (flashMessage(messageUuid)) return;
      jumpNonceRef.current += 1;
      setJumpRequest({
        uuid: messageUuid,
        key: `${messageUuid}#${jumpNonceRef.current}`,
        fromTarget: targetMessageUuid,
      });
    },
    [flashMessage, targetMessageUuid],
  );

  useImperativeHandle(ref, () => ({ jumpToMessage: requestJump }), [requestJump]);

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

  /* ── THE CHANNEL'S OWN HISTORY: anchored at the newest message, growing
        backwards, and the entry the realtime writers append arrivals to. ── */
  const liveQuery = useInfiniteQuery(
    channelsQueries.messages({ channelUuid: channel.uuid, viewerId, around: null }),
  );
  const liveRows = useMemo(
    () => flattenMessages(liveQuery.data?.pages),
    [liveQuery.data],
  );

  /* ── THE WINDOW AROUND AN UNREACHED TARGET ─────────────────────────────────
        One request instead of five. Which message to open a window around is
        DERIVED, not stored: it is the active target, whenever that target is
        not in the live pages and older pages remain. So the window opens as a
        consequence of asking for something out of reach, and closes again the
        moment the message is in hand — no effect writes it, and nothing can be
        left armed.

        THE FOUR GUARDS, each for a different reason:
         - a stood-down key: the reader pressed "Jump to present" (or dismissed
           the notice) and must not be dragged straight back into the past;
         - `hasNextPage`: with the whole history loaded, a message that is not
           in it is not in the channel — the answer is already known, and
           spending a request to be told 422 would be theatre;
         - the membership test: the common case is a target in the newest page,
           which costs nothing at all;
         - a LOCAL uuid: an unacknowledged row has no server identity, so the
           server could only refuse it. (It is also always on screen, so this
           is belt-and-braces — the same guard the engagement verbs keep.) */
  const [standDownKey, setStandDownKey] = useState<string | null>(null);
  const windowAround =
    activeTarget !== null &&
    standDownKey !== activeTarget.key &&
    !isLocalMessageUuid(activeTarget.uuid) &&
    liveQuery.hasNextPage &&
    !liveRows.some((message) => message.uuid === activeTarget.uuid)
      ? activeTarget.uuid
      : null;

  const windowQuery = useInfiniteQuery({
    ...channelsQueries.messages({
      channelUuid: channel.uuid,
      viewerId,
      around: windowAround,
    }),
    enabled: windowAround !== null,
    // Hold the transcript that is already on screen while the window loads, so
    // a jump never blinks back to the live tail on its way somewhere else. With
    // `windowAround` null this is inert: the key is then the live key and the
    // data is simply there.
    placeholderData: keepPreviousData,
    // THE ONE PLACE THIS FLAG IS EARNED (standards §2 keeps it ON everywhere
    // else). Which page a message sits on does not change, so a successful
    // window has nothing to re-ask; and a FAILED one is the case the flag
    // actually governs — an errored query is stale by definition, so without
    // this every return to the tab would re-send a request the server has
    // already refused, for as long as the notice stands.
    refetchOnWindowFocus: false,
  });

  /* A 422 is the server saying the message is not in this channel — the same
     answer it gives for a uuid that never existed, deliberately. It is final,
     and it is exactly the "Couldn't find that message here" state that already
     existed. Any OTHER failure is a transport problem, and the bounded page
     hunt below is still the honest fallback for it. */
  const windowError =
    windowAround !== null && windowQuery.isError ? windowQuery.error : null;
  const targetNotInChannel =
    windowError !== null && extractApiError(windowError).status === 422;
  const windowFellBack = windowError !== null && !targetNotInChannel;
  const showingWindow = windowAround !== null && windowError === null;
  const source = showingWindow ? windowQuery : liveQuery;
  /** The window is asked for but not yet in hand — the transcript on screen is
   *  still the previous one, so nothing may page it. */
  const windowSettling = showingWindow && windowQuery.isPlaceholderData;

  const sourcePages = source.data?.pages;
  /* ── The transcript = the active source's pages + any outbox rows a refetch
        evicted. The cache is refetchable state (join-time reconcile, reconnect
        invalidation) and server pages can never contain an unacknowledged
        row — the outbox is that row's durable home, merged back here so a
        background refetch can NEVER silently drop an unsent message (§5's
        ban, structurally enforced). Cache-present rows are not duplicated,
        and the merge is CHRONOLOGICAL (audit L13) so a failed send keeps the
        place it was written in instead of drifting to the end.

        THE OUTBOX ONLY MERGES INTO A TRANSCRIPT THAT ENDS AT THE PRESENT, and
        the pages say whether this one does: `prev_cursor` on the newest page is
        null exactly when that page holds the channel's newest message. A row
        the server has not acknowledged belongs at the end of the conversation,
        and the end of a window from last week is not that place — it would be
        drawn under a message from days ago. It waits in the outbox instead (it
        is not lost; that is its durable home) and appears the moment the reader
        is back in the present. The same fact drives the read pointer and the
        jump pill below, and it is the same one `cache.ts` uses to decide where
        a live arrival may be written. ─────────────────────────────────────── */
  const readingThePast =
    sourcePages !== undefined &&
    sourcePages.length > 0 &&
    sourcePages[0].pagination.prev_cursor !== null;
  const cachedMessages = useMemo(() => flattenMessages(sourcePages), [sourcePages]);
  const outboxRows = useOutboxMessages(channel.uuid);
  const messages = useMemo(
    () =>
      readingThePast ? cachedMessages : mergeOutboxRows(cachedMessages, outboxRows),
    [readingThePast, cachedMessages, outboxRows],
  );
  /** The read pointer's target, and it is read off the LIVE pages whatever is
   *  on screen: "newest" is a fact about the channel, not about the window the
   *  reader happens to be looking at. Local uuids are skipped, so the outbox
   *  never mattered here. */
  const newestReal = useMemo(
    () => newestRealMessageUuid(liveRows, isLocalMessageUuid),
    [liveRows],
  );

  /* The live query owns the skeleton and the error state — both are about the
     channel's history, not about one jump. A refused window must never blank
     the transcript the reader is already reading. */
  const { isPending, isError, refetch } = liveQuery;
  const {
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    hasPreviousPage,
    isFetchingPreviousPage,
    fetchPreviousPage,
  } = source;

  /* ── The unread anchor, captured ONCE at open (§5: persists for the view
        session). Guarded render-adjust — React's sanctioned form — because
        it must exist in the SAME render the divider first draws in, so the
        landing layout-effect can find the element. ───────────────────────── */
  const [anchor, setAnchor] = useState<{ uuid: string | null } | null>(null);
  if (anchor === null && messages.length > 0) {
    setAnchor({
      // READ-ONLY MODE HAS NO UNREAD STATE, AND THAT IS ENFORCED HERE RATHER
      // THAN ASSUMED. `unread_count` is a members-only field, so a previewer
      // should never receive one — but if a payload ever carried a stale or
      // non-zero count, the gold "New" line would draw and could never be
      // cleared: the read pointer is disabled, so Esc, the jump pill and the
      // bottom sentinel are all no-ops, and the first-paint landing would drop
      // the reader on that line on every single visit. Zeroed at the source.
      uuid: unreadAnchorUuid(messages, canParticipate ? (channel.unread_count ?? 0) : 0),
    });
  }

  /* THE UNREAD LINE'S ONE EXPLICIT DISMISSAL. `Esc` advances the read pointer
     and deliberately LEAVES the line standing (§5: it persists for the view
     session, because the reader may be using it as a bookmark). "Mark as read"
     on the divider is the stronger, stated intent — it advances the pointer AND
     takes the line away, because a control that says "mark as read" and leaves
     a "New" line on screen has not done what it said. Feed-local, so it lasts
     exactly as long as this view of the channel. */
  const [unreadCleared, setUnreadCleared] = useState(false);
  /* The gold line is a fact about the PRESENT — "you had read up to here when
     you arrived" — so it is not drawn over a window from last week, where it
     would sit in the middle of history claiming everything below it is new.
     The anchor itself is untouched and the line is back where it was the moment
     the reader returns. */
  const activeAnchor =
    unreadCleared || readingThePast ? null : (anchor?.uuid ?? null);
  /** The viewport's distance from the CONTENT BOTTOM at the moment the line is
   *  dismissed — the same bottom-anchored measure the history-pull restore
   *  uses, for the same reason: removing the divider shortens the transcript
   *  ABOVE the reader, and nothing else on this path holds their place. */
  const unreadClearRestoreRef = useRef<number | null>(null);

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
    const items = buildFeedItems(messages, activeAnchor, anchoredByMessage);
    const withOrdinals: { item: (typeof items)[number]; groupOrdinal: number }[] = [];
    let ordinal = 0;
    for (const item of items) {
      if (item.kind === 'group') ordinal += 1;
      withOrdinals.push({ item, groupOrdinal: item.kind === 'group' ? ordinal : 0 });
    }
    return { renderItems: withOrdinals, groupCount: ordinal };
  }, [messages, activeAnchor, anchoredByMessage]);

  /* ── Jump pill: a TIME watermark captured at detach (audit H1). The count
        is "messages strictly newer than the newest message the reader had
        when they looked away" — so a history PREPEND (older by definition)
        can never inflate it, only genuine arrivals count (DIRECTION 10).

        AND IT IS ALSO THE WAY BACK FROM A WINDOW. A reader in the past is by
        definition not at the newest message, so the pill stands whether or not
        they have scrolled — and it says "Jump to present", because "Latest"
        over a transcript that ends last Tuesday would be a promise about the
        wrong end of the wrong pages. ─────────────────────────────────────── */
  const [detachedWatermark, setDetachedWatermark] = useState<number | null>(null);
  const showPill = readingThePast || detachedWatermark !== null;
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
  /**
   * The server's refusal when branching a message failed, and which message it
   * was about — one at a time, exactly like the edit and the sheet, because two
   * red sentences in one transcript would be two failures the reader has to
   * sort out. This screen raises no toasts (the W2 house rule), so it is
   * rendered under the message it concerns; see {@link MessageRow} for why it
   * carries no dismiss control.
   */
  const [threadFailure, setThreadFailure] = useState<{
    messageUuid: string;
    message: string;
  } | null>(null);
  /** "Select text": one row at a time, handed back to the platform's own
   *  selection. FEED-OWNED for exactly the reason the sheet is — "one at a
   *  time" is only a rule if one thing enforces it — but held as a DOM stamp
   *  rather than as state, because the rows it marks are memoised and this
   *  changes nothing React renders. See `use-text-select-mode.ts`. */
  const textSelect = useTextSelectMode(rootRef);

  /**
   * The picture viewer's URL state (`?image={messageUuid}:{attachmentId}`).
   *
   * IT IS OWNED HERE, NOT BY THE SCREEN, and the precedent is `?list=`, which
   * `ListsTab` owns for the same reason: the param names something only this
   * component can resolve. The viewer's set is the pictures of ONE message, and
   * the array those come from — cache pages merged with the outbox — is derived
   * right here. Hoisting the param to `ChannelScreen` would mean either a
   * second observer on the message history (re-deriving what this component
   * already holds, and missing every unacknowledged row) or passing the whole
   * transcript upward. Neither buys anything: the feed only mounts for a reader
   * who may read the channel, which is the same gate `canOpen` would apply.
   *
   * NO `ssrValue`: the viewer only ever renders through a Radix portal, so a
   * `?image=` that is open in the URL produces no server HTML either way and
   * hydration cannot diverge (the hook's own rule).
   *
   * AND NO ADOPTION EFFECT, unlike `?game=`. That param needed one because it
   * arrives from OUTSIDE its screen — a go-live notification pushes it onto a
   * channel the reader is already sitting in, and a push is neither a fresh
   * mount nor a popstate. `?image=` has exactly three entrances and the hook
   * already answers all three: a tile press (this component's own `show`), a
   * cold load or a shared link (the lazy initialiser reads the live URL), and
   * Back/Forward (the hook's `popstate` adopter). Nothing else can produce one,
   * so there is no soft navigation to adopt from.
   */
  const image = useUrlOverlay('image');
  const { show: showImage, swap: swapImage, close: closeImage } = image;

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
  }, [sourcePages, isFetchingNextPage]);

  /* ── Unread-line dismissal restore — the same bottom-anchored maths as the
        pull above, on its own ref and its own effect so the protected history
        path is not asked to carry a second trigger. Dismissing the line removes
        an item from the transcript, which shortens the content ABOVE the reader
        by the divider and its gap; without this the conversation would jump up
        under them at the exact moment they pressed a button. A LAYOUT effect,
        so the corrected position is set before paint and no wrong frame draws.
        Fires once per dismissal (the ref is cleared) and never afterwards. ─── */
  useIsomorphicLayoutEffect(() => {
    if (unreadClearRestoreRef.current === null) return;
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight - unreadClearRestoreRef.current;
      atBottomRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD_PX;
    }
    unreadClearRestoreRef.current = null;
  }, [unreadCleared]);

  /* ── Landing in a window — a LAYOUT effect, and for the same reason the
        first paint is one: the transcript has just been replaced wholesale, so
        the reader's scroll position now points at rows that are no longer
        there. Correcting it after paint would draw one frame of somebody else's
        conversation. INSTANT, not smooth, for the reason audit M7 gives about
        the opening scroll: thirty unfamiliar rows sweeping past is not what
        "take me there" looks like.

        It marks the target consumed, so the passive resolver below sees the
        landing has already happened (layout effects run before passive ones in
        the same commit) and does not flash it a second time. ─────────────── */
  useIsomorphicLayoutEffect(() => {
    if (activeTarget === null || !showingWindow || windowSettling) return;
    if (consumedTargetRef.current === activeTarget.key) return;
    if (!messages.some((message) => message.uuid === activeTarget.uuid)) return;
    // The middle of a window is never the bottom of one, so the follower must
    // stand down before it chases the end of history the reader did not ask for.
    atBottomRef.current = false;
    if (flashMessage(activeTarget.uuid, { instant: true })) {
      consumedTargetRef.current = activeTarget.key;
    }
  }, [activeTarget, showingWindow, windowSettling, messages, flashMessage]);

  /** Armed by "Jump to present": the scroll cannot happen in the click, because
   *  the pages it would scroll are the ones about to be taken off screen. */
  const returnToPresentRef = useRef(false);
  /* ── Landing back in the present. The live pages are still in cache, so the
        swap costs no request and this runs in the very next commit. ──────── */
  useIsomorphicLayoutEffect(() => {
    if (!returnToPresentRef.current || readingThePast) return;
    returnToPresentRef.current = false;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
  }, [readingThePast, messages]);

  /* ── Own-send scroll (passive effect, ref sync). Seeded with the FIRST
        render's length, so a transcript that painted straight out of a warm
        cache is not read as thirty messages having just arrived. ─────────── */
  const messagesLenRef = useRef(messages.length);
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

  /* ── The viewport-height keeper: CHROME ABOVE THE TRANSCRIPT MUST NOT MOVE
        THE TRANSCRIPT.

        The scroller is a flex child, so anything that appears above it —
        the push nudge, the live-quiz bar, and now the section strip opening
        the moment a previewer JOINS — shortens it. `scrollHeight` is unchanged
        and `scrollTop` is unchanged, so the conversation slides out from under
        the reader by exactly the height that arrived, at the one moment they
        pressed a button that promised to leave them where they were.

        Held BOTTOM-ANCHORED, the right anchor for a chat: the distance from
        the content's end stays constant, which for a reader at the bottom
        means staying at the bottom. Suppressed while a history pull is armed
        (that restore owns `scrollTop`) and before the first landing has run,
        so it can never fight either. The existing follower observes the
        CONTENT box and answers a different question — content growing, not the
        window onto it shrinking. ─────────────────────────────────────────── */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let lastHeight = el.clientHeight;
    const observer = new ResizeObserver(() => {
      const node = scrollRef.current;
      if (!node) return;
      const delta = node.clientHeight - lastHeight;
      lastHeight = node.clientHeight;
      if (delta === 0) return;
      if (!didInitialScrollRef.current || pendingRestoreRef.current !== null) return;
      node.scrollTop = atBottomRef.current
        ? node.scrollHeight - node.clientHeight
        : node.scrollTop - delta;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ── Composer-dock clearance, measured live (no CLS; the overlay floats
        over the transcript, so the transcript reserves its height).

        AND A READER AT THE BOTTOM STAYS AT THE BOTTOM WHILE IT GROWS. Staging
        a file — or quoting a reply, or being told why a send was refused —
        opens a tray that grows the dock UPWARD over the transcript. The
        clearance below grows with it, so `scrollHeight` grows while `scrollTop`
        does not, and the message that was sitting just above the composer a
        moment ago is now behind it. On a phone that is the message you were
        about to reply to.

        NEITHER OBSERVER ABOVE CAN SEE THIS, which is why the fix belongs here
        and not beside them. The bottom-follower watches the CONTENT box, and a
        `padding-bottom` change leaves a content box exactly the size it was;
        the viewport keeper watches the SCROLLER's `clientHeight`, and the
        padding is on the scroller's child, not the scroller. The dock's own
        height is the only signal there is, and this is the callback that
        already holds it — so every tray is covered, not just the attachment
        one.

        HOLDING IS NOT ANIMATING, so there is no motion to make conditional.
        The correction is one `scrollTop` write per resize notification, and the
        tray's own 200ms grid-rows tween is what turns those writes into a
        glide: the dock reaches its new height over a dozen frames and the
        transcript is re-pinned on each of them. A reader with motion turned off
        gets the tray in one step (`ComposerTrayRow`'s
        `motion-reduce:transition-none`) and exactly one write with it.

        ONLY SOMEBODY ALREADY AT THE BOTTOM IS MOVED, and they are moved to the
        bottom — the same rule, and the same maths, the viewport keeper applies
        when chrome appears above the transcript. A reader up in history is
        untouched: the tray is growing into space below them that they were not
        looking at. Suppressed before the first landing and while a history pull
        is armed, both of which own `scrollTop`. ─────────────────────────────── */
  useEffect(() => {
    const dock = dockRef.current;
    const root = rootRef.current;
    if (!dock || !root) return;
    let lastHeight = dock.offsetHeight;
    const sync = () => {
      const height = dock.offsetHeight;
      root.style.setProperty('--v2-chan-dock-h', `${height}px`);
      const delta = height - lastHeight;
      lastHeight = height;
      if (delta === 0) return;
      const el = scrollRef.current;
      if (!el || !atBottomRef.current) return;
      if (!didInitialScrollRef.current || pendingRestoreRef.current !== null) return;
      // Read AFTER the write: the property has already changed the
      // transcript's bottom clearance, so this measurement is of the height
      // the reader has to be re-pinned against, not the one before the tray
      // opened.
      el.scrollTop = el.scrollHeight - el.clientHeight;
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
    // `canParticipate` joins the clause rather than wrapping the effect: the
    // hook must still be told `null` if the flag ever flips off, so nothing
    // stays armed from a previous state.
    //
    // `readingThePast` joins it for a stronger reason than tidiness: the
    // sentinel sits at the foot of whatever is on screen, and the foot of a
    // window from last week is an OLD message. Reporting it would tell the read
    // pointer that the newest message the reader has seen is one from days ago —
    // §5's clause read literally says the opposite, and the reader scrolling to
    // the end of a window has not seen anything since.
    reportNewestVisible(
      canParticipate && active && bottomVisible && !readingThePast
        ? newestReal
        : null,
    );
  }, [
    canParticipate,
    active,
    bottomVisible,
    readingThePast,
    newestReal,
    reportNewestVisible,
  ]);

  /* ── THE FALLBACK, and since 2026-08-12 that is all it is: pull older pages,
        bounded, one page at a time. The window route above answers the same
        question in a single request and gets first refusal; this runs only
        where it cannot — no window was asked for at all (the target is loaded,
        or the whole history already is, or the reader stood one down), or the
        one that was asked for failed on the wire rather than being refused.

        Each pull is position-restored (`beginHistoryPull`), so the viewport
        holds still while pages arrive; giving up (no more pages, or the page
        cap) leaves the reader exactly where they were. The per-target page
        budget resets with each new request, so a second jump is not starved by
        the first one's spend. ────────────────────────────────────────────── */
  const targetFetchCountRef = useRef(0);
  const budgetForKeyRef = useRef<string | null>(null);
  /** Set when a jump ran out of road. Null whenever a jump is in flight or has
   *  landed, so the notice can never outlive the thing it is about. */
  const [unreachedTarget, setUnreachedTarget] = useState<{
    key: string;
    /** Older pages remain, so "keep looking" is a real offer rather than a
     *  button that would spend another five requests finding nothing. */
    morePagesExist: boolean;
  } | null>(null);

  /**
   * Spend another budget on the same target. The reader asked for this, so it
   * is not a silent retry — and the budget resets rather than growing, which
   * keeps one press bounded exactly like the first attempt was.
   *
   * THE NONCE IS WHAT MAKES THE BUTTON WORK, and its absence is a bug I shipped
   * into my own fix for exactly this class of problem: clearing the two refs
   * changes nothing the hunting effect DEPENDS on, so the effect never re-ran
   * and "Keep looking" quietly did nothing. Measured — zero further requests.
   * The nonce is state, so it re-arms the effect the way a new target would.
   */
  const [retryNonce, setRetryNonce] = useState(0);
  const keepLookingForTarget = useCallback(() => {
    targetFetchCountRef.current = 0;
    consumedTargetRef.current = null;
    budgetForKeyRef.current = null;
    setUnreachedTarget(null);
    setRetryNonce((n) => n + 1);
  }, [setUnreachedTarget, setRetryNonce]);

  /**
   * What the pill slot says about a jump that has not landed — DERIVED rather
   * than cleared, so it cannot outlive the thing it is about: it stops being
   * true the instant the message is on screen (the reader pressed "Load older"
   * themselves, or "Keep looking" found it) or a newer jump takes over, and no
   * effect ever has to reach in and tidy it up.
   *
   * The server's own refusal comes first, because it is the more certain of the
   * two: a 422 means the message is not in this channel at all, and no amount
   * of paging will produce it.
   */
  const jumpNotice = useMemo<{ text: string; canKeepLooking: boolean } | null>(() => {
    if (activeTarget === null) return null;
    if (messages.some((message) => message.uuid === activeTarget.uuid)) return null;
    if (targetNotInChannel) {
      return { text: MESSAGE_NOT_HERE, canKeepLooking: false };
    }
    if (unreachedTarget === null || unreachedTarget.key !== activeTarget.key) {
      return null;
    }
    return unreachedTarget.morePagesExist
      ? { text: 'That message is further back.', canKeepLooking: true }
      : { text: MESSAGE_NOT_HERE, canKeepLooking: false };
  }, [activeTarget, messages, targetNotInChannel, unreachedTarget]);

  /**
   * Stop asking for this message, by every route at once.
   *
   * Both halves are needed and neither is enough alone: standing the window
   * down without marking the target consumed would hand it straight to the page
   * hunt, which would spend five requests re-discovering what the server has
   * already refused; marking it consumed without standing the window down would
   * leave the refusal — and its notice — exactly where it was.
   */
  const stopChasingTarget = useCallback(() => {
    if (activeTarget === null) return;
    consumedTargetRef.current = activeTarget.key;
    setStandDownKey(activeTarget.key);
  }, [activeTarget, setStandDownKey]);

  const dismissJumpNotice = useCallback(() => {
    stopChasingTarget();
    setUnreachedTarget(null);
  }, [stopChasingTarget, setUnreachedTarget]);

  useEffect(() => {
    if (!activeTarget || consumedTargetRef.current === activeTarget.key) return;
    if (messages.length === 0) return;
    /* THE WINDOW OWNS THIS TARGET while it is in flight or has answered — one
       request either lands it or refuses it, and walking backwards a page at a
       time underneath that would be the same journey made twice. The hunt takes
       over only when the window failed on the wire; a 422 is an answer, not a
       failure, and there is nothing further back to look for. */
    if (windowAround === activeTarget.uuid && !windowFellBack) return;

    if (budgetForKeyRef.current !== activeTarget.key) {
      budgetForKeyRef.current = activeTarget.key;
      targetFetchCountRef.current = 0;
    }

    if (messages.some((message) => message.uuid === activeTarget.uuid)) {
      consumedTargetRef.current = activeTarget.key;
      // NOT cleared here. A standing notice is hidden by DERIVATION above
      // (`jumpNotice`), which needs no state write at all: it stops being
      // true the moment the message is in `messages` or a newer jump starts.
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
      /* STOP, BUT SAY SO. This used to give up in silence, and the owner
         reported the consequence on 2026-08-12: he tapped a reply quote, the
         message was older than the page budget, and the screen simply did not
         move. He then scrolled and pressed "Load older" by hand until it
         appeared — doing the work this had quietly abandoned. A tap that
         produces nothing at all reads as a broken app, not as a limit.

         The two ways to fail are different and are told apart, because one has
         a next step and the other does not: pages remain (the budget ran out,
         so the reader can ask for more), or there are none (the message is not
         in this channel's history at all — deleted, or a stale link). */
      consumedTargetRef.current = activeTarget.key;
      /* The one state write in this effect, and it cannot be derived: the
         second failure mode (`!hasNextPage` on the very first evaluation)
         schedules no fetch, so no further render is guaranteed to happen and
         a derived value would never be computed. It is terminal and runs at
         most ONCE per target — `consumedTargetRef` is set on the line above
         and gates re-entry — so it cannot loop. */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreachedTarget({ key: activeTarget.key, morePagesExist: hasNextPage });
    }
  }, [
    activeTarget,
    messages,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    flashMessage,
    beginHistoryPull,
    windowAround,
    windowFellBack,
    // Not read in the body: it exists so "Keep looking" re-arms this effect.
    retryNonce,
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
    if (readingThePast) {
      /* LEAVING A WINDOW IS A DATA CHANGE, NOT A SCROLL, and scrolling here
         would move the pages that are about to be taken off screen. Standing
         the window down swaps the transcript back to the live pages — still in
         cache, so it costs no request — and the layout effect that watches for
         that puts the reader at the bottom of them before the frame paints. */
      returnToPresentRef.current = true;
      stopChasingTarget();
    } else {
      const el = scrollRef.current;
      if (el) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
      }
    }
    // Jump-pill click is a mark-read trigger (§5) — for a member. A previewer
    // has no pointer to advance, so the pill is purely a scroll. `newestReal`
    // is the LIVE newest whichever transcript is on screen, so this is the same
    // mark whether the reader was detached in the present or away in the past.
    if (canParticipate && newestReal) reporter.markReadNow(newestReal);
  };

  /** The unread divider's own verb — see `unreadCleared` above. The measure is
   *  taken BEFORE the state change, so the layout effect that follows can put
   *  the reader back where they were once the line has gone. */
  const markReadAndClearLine = () => {
    if (newestReal) reporter.markReadNow(newestReal);
    const el = scrollRef.current;
    if (el) unreadClearRestoreRef.current = el.scrollHeight - el.scrollTop;
    setUnreadCleared(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Esc = mark read (§5), and only where there is a pointer to move.
    if (event.key === 'Escape' && canParticipate && newestReal) {
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

  /**
   * Walk a window FORWARD, towards the present, on the `prev_cursor` it came
   * back with. Only ever offered inside one — the live transcript's newest page
   * has a null `prev_cursor`, so `hasPreviousPage` is false there and this
   * button does not exist.
   *
   * NO POSITION RESTORE, because there is nothing to restore: newer pages are
   * appended BELOW the reader and every row above them keeps its place. What
   * WOULD move them is the bottom-follower — a reader who pressed this at the
   * foot of the window is "at the bottom", and the follower would sweep them
   * past the thirty messages they just asked to see. Standing it down is the
   * whole correction, and their own next scroll re-decides it.
   */
  const handleLoadNewer = () => {
    atBottomRef.current = false;
    void fetchPreviousPage();
  };

  /* ── Row actions (stable object — rows are memoised on it). ───────────── */
  const editMutate = editMutation.mutate;
  const deleteMutate = deleteMutation.mutate;
  const retryMutate = retryMutation.mutate;
  const reactionMutate = reactionMutation.mutate;
  const pinMutate = pinMutation.mutate;
  const saveMutate = saveMutation.mutate;
  const startThreadMutate = startThreadMutation.mutate;
  const textSelectExit = textSelect.exit;
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
          // The row is the outbox's own copy, so its files are still the
          // files this send was made of — a retry that dropped them would
          // quietly post the caption alone.
          attachments: entry.message.attachments,
          retryLocalUuid: message.uuid,
        });
      },
      onDiscardFailed: discardFailed,
      // A HOLD ANYWHERE ENDS A SELECTION ANYWHERE. The hold gesture already
      // stands down on the row that is selecting, so reaching here means the
      // reader has moved on to a different message — and the fire path has
      // just cleared the selection out from under the old one, which would
      // otherwise leave a row stamped for a selection that no longer exists.
      onOpenActions: (message) => {
        textSelectExit();
        setSheetMessageUuid(message.uuid);
      },
      // THE SAME ENTRANCE THE PANELS USE — see `requestJump`. This used to be
      // a bare `flashMessage`, which meant a reply quote or a replies-index row
      // pointing at an unloaded message did nothing and said nothing.
      onJumpToMessage: requestJump,
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
      /* ONE VERB, TWO PATHS, AND THE SHORT ONE IS THE COMMON ONE. A message
         whose stub this feed already holds needs no request at all — the thread
         exists, its uuid is in hand, and asking again would only be told so.
         Everything else posts the branch and goes where the answer points,
         whether the server created it (201) or handed back the one somebody
         else started a second earlier (200): both mean "you are in the thread
         for this message".

         `isLocalMessageUuid` is the same belt-and-braces the three toggles
         above keep. An outbox row has no server identity to branch, and the
         cluster is already hidden while one is in flight. */
      onOpenThread: (message) => {
        if (isLocalMessageUuid(message.uuid)) return;
        setThreadFailure(null);
        const existing = message.thread;
        if (existing) {
          router.push(`/channels/${existing.uuid}`);
          return;
        }
        startThreadMutate(
          { rootMessageUuid: message.uuid },
          {
            onSuccess: (response) =>
              router.push(`/channels/${response.data.uuid}`),
            // The server's own sentence, under the message it is about: the
            // root was deleted between the render and the press, or this
            // channel is itself a thread. Neither is worth a generic apology.
            onError: (error) =>
              setThreadFailure({
                messageUuid: message.uuid,
                message: extractApiError(error).message,
              }),
          },
        );
      },
      onViewAiSession,
      // A PUSH, so Back closes the viewer — and `show` is idempotent, so a
      // double-tapped tile still costs exactly one entry.
      onOpenImage: (message, attachmentId) =>
        showImage(formatImageTarget(message.uuid, attachmentId)),
    }),
    [
      onStartReply,
      editMutate,
      retryMutate,
      discardFailed,
      requestJump,
      reactionMutate,
      pinMutate,
      saveMutate,
      startThreadMutate,
      router,
      // The setter is listed for the reason `ChannelScreen` states on its own
      // callbacks: a `useState` setter's identity never changes, but an
      // inferred dependency missing from the source array makes the React
      // Compiler skip optimising the whole component.
      setThreadFailure,
      onViewAiSession,
      showImage,
      textSelectExit,
    ],
  );

  const isChannelAdmin = canManageChannel(channel);
  /* WHAT STANDS AT THE HEAD OF THE TRANSCRIPT. A channel opens with its birth
     certificate; a thread opens with the message it branched from, which is a
     different fact about a different place (see {@link ThreadOpening}). Derived
     once and consumed by both call sites below — the empty state and the head
     of loaded history — so the two can never disagree about which block a
     thread gets. */
  const threadOpening = channel.is_thread ? (
    <ThreadOpening channel={channel} parentName={parentName} />
  ) : null;
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
        aria-label={`Messages in ${channelDisplayName(channel)}`}
        aria-busy={
          isPending || isFetchingNextPage || isFetchingPreviousPage || windowSettling
        }
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
            (threadOpening ?? (
              <ChannelIntro
                channel={channel}
                members={members}
                onOpenRoster={onOpenRoster}
                onAddPeople={onAddPeople}
                // No action for a previewer: the way forward here is joining,
                // and that button already stands in the dock below.
                onWriteFirstMessage={canParticipate ? onFocusComposer : undefined}
              />
            ))
          ) : (
            <div className="flex flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
              {hasNextPage ? (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadOlder}
                    // `windowSettling`: the pages on screen belong to the
                    // transcript we are LEAVING, so their cursors are not this
                    // query's to spend.
                    disabled={isFetchingNextPage || windowSettling}
                  >
                    {isFetchingNextPage && (
                      <Loader2 aria-hidden className="size-4 animate-spin" />
                    )}
                    Load older messages
                  </Button>
                </div>
              ) : (
                /* The head of history is the SAME block the empty state uses:
                   a channel should teach what it is every time you reach its
                   beginning, not only on the one day it was empty. Without the
                   write-first action — there already is a first message. */
                (threadOpening ?? (
                  <ChannelIntro
                    channel={channel}
                    members={members}
                    onOpenRoster={onOpenRoster}
                    onAddPeople={onAddPeople}
                  />
                ))
              )}

              {renderItems.map(({ item, groupOrdinal }) => {
                switch (item.kind) {
                  case 'day':
                    return <DayDivider key={item.key} label={item.label} />;
                  case 'quiet-line':
                    return <QuietSystemLine key={item.key} message={item.message} />;
                  case 'unread':
                    return (
                      <UnreadDivider
                        key={item.key}
                        // A previewer has no read pointer to advance, so the
                        // verb is simply absent rather than present-and-failing
                        // (they also never get a divider — belt and braces).
                        onMarkRead={canParticipate ? markReadAndClearLine : undefined}
                      />
                    );
                  case 'quiz-card':
                    // The live card probes the game and offers Join, both of
                    // which are blocked for a previewer — so they get the
                    // record of the quiz without the request or the verb,
                    // rather than a card that fails when pressed.
                    return canParticipate ? (
                      <QuizGameCard
                        key={item.key}
                        message={item.message}
                        channelUuid={channel.uuid}
                        viewerId={viewerId}
                        onOpenGame={onOpenGame}
                      />
                    ) : (
                      <QuizCardPreview key={item.key} message={item.message} />
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
                        canEngage={canParticipate}
                        canBranch={canBranch}
                        isChannelAdmin={isChannelAdmin}
                        editingUuid={editingUuid}
                        threadErrorUuid={threadFailure?.messageUuid ?? null}
                        threadError={threadFailure?.message ?? null}
                        actions={rowActions}
                      />
                    );
                }
              })}

              {/* THE WAY BACK OUT OF A WINDOW, one page at a time — the mirror
                  of "Load older" at the head, and it only exists inside one:
                  the live transcript's newest page carries a null
                  `prev_cursor`, so there is never anything newer to ask for
                  there. Below the messages because that is where the messages
                  it fetches will appear. */}
              {hasPreviousPage && (
                /* pb-11 = 44px, MEASURED not guessed: the jump pill floats over
                   the transcript's tail and its row is 36px plus an 8px gap to
                   the dock (measured at 430px and 1280px — the pill is one
                   size). Everything else at the foot of a transcript is a
                   message, which the pill has always been allowed to cover
                   because pressing it takes you past it; this is a BUTTON, and
                   a button half under a pill is a button you cannot press. */
                <div className="flex justify-center pb-11">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadNewer}
                    disabled={isFetchingPreviousPage || windowSettling}
                  >
                    {isFetchingPreviousPage && (
                      <Loader2 aria-hidden className="size-4 animate-spin" />
                    )}
                    Load newer messages
                  </Button>
                </div>
              )}

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
        {/* A jump that ran out of road says so HERE, in the pill's own slot,
            because that is where this screen already speaks about movement.
            Quiet, not an error: failing to reach a message from last month is
            an ordinary limit, and the reader has done nothing wrong. */}
        {jumpNotice !== null && (
          <div className="mb-2 flex justify-center px-3">
            <div
              role="status"
              className={cn(
                'pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-1.5',
                'bg-secondary text-xs text-secondary-foreground shadow-lg',
              )}
            >
              <span className="min-w-0 truncate">{jumpNotice.text}</span>
              {jumpNotice.canKeepLooking && (
                <button
                  type="button"
                  onClick={keepLookingForTarget}
                  className={cn(
                    'v2-interactive shrink-0 rounded-full font-medium text-primary underline',
                    FOCUS_RING,
                  )}
                >
                  Keep looking
                </button>
              )}
              <button
                type="button"
                onClick={dismissJumpNotice}
                aria-label="Dismiss"
                className={cn(
                  'v2-interactive shrink-0 rounded-full text-muted-foreground',
                  FOCUS_RING,
                )}
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </div>
          </div>
        )}

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
            {readingThePast
              ? 'Jump to present'
              : pillCount === 0
                ? 'Latest'
                : pillCount === 1
                  ? '1 new message'
                  : `${pillCount} new messages`}
          </button>
        </div>

        {/* The typing whisper used to live HERE, as a fixed-height row centred
            under the middle of the page and lined up with nothing. It is now a
            legend on the composer's own top edge (`ChatComposerShell`), which
            costs no height at all and is unmistakably about the box you are
            typing into. */}

        <div ref={dockRef} className="pointer-events-auto v2-safe-bottom">
          {composer}
        </div>
      </div>

      {/* The picture viewer. NOT member-gated — looking at a photo is reading,
          and a previewer sees the same transcript.

          ALWAYS MOUNTED, never `image.value &&`: Radix Presence cannot play an
          exit for a component that unmounts in the same commit (the house
          dialog contract, stated at `use-url-overlay.ts`), and a full-screen
          surface that vanished in one frame is the abrupt dismissal the motion
          rule forbids. It renders no portal while closed, so standing mounted
          costs a `<Dialog open={false}>` and nothing else.

          NOT KEYED PER OPENING either, and that is the one place it departs
          from the edit-dialog idiom on purpose: this overlay's VALUE CHANGES
          WHILE IT IS OPEN — every swipe is a new `?image=` — so a key derived
          from it would remount the viewer mid-gesture. It holds nothing that
          needs resetting instead: the current picture is derived from the URL,
          and each frame's paint state is keyed by its own file id. Same
          reasoning as `ChannelAiSessionsSheet`, the other multi-value
          overlay. */}
      <MessageImageViewer
        value={image.value}
        // A deep link can arrive before the first page of history does. Until
        // it settles, "we can't find it" is not yet a true thing to say.
        resolving={isPending}
        messages={messages}
        // A REPLACE: the whole visit is one history entry, so Back leaves the
        // viewer rather than walking back through every picture.
        onSelect={swapImage}
        onClose={closeImage}
      />

      {/* Touch action sheet and the delete confirm — one per feed, and both
          MEMBER-ONLY: every verb inside them is a write, and the gestures that
          open them are already gone in read-only mode, so mounting them would
          leave two unreachable surfaces in the tree. */}
      {canParticipate && (
        <>
          <MessageActionsSheet
            message={sheetMessage}
            canEdit={sheetIsMine}
            canDelete={sheetIsMine || isChannelAdmin}
            canBranch={canBranch}
            onClose={() => setSheetMessageUuid(null)}
            onReply={(message) => onStartReply(message)}
            onOpenThread={rowActions.onOpenThread}
            onEdit={(message) => setEditingUuid(message.uuid)}
            onDelete={(message) => setDeleteTarget(message)}
            onToggleReaction={rowActions.onToggleReaction}
            onTogglePin={rowActions.onTogglePin}
            onToggleSave={rowActions.onToggleSave}
            onViewAiSession={rowActions.onViewAiSession}
            onSelectText={(message) => textSelect.enter(message.uuid)}
          />

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
        </>
      )}
    </div>
  );
}

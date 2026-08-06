'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Bookmark,
  Loader2,
  Lock,
  LogOut,
  Pencil,
  Pin,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';

import { cn } from '@/lib/utils';
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
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/lib/stores/authStore';
import { extractApiError } from '@/lib/utils/api-error';
import type { Message, NotifyLevel, SlimUser } from '@/types/collab';
import { channelAccess } from '@/v2/features/collab/access';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import { quietReplaceUrlParams } from '@/v2/runtime/url-params';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import { useV2Session } from '@/v2/runtime/session-context';
import {
  ChannelComposer,
  type ChannelComposerHandle,
} from '../composer/ChannelComposer';
import { ChannelFeed, type ChannelFeedHandle } from '../feed/ChannelFeed';
import { ChannelAiSessionsSheet } from '../lawexa/ChannelAiSessionsSheet';
import { useChannelReadPointer } from '../mark-read';
import {
  PinnedMessagesSheet,
  SavedMessagesSheet,
} from '../panels/MessageCollectionSheet';
import {
  useDeleteChannel,
  useJoinChannel,
  useLeaveChannel,
  useSetChannelNotifyLevel,
} from '../membership-mutations';
import { canManageChannel, parseChannelTab, type ChannelTab } from '../model';
import { channelsQueries } from '../queries';
import { useChannelRoom } from '../room';
import { FilesTab } from '../files/FilesTab';
import { ListsTab } from '../lists/ListsTab';
import { ChannelMembersSheet } from '../members/ChannelMembersSheet';
import { ChannelEditDialog } from '../dialogs/ChannelEditDialog';
import { GameOverlay } from '../quiz/GameOverlay';
import { LiveQuizBar } from '../quiz/LiveQuizBar';
import { QuizLibrarySheet } from '../quiz/QuizLibrarySheet';
import { EnablePushNudge } from './EnablePushNudge';
import { ChannelPlaceHeader, type HeaderLens } from './PlaceHeader';
import { CHANNEL_SECTIONS, SectionSwitch, type SectionCounts } from './SectionSwitch';
import {
  ChannelAccessDeniedState,
  ChannelErrorState,
  ChannelPreviewDock,
  ChannelScreenFrame,
} from './states';
import { LawexaMark } from '../ui/avatars';

/**
 * ChannelScreen — the W2 channel client root: detail three-state, ONE header
 * bar ({@link ChannelPlaceHeader}, also published into the shell header via
 * header-context), Chat | Lists | Files as a segmented control rather than a
 * strip, the presence room, the read pointer, and the member/refusal branches.
 * Phase-5 W2; rebuilt in the W2 redesign wave (2026-08-05) after the owner's
 * verdict on the shipped chrome. Sources: plan W2 items 1–2, study A3 verdicts,
 * design-research OWNER FEEL DIRECTIVE, redesign-brief "Channel screen".
 *
 * ── THE CHROME DIET, WHICH WAS THE WHOLE COMPLAINT ────────────────────────
 * What used to sit above the first message on a phone: an identity header with
 * its own hairline, a push nudge with its own hairline, the live-quiz bar, and
 * a tab strip with its own hairline — around 150px, three rules, for a screen
 * whose entire job is the conversation. What sits there now: one `h-14` bar and
 * one hairline. The description became a disclosure on the name, the sections
 * became a control INSIDE the bar (a bottom bar on a phone, hidden while the
 * reader is in Chat), the push nudge lost its rule, and the member/online
 * counts became faces.
 *
 * TAB / URL STATE MODEL. `?tab=` (and the Lists tab's `?list=`) are QUIET
 * URL writes (`quietReplaceUrlParams`): the component owns the state, the
 * URL mirrors it for addressability/refresh/share, and no App Router
 * round-trip fires on a tab switch — the switch paints in the same frame
 * (the feel directive's zero-jank bar). Initial values arrive as
 * navigation-time props from the server shell, so a shared link lands on the
 * right tab and a toast's `?m=` navigation re-arms the deep-link effect via
 * ordinary prop change. Chat is never written (`/channels/{uuid}` IS chat).
 *
 * ONE EXCEPTION TO THE MIRROR: a `?tab=` naming a section this reader cannot
 * reach is corrected in the STATE (see the section invariant below), and the
 * URL keeps the name it arrived with until the reader picks a section
 * themselves. The state is what the screen obeys, so the mirror can lag by one
 * value but the screen is never showing something other than what it says.
 *
 * CHAT KEEPS ITS MOUNT across section switches (v1's forceMount contract): the
 * feed pane is hidden with `visibility: hidden` + `inert` — NEVER `display:
 * none`, which destroys the browser's rendering state and with it the feed's
 * scroll position — so its scroll position, outbox rows, unread anchor and
 * room-fed cache writes survive a detour to Lists or Files. Lists/Files mount
 * per visit (their caches make that cheap, and the URL keeps their selection).
 *
 * ACCESS IS ONE MODEL, READ ONCE ({@link channelAccess}), and every surface on
 * this screen is a consequence of it rather than a second opinion:
 *  - `member`  → all three sections, feed, composer, engagement, the read
 *    pointer, the presence room, the quiz door, the push nudge, governance;
 *  - `preview` (a space member reading a `space_public` channel they never
 *    joined) → THE REAL ROOM, read-only: the same feed, the same pins, the
 *    same roster, the same Lawexa history — with every write affordance ABSENT
 *    rather than present-and-failing, and one obvious way in. Lists and Files
 *    do not appear at all, because their reads are not open (see the model);
 *  - `closed`  (a private channel) → the identity header over a designed
 *    refusal, unchanged;
 *  - 403 on the channel itself (outside the space) → the designed refusal
 *    state (never a redirect, never auto-mapped to verify-email — collab
 *    model's rule).
 *
 * THE BLOCKED READS ARE NOT REQUESTED, WHICH IS THE HARDER HALF. A 403 landing
 * inside a live query is a broken screen, so preview gates by MOUNT: the Files
 * and Lists panes are unreachable (the section control only offers what the
 * access model allows, and `?tab=` resolves back to Chat when it names one it
 * does not), the saved lens and the quiz library never open, `?panel=`/`?game=`
 * values that would open them are refused by `canOpen`, and the read pointer
 * and the presence room are handed `enabled: false`. The two count subscriptions
 * that feed the section control are `enabled: false` and therefore issue no
 * request at all. Nothing on this screen sends a request a previewer's token
 * cannot answer for.
 *
 * CHANNEL SWITCHES REMOUNT WHOLESALE: the route shell keys this component by
 * `channelId`, so tab/reply/dialog state, scroll baselines and the feed's
 * unread anchor can never leak from one channel into another (v1 keyed its
 * body the same way).
 *
 * GAME MODE (W6). A live quiz is a MODE over this screen, not a route away
 * from it: `?game={uuid}` mounts `GameOverlay` across the whole channel — over
 * the header bar and the section bar as well as the panes — so nothing
 * underneath reflows and the chat keeps its scroll, its history and its
 * presence room while the game runs. It is also the one overlay param that
 * arrives from OUTSIDE this screen — the go-live notification pushes it onto a
 * channel the reader may already be reading — so it is adopted on prop change
 * as well as at mount (see the adoption effect below), and a previewer who
 * cannot enter is told so in the dock instead of meeting silence.
 *
 * EVERY OVERLAY ANSWERS BACK (owner round, Aug 4). `?game=` and the `?panel=`
 * family — edit, members, pinned, saved, quizzes and the Lawexa sessions sheet
 * — all run on the shared {@link useUrlOverlay}, which W6's hand-rolled block
 * here was the prototype for: open PUSHes one entry, re-targeting REPLACES,
 * dismissal walks back over that entry, and one `popstate` adopter settles it
 * all. Two params rather than one because a game is a MODE that can be running
 * while a panel is open, so they must be able to coexist; the six panels are
 * mutually exclusive and share one.
 *
 * THE SESSIONS SHEET IS THE `swap()` CASE. Its two levels live in one value —
 * `ai` is the list, `ai:{uuid}` is one transcript — so drilling in costs no
 * history entry and Back leaves the sheet rather than walking back up through
 * it. Its own back chevron is what returns to the list.
 */
export function ChannelScreen({
  channelUuid,
  initialTab,
  initialListUuid,
  initialGameUuid,
  targetMessageUuid,
}: {
  channelUuid: string;
  initialTab: ChannelTab;
  initialListUuid: string | null;
  initialGameUuid: string | null;
  targetMessageUuid: string | null;
}) {
  const session = useV2Session();
  const viewerId = session.userId;
  // The uuid identity for message-authorship checks — the sanctioned bridge,
  // primitive selector (stable snapshot).
  const viewerUuid = useAuthStore((state) => state.user?.uuid ?? null);

  const detailQuery = useQuery(channelsQueries.detail(channelUuid, { viewerId }));
  const channel = detailQuery.data?.data;
  /** `null` until the channel lands — every gate below reads `undefined` in
   *  that window rather than guessing, so a pending screen opens no panel and
   *  refuses no deep link it would have honoured a frame later. */
  const access = channel ? channelAccess(channel) : null;
  const canRead = access?.canRead === true;
  const canParticipate = access?.canParticipate === true;

  /* ── The people in the header, and in the channel's intro ─────────────────
        The header shows FACES now, not the word "4 members", so it needs the
        roster. This is the SAME cache entry the composer's mention
        autocomplete and the members sheet already read, so on a member's
        screen it costs no extra request; for a previewer it is one request the
        access model explicitly allows (the roster read is open in preview) and
        gated on `canRead` so a private-channel refusal never asks. */
  const rosterQuery = useQuery({
    ...channelsQueries.members(channelUuid, { viewerId }),
    enabled: canRead,
  });
  const memberFaces = useMemo<readonly SlimUser[]>(() => {
    const rows = rosterQuery.data?.data;
    if (!rows) return NO_FACES;
    return rows.filter((member) => member.is_active).map((member) => member.user);
  }, [rosterQuery.data]);

  /* ── The section counts, read from cache and never fetched ────────────────
        `enabled: false` subscribes to the two caches without ever issuing a
        request: the Lists and Files sections fill them when they are opened,
        and until then the segmented control simply shows no number rather than
        a zero it has not earned. It also means a previewer's screen — whose
        Lists and Files reads are blocked — asks for nothing at all here. */
  const listsCount = useQuery({
    ...channelsQueries.taskLists({ channelUuid, viewerId }),
    enabled: false,
  }).data?.pagination.total;
  const filesCount = useQuery({
    ...channelsQueries.files({ channelUuid, viewerId }),
    enabled: false,
  }).data?.pagination.total;
  const sectionCounts = useMemo<SectionCounts>(
    () => ({ lists: listsCount, files: filesCount }),
    [listsCount, filesCount],
  );

  /* Both are MEMBER-ONLY transports and both are gated at the source. The
     presence room admits active channel members alone (`broadcasting/auth`
     refuses everyone else), and `POST /read` is on the blocked list — so a
     previewer joins no room and advances no pointer, and therefore has no
     unread state anywhere on this screen. */
  const room = useChannelRoom(channelUuid, { enabled: canParticipate });
  const reporter = useChannelReadPointer(channelUuid, { enabled: canParticipate });

  // Initialise from the LIVE URL when it exists: quiet writes mirror state
  // into the URL without touching the router's cached searchParams, so a
  // Back/Forward restore can serve this page with STALE props while the URL
  // is current — the address bar is the truth. SSR (no window) and first
  // client render agree via the prop fallback (both derive from the same
  // navigation URL, so hydration can't diverge).
  const [tab, setTab] = useState<ChannelTab>(() => {
    if (typeof window === 'undefined') return initialTab;
    return parseChannelTab(
      new URLSearchParams(window.location.search).get('tab') ?? initialTab,
    );
  });
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  /** Both are destructive confirmations, so both stay OUT of the URL: a
   *  refresh-surviving link that re-opens "Delete this channel?" is an armed
   *  trigger, and neither dialog's meaning survives a restore. */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [membershipActionError, setMembershipActionError] = useState<string | null>(null);
  const composerRef = useRef<ChannelComposerHandle>(null);
  const feedRef = useRef<ChannelFeedHandle>(null);

  // Derived here, above the three-state branches, because the panel gate needs
  // both and hooks cannot run after a return. `canManage` is re-used verbatim
  // by the header menu below, so the gate and the affordance cannot drift.
  const canManage = channel ? canManageChannel(channel) : false;

  /**
   * Every panel over this channel — the edit dialog, the roster, the pinned and
   * saved lenses, the quiz library and the Lawexa sessions sheet — is one value
   * of `?panel=`. They are lenses over the SAME channel (design-research
   * DIRECTION 14), never a second place to read messages, so only one is ever
   * open and one param carries them all.
   *
   * `canOpen` MATTERS MORE HERE THAN ANYWHERE, and it is where preview is
   * enforced against a copied URL. The three READ lenses — the roster, the
   * pins and the Lawexa history — are open to a previewer, so they gate on
   * `canRead`. The two WRITE surfaces do not: `?panel=saved` would fetch a
   * bookmark list a previewer may not have, and `?panel=quizzes` a library
   * they cannot play from, so both gate on `canParticipate` and simply do not
   * open. `edit` stays on `canManage`, or a copied link would hand a reader
   * the admin form prefilled with the channel's name, description and
   * visibility. Gate keys are panel FAMILIES, so `ai` covers `ai:{uuid}` as
   * well. `undefined` until the channel lands: the pending screen renders no
   * panels, and refusing on an unresolved role would strip a real admin's
   * deep link.
   */
  const panel = useUrlOverlay('panel', {
    canOpen: channel
      ? {
          edit: canManage,
          members: canRead,
          pinned: canRead,
          saved: canParticipate,
          quizzes: canParticipate,
          ai: canRead,
        }
      : undefined,
  });
  /** The Lawexa sheet's two levels ride one value: `ai` is the session list,
   *  `ai:{uuid}` is one transcript. Deriving them here means the sheet needs no
   *  syncing effect for its two entrances (the channel menu, and "view this
   *  conversation" on any Lawexa reply). */
  const aiSessionUuid = panel.value?.startsWith(AI_PANEL_PREFIX)
    ? panel.value.slice(AI_PANEL_PREFIX.length)
    : null;
  const aiOpen = panel.value === 'ai' || aiSessionUuid !== null;

  /* ── Game mode (W6). Its OWN param, not a `?panel=` value: a game is a mode
        that covers the screen, and a panel may be open behind it. The SSR
        fallback is real here because `GameOverlay` renders IN TREE — an overlay
        that only ever portals can hydrate from the URL alone. ─────────────── */
  const game = useUrlOverlay('game', {
    ssrValue: initialGameUuid,
    // Values are bare uuids, so the gate is the whole param: joining a quiz is
    // on the blocked list, so only a participant reaches the branch that
    // renders `GameOverlay` — and therefore only a participant's screen ever
    // asks the quiz endpoints for anything.
    canOpen: channel ? canParticipate : undefined,
  });
  const closeGame = game.close;
  const gameUuid = game.value;
  const { show: showGame } = game;

  /**
   * THE NAVIGATION'S `?game=` IS ADOPTED WHENEVER IT ARRIVES, not only when this
   * screen is born — which is what makes the go-live notification work for its
   * likeliest recipient.
   *
   * `ssrValue` alone could never do it. It is consulted only where there is no
   * `window`, so on the client the hook reads the LIVE URL — once, in its lazy
   * initialiser — and `popstate` is its only other adopter. Neither fires for the
   * reader who is already sitting in `/channels/{uuid}` when a quiz starts there:
   * the bell pushes `/channels/{uuid}?game={game}`, the route shell keys this
   * component by `channelId` so React does NOT remount it, and a push is not a
   * pop. The overlay stayed `null` and the address bar kept a `?game=` nothing on
   * screen answered to — until some unrelated panel's `close()` walked back over
   * an entry carrying it and sprang the game open minutes later. The prop is the
   * one signal that does change, so the prop is what this reads. (`?m=` re-arms on
   * prop change and `?tab=` falls back to its prop; `?game=` did neither.)
   *
   * AN EFFECT, NOT A RENDER-PHASE ADJUST, and the reason is timing. Next applies a
   * navigation's URL in `HistoryUpdater`'s `useInsertionEffect` — after the render
   * pass that delivered these props — so during that render `window.location`
   * still reads the PREVIOUS address. Adopting from render would therefore be
   * read straight back as stripped (the hook re-checks the live URL every render),
   * and calling `show` from render would find no `?game=` yet and quietly PUSH one
   * — a history write from a render, and a duplicate entry for Back to land on and
   * re-open the game from. By the time an effect runs, the insertion effect has
   * already moved the address bar, so `show` finds the live URL equal to the value
   * and returns having touched no history at all: it only adopts into state. It
   * cannot fight the quiet-writer rule because it never writes.
   *
   * IT CANNOT RE-OPEN A GAME THE READER CLOSED. Its only trigger is a CHANGE of
   * `initialGameUuid`, and that is a navigation-time prop: closing the overlay is a
   * quiet history write, which by construction never reaches the App Router and so
   * never re-renders this page with new props. A dismissal is final.
   *
   * `canOpen` STILL RULES. `show` refuses a value this reader may not open, so a
   * previewer's deep link degrades to the honest line in the join dock below
   * rather than to a lobby they cannot enter.
   *
   * KNOWN LIMIT, stated rather than hidden: re-delivering the SAME uuid changes no
   * prop, so clicking the same bell row twice after dismissing that same lobby
   * will not re-open it (the URL says `?game=`, the screen does not). Covering it
   * needs a per-navigation signal this screen does not have; the alternative —
   * re-arming whenever the overlay goes empty — would re-open the game the instant
   * the reader closed it, because `close()`'s `history.back()` has not landed yet.
   */
  useEffect(() => {
    if (initialGameUuid === null) return;
    showGame(initialGameUuid);
  }, [initialGameUuid, showGame]);

  // `?tab=` is not an overlay — it is a persistent view selector written with
  // REPLACE — but it still has to be re-adopted here, because a Back OUT of a
  // panel or a game restores an entry whose `?tab=` may differ from the tab on
  // screen; reading only the overlay params would leave the strip pointing at
  // Lists while the chat is shown. (`?list=` belongs to `ListsTab`, which
  // adopts it through its own hook.)
  useEffect(() => {
    const onPopState = () => {
      setTab(parseChannelTab(new URLSearchParams(window.location.search).get('tab')));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const router = useRouter();
  const joinMutation = useJoinChannel(channelUuid);
  const leaveMutation = useLeaveChannel(channelUuid);
  const deleteMutation = useDeleteChannel(channelUuid);
  const notifyMutation = useSetChannelNotifyLevel(channelUuid);

  /* NOTHING IS PUBLISHED INTO THE SHELL HEADER'S CENTRE SLOT ANY MORE. This
     screen used to `setHeaderContext({ title })`, which was already dead: the
     collab routes hand the shell their own header slot, and `V2Header`'s
     centre only renders published context on routes that have not. Keeping the
     call would have been a second, invisible owner of the channel's name — and
     the name has exactly one owner on this screen, the header bar below. */

  /**
   * SETTERS ARE LISTED, NOT ASSUMED, in this component's dependency arrays.
   * The section invariant below adjusts `tab` during render, and React Compiler
   * then treats these setters as ordinary dependencies rather than as the
   * always-stable values they are; an inferred dependency that is missing from
   * the source array makes it skip optimising the WHOLE component. Listing them
   * costs nothing at runtime — a `useState` setter's identity never changes, so
   * these callbacks are still created once.
   */
  const selectTab = useCallback((next: ChannelTab) => {
    setTab(next);
    quietReplaceUrlParams({
      tab: next === 'chat' ? null : next,
      // Leaving Lists keeps `?list=` so a return trip restores the selection;
      // the param is meaningless on other tabs and harmless in the URL.
    });
  }, [setTab]);

  /** Show the file library — the composer's "it landed in Files" offer. */
  const openFiles = useCallback(() => selectTab('files'), [selectTab]);

  // The hook's dispatchers are stable; the hook OBJECT is not, so the
  // dispatchers are what the callbacks below depend on — the same rule the
  // composer/feed callbacks follow, and what keeps the memoised rows still.
  const { show: showPanel, swap: swapPanel, closeInPlace: closePanel } = panel;

  /** Land on a message from a panel: close the panel and go back to Chat, then
   *  let the feed resolve it — it pulls older pages when the message isn't
   *  loaded, and gives up silently when it can't be reached. The Chat pane keeps
   *  its mount across tabs, so the imperative handle is live even when the
   *  reader was on Lists or Files.
   *
   *  IN PLACE, not a dismissal: the panel's entry is rewritten rather than
   *  popped, because the `?tab=` write on the next line would otherwise land on
   *  an entry a queued `history.back()` is about to discard — and the reader
   *  would be returned to the tab and the panel they just left. */
  const jumpToMessage = useCallback(
    (messageUuid: string) => {
      closePanel();
      selectTab('chat');
      feedRef.current?.jumpToMessage(messageUuid);
    },
    [closePanel, selectTab],
  );

  /** Enter game mode. Any panel over the channel — in practice the quiz library
   *  the reader started from — closes IN PLACE for the same reason: the `?game=`
   *  push below has to land on an entry that survives. */
  const openGame = useCallback(
    (nextGameUuid: string) => {
      closePanel();
      showGame(nextGameUuid);
    },
    [closePanel, showGame],
  );
  const openAiSession = useCallback(
    (nextSessionUuid: string) => showPanel(`${AI_PANEL_PREFIX}${nextSessionUuid}`),
    [showPanel],
  );
  /** Move between the sheet's list and one transcript WITHOUT a history entry —
   *  the whole sheet is one stop, so Back leaves it rather than walking up. */
  const selectAiSession = useCallback(
    (nextSessionUuid: string | null) =>
      swapPanel(
        nextSessionUuid === null ? 'ai' : `${AI_PANEL_PREFIX}${nextSessionUuid}`,
      ),
    [swapPanel],
  );

  /** The previewer's one way in, handed to the dock that stands where the
   *  composer stands. The server's sentence on failure lands there too, beside
   *  the button that produced it — never a toast.
   *
   *  `justJoined` exists ONLY to animate the swap that follows. A channel a
   *  member simply opens must not play an entrance — the composer is where it
   *  always was — so the transition is armed by the act of joining rather than
   *  by the composer mounting. */
  const joinMutate = joinMutation.mutate;
  const [justJoined, setJustJoined] = useState(false);
  const handleJoin = useCallback(() => {
    setMembershipActionError(null);
    joinMutate(undefined, {
      onSuccess: () => setJustJoined(true),
      onError: (error) => setMembershipActionError(extractApiError(error).message),
    });
  }, [joinMutate]);

  /** `setReplyTo` is listed for the reason given on {@link selectTab}. */
  const handleStartReply = useCallback((message: Message) => {
    setReplyTo(message);
    composerRef.current?.focus();
  }, [setReplyTo]);

  const focusComposer = useCallback(() => {
    composerRef.current?.focus();
  }, []);

  const handleSentSuccess = useCallback(
    (serverUuid: string) => {
      // Sending marks read (§5's second trigger).
      reporter.markReadNow(serverUuid);
    },
    [reporter],
  );

  /* ── Three-state detail region ────────────────────────────────────────── */

  if (detailQuery.isPending) {
    return <ChannelScreenFrame />;
  }

  // `!access` is the SAME condition as `!channel` (it is derived from it),
  // restated so the type narrows for the render below without an assertion.
  if (detailQuery.isError || !channel || !access) {
    const status = detailQuery.isError
      ? extractApiError(detailQuery.error).status
      : 0;
    if (status === 403) {
      return (
        <div className="mx-auto w-full max-w-3xl px-4">
          <ChannelAccessDeniedState />
        </div>
      );
    }
    return (
      <div className="mx-auto w-full max-w-3xl px-4">
        <ChannelErrorState onRetry={() => void detailQuery.refetch()} />
      </div>
    );
  }

  const notifyLevel: NotifyLevel = channel.my_notify_level ?? 'all';
  /** A space member reading a public channel they have not joined. Named
   *  because several affordances exist ONLY here (the read-only Lawexa door,
   *  the dock that stands where the composer stands). */
  const isPreview = access.state === 'preview';

  /* WHICH SECTIONS THIS READER CAN REACH — derived from the access model, one
     entry per tab, so the control and the pane can never disagree about what is
     available. Chat is the room itself and is open to anyone who may read it;
     Lists and Files each hang off their own capability, because their reads
     are separate rulings (and the lists one may yet open — see
     `channelAccess`). */
  const sectionAvailable: Record<ChannelTab, boolean> = {
    chat: true,
    lists: access.canReadLists,
    files: canParticipate,
  };
  const sections = CHANNEL_SECTIONS.filter((entry) => sectionAvailable[entry.id]);

  /* THE READING LENSES — pins, private saves, and (for a previewer, who has no
     menu to hold it) Lawexa's history. They are one segmented object in the
     header because they are one KIND of move: a lens over this channel's own
     messages, never a second place to read them (DIRECTION 14). Each is gated
     by what its endpoint will actually answer. */
  const lenses: HeaderLens[] = [];
  if (canRead) {
    lenses.push({
      id: 'pinned',
      label: 'Pinned messages',
      icon: Pin,
      onSelect: () => panel.show('pinned'),
    });
  }
  if (canParticipate) {
    lenses.push({
      id: 'saved',
      label: 'Saved messages (private to you)',
      icon: Bookmark,
      onSelect: () => panel.show('saved'),
    });
  }
  if (isPreview) {
    lenses.push({
      id: 'ai',
      label: 'Lawexa sessions',
      icon: LawexaMark,
      onSelect: () => panel.show('ai'),
    });
  }

  /* NO JOIN IN THE MENU, AND NO JOIN IN THE HEADER. A previewer's way in lives
     in the dock at the foot of the transcript — always visible, at the place
     the reply would have come from, carrying the server's sentence when an
     attempt fails. A second control up here would be the same action twice,
     and the failure would land at the other end of the screen from the press.
     A previewer therefore has NO overflow at all: everything in this menu is a
     setting or a write they do not have. */
  const channelMenu = canParticipate ? (
    <>
      {/* Below `xl:` the sections live in a bottom bar that is hidden while the
          reader is in Chat — so this is the door OUT of the conversation, and
          the bar is how they come back. At `xl:`+ the segmented control in the
          header already does both jobs, and this group is gone. */}
      {sections.length > 1 && (
        <DropdownMenuGroup className="xl:hidden">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Sections
          </DropdownMenuLabel>
          {sections
            .filter((entry) => entry.id !== 'chat')
            .map((entry) => (
              <DropdownMenuItem key={entry.id} onClick={() => selectTab(entry.id)}>
                <entry.icon aria-hidden className="size-4" />
                {entry.label}
              </DropdownMenuItem>
            ))}
          <DropdownMenuSeparator />
        </DropdownMenuGroup>
      )}

      <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Bell aria-hidden className="size-3.5" />
        Notifications
      </DropdownMenuLabel>
      {/* N1: the mutation assigns `my_notify_level` into every cached channel
          row + re-rolls the space (Ruling A). */}
      <DropdownMenuRadioGroup
        value={notifyLevel}
        onValueChange={(value) => notifyMutation.mutate(value as NotifyLevel)}
      >
        <DropdownMenuRadioItem value="all">All messages</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="mentions_only">
          Mentions only
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="muted">Muted</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => panel.show('members')}>
        <Users aria-hidden className="size-4" />
        Members
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => panel.show('ai')}>
        <LawexaMark />
        Lawexa sessions
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => panel.show('quizzes')}>
        <Trophy aria-hidden className="size-4" />
        Quizzes
      </DropdownMenuItem>
      {canManage && (
        <DropdownMenuItem onClick={() => panel.show('edit')}>
          <Pencil aria-hidden className="size-4" />
          Edit channel
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={() => setLeaveOpen(true)}>
        <LogOut aria-hidden className="size-4" />
        Leave channel
      </DropdownMenuItem>
      {canManage && (
        <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 aria-hidden className="size-4" />
          Delete channel
        </DropdownMenuItem>
      )}
    </>
  ) : undefined;

  const identityHeader = (
    <ChannelPlaceHeader
      channel={channel}
      members={memberFaces}
      onlineCount={room.onlineCount}
      // The roster read is open to a previewer too — only the private-channel
      // refusal leaves the stack as a plain, unopenable mark.
      onOpenRoster={canRead ? () => panel.show('members') : undefined}
      sections={sections}
      section={tab}
      onSelectSection={selectTab}
      sectionCounts={sectionCounts}
      lenses={lenses}
      menu={channelMenu}
    />
  );

  /* ── Closed: a private channel the reader is not in ───────────────────────
        The ONE refusal that survived the ruling, and the only branch that
        renders no feed at all — the history request would 403, so it is never
        made. The channel's identity still stands above it: knowing the room
        exists is not the same as reading it, and the space's channel list
        already showed them the name.

        WHETHER THIS BRANCH IS EVER REACHED IS AN OPEN QUESTION, recorded where
        the assumption lives (`v2/features/collab/access.tsx`). If the server
        refuses a private channel's DETAIL to a space member who never joined,
        the reader lands on `ChannelAccessDeniedState` instead and never gets
        here. Both panels now say the same true thing in their own words, so
        the reader is told nothing we have not established either way. ─────── */
  if (!canRead) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {identityHeader}
        <div className="mx-auto w-full max-w-3xl flex-1 px-4">
          <CollabMessage
            icon={Lock}
            tone="neutral"
            title={`${channel.name} is private`}
            description="Only its members can read this channel. Ask someone already in it to add you."
          />
        </div>
      </div>
    );
  }

  /* ── Member and previewer: ONE room, two sets of affordances ──────────────
        Deliberately one tree rather than two. The panes, the header and the
        dock sit at the same positions in both, so JOINING does not remount
        anything and — since the redesign — does not resize anything either:
        the composer replaces the dock, the header's lens segment and overflow
        appear INSIDE a bar whose height never changes, and the feed keeps its
        scroll, its loaded history and the reader's place in the conversation.
        ──────────────────────────────────────────────────────────────────── */
  const gameOpen = gameUuid !== null;

  /* AN UNREACHABLE SECTION IS CORRECTED IN THE STATE, NOT MASKED IN THE RENDER.
     Resolving `tab` to Chat for display while leaving the state on `files` puts
     a trap under the join button: the moment `is_member` flips, `files` becomes
     available again and a reader who pressed "Join to reply" is dropped into a
     file browser mid-conversation. They asked for Files before they could reach
     it; what they were actually doing was READING, and joining must leave them
     there.

     A guarded render-phase adjustment — React's own answer for "state that has
     to change because something it was derived from changed" — and it
     converges: Chat is always available, so the branch cannot fire twice. The
     URL keeps the section it named until the reader picks one (a history write
     is a side effect and cannot happen here); the state is what the screen
     obeys, so nothing on screen ever disagrees with it.

     There is no second, render-level mask any more: React discards the output
     of a render that adjusts its own state — the children of that pass are
     never rendered and no blocked query can fire from it — so `tab` is the one
     source of truth for which section is on screen. */
  if (!sectionAvailable[tab]) setTab('chat');

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* EVERYTHING THE GAME MODE COVERS lives inside this one wrapper so it
          can be made `inert` in one place. Covering the channel visually is
          not enough: without this, Shift+Tab out of the game walks straight
          into the composer, the tab strip and the live bar's Join — controls
          the reader cannot see, one of which would push another history
          entry — and a screen reader would read the whole chat underneath as
          if the game were not there. `inert` removes the subtree from focus,
          hit-testing and the accessibility tree together, which is exactly the
          promise the overlay is making visually.

          The wrapper is a column flex child (`min-h-0 flex-1`), so the header/
          tabs/panes geometry inside it is byte-identical to before. */}
      <div className="flex min-h-0 flex-1 flex-col" inert={gameOpen}>
        {identityHeader}

        {/* The earned moment for closed-app push (W5). Members only: a
            previewer gets no notifications from a channel they have not
            joined, so asking them for permission would be asking for nothing.
            Renders a zero-height inert row when there is nothing to ask. */}
        {canParticipate && <EnablePushNudge />}

        {/* The standing door into a running game (W6) — renders nothing at all
            when no quiz is live here, so the channel's geometry is unchanged
            the rest of the time. Members only, and this is a MOUNT gate, not a
            visual one: the bar probes for a live game, and joining one is on
            the blocked list, so a previewer's screen must not ask. */}
        {canParticipate && (
          <LiveQuizBar
            channelUuid={channel.uuid}
            viewerId={viewerId}
            onOpenGame={openGame}
          />
        )}

        {/* THE TAB STRIP IS GONE, AND ITS ROW AND HAIRLINE WITH IT. The
            sections now ride inside the header bar at `md:`+ and in a bottom
            bar on a phone (below), so a reader in Chat — which is nearly all
            of channel-time — pays nothing at all for them.

            IT ALSO RETIRES THE JOIN-TIME SNAP. The strip used to appear the
            instant a previewer joined, shortening the scroll viewport by ~41px
            in one frame at exactly the moment they pressed a button promising
            to leave them where they were; the grid-rows tween was there to
            soften that. Neither the header (fixed at `h-14`) nor the bottom bar
            (hidden in Chat, and a previewer is always in Chat) changes height
            on join, so the event the tween existed for cannot happen. */}

        {/* The pane region: every pane fills the same box (absolute stacking).
            Chat KEEPS ITS MOUNT and, when inactive, is hidden with
            `visibility: hidden` + `inert` — NOT `display: none`, which destroys
            the browser's rendering state and with it the feed's scroll position
            (the exact thing the forceMount contract exists to preserve).
            Lists/Files mount per visit and restore from cache + URL. */}
        <div className="relative min-h-0 flex-1">
          <div
            role="tabpanel"
            aria-label="Chat"
            inert={tab !== 'chat'}
            className={cn(
              'absolute inset-0 flex min-h-0 flex-col',
              tab !== 'chat' && 'invisible',
            )}
          >
            <ChannelFeed
              ref={feedRef}
              channel={channel}
              viewerId={viewerId}
              viewerUuid={viewerUuid}
              reporter={reporter}
              canParticipate={canParticipate}
              active={tab === 'chat'}
              targetMessageUuid={targetMessageUuid}
              members={memberFaces}
              respondingTurns={room.respondingTurns}
              onStartReply={handleStartReply}
              onFocusComposer={focusComposer}
              onOpenRoster={() => panel.show('members')}
              // Inviting is governance, so the intro only offers it to someone
              // who can actually complete it.
              onAddPeople={canManage ? () => panel.show('members') : undefined}
              onViewAiSession={openAiSession}
              onOpenGame={openGame}
              composer={
                canParticipate ? (
                  /* THE SWAP IS A TRANSITION, NOT A CUT — but only the one that
                     follows a join. The dock leaves as the composer arrives, so
                     the incoming pill rises the short distance the dock's card
                     occupied instead of blinking into place. A member opening
                     the channel normally gets no entrance at all, and
                     `motion-reduce` gets none either. */
                  <div
                    className={cn(
                      justJoined &&
                        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200',
                    )}
                  >
                    <ChannelComposer
                      ref={composerRef}
                      channel={channel}
                      viewerId={viewerId}
                      replyTo={replyTo}
                      onCancelReply={() => setReplyTo(null)}
                      onTyping={room.notifyTyping}
                      typingUsers={room.typingUsers}
                      onSentSuccess={handleSentSuccess}
                      onOpenFiles={openFiles}
                      // The composer's one reason to move the transcript: a
                      // message restored from the device that failed to send in
                      // an earlier session sits at its own timestamp, far above
                      // where the reader landed. Same jump the pinned and saved
                      // panels use.
                      onJumpToMessage={jumpToMessage}
                    />
                  </div>
                ) : (
                  /* The dock stands where the composer stands, in the same
                     column and at the same cap, so the reader meets the way IN
                     at the place the reply would have come from. It is a taller
                     card and its sentence can wrap on a narrow phone, so it is
                     not the composer's height — the feed measures the dock live
                     (`--v2-chan-dock-h`) and reserves whatever it actually
                     takes. */
                  /* THE QUIZ NOTE IS FOR A REAL AUDIENCE, not a leftover. A
                     `space_public` channel's go-live notification goes to the
                     WHOLE SPACE, so a space member previewing a room they never
                     joined is one of its intended recipients — and `canOpen`
                     correctly refuses them the lobby (joining a game is on the
                     blocked list). Refusing is right; arriving at a silent
                     transcript with no mention of the quiz is not. The signal is
                     the navigation's own `?game=`, not the live URL, because the
                     refusal effect strips the param from the address bar a frame
                     later — the prop is what survives it. */
                  <ChannelPreviewDock
                    channelName={channel.name}
                    quizIsLive={initialGameUuid !== null}
                    onJoin={handleJoin}
                    isJoining={joinMutation.isPending}
                    error={membershipActionError}
                  />
                )
              }
            />
          </div>

          {tab === 'lists' && (
            <div
              role="tabpanel"
              aria-label="Lists"
              className="absolute inset-0 flex min-h-0 flex-col"
            >
              <ListsTab
                channel={channel}
                viewerId={viewerId}
                viewerUuid={viewerUuid}
                initialListUuid={initialListUuid}
              />
            </div>
          )}

          {tab === 'files' && (
            <div
              role="tabpanel"
              aria-label="Files"
              className="absolute inset-0 flex min-h-0 flex-col"
            >
              <FilesTab channel={channel} viewerId={viewerId} />
            </div>
          )}
        </div>

        {/* THE NARROW-PANE SECTION BAR — and it is HIDDEN IN CHAT,
            deliberately. A segmented bar that is always on screen is a
            permanent tab strip wearing a different shape; the conversation is
            where a reader spends almost all of their time here, and it should
            spend nothing on navigation it is not using. The way OUT of Chat is
            the header's overflow, which carries the sections at these widths;
            the way BACK is this bar, which is on screen for exactly as long as
            the reader is somewhere they need to leave.

            `xl:hidden`, not `md:hidden`: below `xl:` the channel PANE is not
            the viewport — the app sidebar and, from `lg:`, the docked space
            rail are taking their share — so this is the right control for a
            ~500px column whether that column is a phone or a desktop window.
            The header's own segment takes over at `xl:` (see `PlaceHeader`).

            It opens and closes on the same symmetric grid-rows tween as every
            other reveal in the feature, and the feed's viewport keeper holds
            the transcript bottom-anchored through the height change. */}
        {sections.length > 1 && (
          <div
            aria-hidden={tab === 'chat'}
            inert={tab === 'chat'}
            className={cn(
              'grid shrink-0 xl:hidden',
              'transition-[grid-template-rows] duration-200 ease-out',
              'motion-reduce:transition-none',
              tab === 'chat' ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
            )}
          >
            <div className="overflow-hidden">
              <div className="v2-safe-bottom border-t px-4 py-2">
                <div className="mx-auto w-full max-w-3xl">
                  <SectionSwitch
                    sections={sections}
                    value={tab}
                    onChange={selectTab}
                    counts={sectionCounts}
                    density="bar"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Game mode ───────────────────────────────────────────────────
          Covers the WHOLE screen, header and tabs included: a live game is a
          mode, and nothing under it may reflow while it runs. The chat stays
          mounted behind, so leaving the game is instant and lands exactly
          where the reader was. */}
      {gameUuid && (
        <GameOverlay
          key={gameUuid}
          channelUuid={channel.uuid}
          gameUuid={gameUuid}
          viewerId={viewerId}
          viewerUuid={viewerUuid}
          onClose={closeGame}
        />
      )}

      {/* ── Sheets & dialogs ──────────────────────────────────────────────
          The WRITE surfaces are mount-gated, not just `canOpen`-gated: each of
          them fetches on open, and their endpoints are on the blocked list, so
          a previewer's tree must not contain them at all. The three READ
          lenses below stay mounted for both audiences — their queries are
          `enabled: open`, and both audiences may open them. */}
      {canParticipate && (
        <QuizLibrarySheet
          channel={channel}
          viewerId={viewerId}
          onOpenGame={openGame}
          {...panel.bind('quizzes')}
        />
      )}

      {/* Unpin is a write, so a previewer gets the list without the verb —
          the same reading surface, minus a control that would only 403. */}
      <PinnedMessagesSheet
        channel={channel}
        viewerId={viewerId}
        canUnpin={canParticipate}
        onJumpToMessage={jumpToMessage}
        {...panel.bind('pinned')}
      />

      {canParticipate && (
        <SavedMessagesSheet
          channel={channel}
          viewerId={viewerId}
          onJumpToMessage={jumpToMessage}
          {...panel.bind('saved')}
        />
      )}

      {/* Not `bind`: this sheet answers to TWO values (`ai` and `ai:{uuid}`),
          so its open test is a prefix rather than an equality. Reading the
          history is open to a previewer; RESETTING the session is not, so the
          footer that offers it is gated rather than the sheet. */}
      <ChannelAiSessionsSheet
        channelUuid={channel.uuid}
        channelName={channel.name}
        viewerId={viewerId}
        canReset={canParticipate}
        open={aiOpen}
        onOpenChange={(next) => {
          if (!next) panel.close();
        }}
        sessionUuid={aiSessionUuid}
        onSelectSession={selectAiSession}
        onJumpToMessage={jumpToMessage}
      />

      <ChannelMembersSheet
        channel={channel}
        viewerId={viewerId}
        viewerUuid={viewerUuid}
        {...panel.bind('members')}
      />

      {/* Never mounted on `open` — keyed on `openKey` instead, so it stays
          through its closing transition and remounts on each opening with its
          fields re-derived from the current channel (the house dialog
          contract). The one gate is governance, which does not change while
          the dialog is on screen. */}
      {canManage && (
        <ChannelEditDialog
          key={panel.keyFor('edit')}
          channel={channel}
          {...panel.bind('edit')}
        />
      )}

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {channel.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You&rsquo;ll stop receiving messages from this channel. You can
              rejoin later if it&rsquo;s public or you&rsquo;re invited again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaveMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                leaveMutation.mutate(undefined, {
                  onSuccess: () => {
                    setLeaveOpen(false);
                    router.push(`/spaces/${channel.space.uuid}`);
                  },
                });
              }}
              disabled={leaveMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leaveMutation.isPending && (
                <Loader2 aria-hidden className="mr-1 size-4 animate-spin" />
              )}
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {channel.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the channel and its messages for everyone. This
              can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                deleteMutation.mutate(undefined, {
                  onSuccess: () => {
                    setDeleteOpen(false);
                    router.push(`/spaces/${channel.space.uuid}`);
                  },
                });
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 aria-hidden className="mr-1 size-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** `?panel=ai` is the Lawexa session list; `?panel=ai:{uuid}` is one transcript
 *  inside it. A uuid never contains `:`, so the split is unambiguous. */
const AI_PANEL_PREFIX = 'ai:';

/** One frozen empty roster, so a channel whose members have not arrived hands
 *  the header and the intro the SAME array every render (a fresh `[]` would
 *  re-render both on every unrelated cache write). */
const NO_FACES: readonly SlimUser[] = [];

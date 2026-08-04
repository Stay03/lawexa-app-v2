'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Bookmark,
  Hash,
  Loader2,
  Lock,
  LogOut,
  MoreHorizontal,
  Pencil,
  Pin,
  Sparkles,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/lib/stores/authStore';
import { extractApiError } from '@/lib/utils/api-error';
import type { Message, NotifyLevel } from '@/types/collab';
import { channelAccess } from '@/v2/features/collab/access';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import { quietReplaceUrlParams } from '@/v2/runtime/url-params';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import { useV2Session } from '@/v2/runtime/session-context';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { TabRow } from '@/v2/shell/TabRow';
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
import {
  ChannelAccessDeniedState,
  ChannelErrorState,
  ChannelPreviewDock,
  ChannelScreenFrame,
} from './states';

/**
 * ChannelScreen — the W2 channel client root: detail three-state, the
 * identity header (published into the shell header via header-context), the
 * Chat | Lists | Files strip on the ONE TabRow primitive with the tab in the
 * URL, the presence room, the read pointer, and the member/refusal branches.
 * Phase-5 W2; sources: plan W2 items 1–2, study A3 verdicts, design-research
 * OWNER FEEL DIRECTIVE — 2026-08-04.
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
 * CHAT KEEPS ITS MOUNT across tab switches (v1's forceMount contract): the
 * feed pane toggles its display class instead of unmounting, so its scroll
 * position, outbox rows, unread divider and room-fed cache writes survive a
 * detour to Lists or Files. Lists/Files mount per visit (their caches make
 * that cheap, and the URL keeps their selection).
 *
 * ACCESS IS ONE MODEL, READ ONCE ({@link channelAccess}), and every surface on
 * this screen is a consequence of it rather than a second opinion:
 *  - `member`  → tabs, feed, composer, engagement, the read pointer, the
 *    presence room, the quiz door, the push nudge, governance;
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
 * and Lists panes are unreachable (the section strip only offers what the
 * access model allows, and `?tab=` resolves back to Chat when it names one it
 * does not), the saved lens and the quiz library never open, `?panel=`/`?game=`
 * values that would open them are refused by `canOpen`, and the read pointer
 * and the presence room are handed `enabled: false`. Nothing on this screen
 * sends a request a previewer's token cannot answer for.
 *
 * CHANNEL SWITCHES REMOUNT WHOLESALE: the route shell keys this component by
 * `channelId`, so tab/reply/dialog state, scroll baselines and the feed's
 * unread anchor can never leak from one channel into another (v1 keyed its
 * body the same way).
 *
 * GAME MODE (W6). A live quiz is a MODE over this screen, not a route away
 * from it: `?game={uuid}` mounts `GameOverlay` across the whole channel — over
 * the identity header and the tab strip as well as the panes — so nothing
 * underneath reflows and the chat keeps its scroll, its history and its
 * presence room while the game runs.
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

  // Publish the channel name into the shell header's centre slot.
  const channelName = channel?.name ?? null;
  useEffect(() => {
    if (channelName) setHeaderContext({ title: channelName, confidential: false });
    return () => clearHeaderContext();
  }, [channelName]);

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

  // The hook's dispatchers are stable; the hook OBJECT is not, so the
  // dispatchers are what the callbacks below depend on — the same rule the
  // composer/feed callbacks follow, and what keeps the memoised rows still.
  const { show: showPanel, swap: swapPanel, closeInPlace: closePanel } = panel;
  const { show: showGame } = game;

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

  const VisibilityIcon = channel.visibility === 'private' ? Lock : Hash;
  const notifyLevel: NotifyLevel = channel.my_notify_level ?? 'all';
  /** A space member reading a public channel they have not joined. Named
   *  because several affordances exist ONLY here (the read-only Lawexa door,
   *  the dock that stands where the composer stands). */
  const isPreview = access.state === 'preview';

  const identityHeader = (
    <div className="shrink-0 border-b px-4 pt-3 pb-2">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <VisibilityIcon
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="sr-only">{channel.visibility_label}</span>
              <h1 className="truncate text-lg leading-tight font-semibold">
                {channel.name}
              </h1>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <Link
                href={`/spaces/${channel.space.uuid}`}
                className={cn(
                  'rounded transition-colors duration-150 hover:text-foreground motion-reduce:transition-none',
                )}
              >
                {channel.space.name}
              </Link>
              <span aria-hidden>·</span>
              {/* The roster read is open to a previewer, so the count is a
                  door for them too — only the private-channel refusal leaves
                  it as plain text. */}
              {canRead ? (
                <button
                  type="button"
                  onClick={() => panel.show('members')}
                  className="v2-interactive inline-flex items-center gap-1 rounded transition-colors duration-150 hover:text-foreground motion-reduce:transition-none"
                >
                  <Users aria-hidden className="size-3.5" />
                  {channel.active_members_count}{' '}
                  {channel.active_members_count === 1 ? 'member' : 'members'}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Users aria-hidden className="size-3.5" />
                  {channel.active_members_count}{' '}
                  {channel.active_members_count === 1 ? 'member' : 'members'}
                </span>
              )}
              {/* Presence, softened: a quiet count, no green dots (DIRECTION 7). */}
              {room.onlineCount > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span>{room.onlineCount} online</span>
                </>
              )}
            </div>
          </div>

          {/* NO JOIN BUTTON HERE, AND THAT IS THE DESIGN. A previewer's join
              lives in the dock at the foot of the transcript — always visible,
              at the place the reply would have come from, carrying the
              server's sentence when an attempt fails. A second button up here
              would be the same action twice, and the failure would land at the
              other end of the screen from the press. */}
          <div className="flex shrink-0 items-center gap-2">
            {/* The collection affordances — quiet, iconic, beside the menu
                rather than inside it, because they are READING moves the
                reader makes mid-conversation, not settings. Pins are shared
                and their list is open to a previewer; saves are a write the
                previewer does not have, so the bookmark is simply not there. */}
            {canRead && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Pinned messages"
                title="Pinned messages"
                onClick={() => panel.show('pinned')}
              >
                <Pin aria-hidden className="size-4" />
              </Button>
            )}
            {canParticipate && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Saved messages"
                title="Saved messages (private to you)"
                onClick={() => panel.show('saved')}
              >
                <Bookmark aria-hidden className="size-4" />
              </Button>
            )}
            {/* Lawexa's history is open to a previewer, and their cluster has
                no menu to put it in (the menu is settings, and they have
                none), so it stands as its own quiet door. */}
            {isPreview && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Lawexa sessions"
                title="Lawexa sessions"
                onClick={() => panel.show('ai')}
              >
                <Sparkles aria-hidden className="size-4" />
              </Button>
            )}
            {canParticipate && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label="Channel options"
                  >
                    <MoreHorizontal aria-hidden className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Bell aria-hidden className="size-3.5" />
                    Notifications
                  </DropdownMenuLabel>
                  {/* N1: the mutation assigns `my_notify_level` into every
                      cached channel row + re-rolls the space (Ruling A). */}
                  <DropdownMenuRadioGroup
                    value={notifyLevel}
                    onValueChange={(value) =>
                      notifyMutation.mutate(value as NotifyLevel)
                    }
                  >
                    <DropdownMenuRadioItem value="all">
                      All messages
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="mentions_only">
                      Mentions only
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="muted">
                      Muted
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => panel.show('members')}>
                    <Users aria-hidden className="size-4" />
                    Members
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => panel.show('ai')}>
                    <Sparkles aria-hidden className="size-4" />
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
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setLeaveOpen(true)}
                  >
                    <LogOut aria-hidden className="size-4" />
                    Leave channel
                  </DropdownMenuItem>
                  {canManage && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 aria-hidden className="size-4" />
                      Delete channel
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {channel.description && (
          <p
            className="mt-1 line-clamp-1 text-sm text-muted-foreground"
            title={channel.description}
          >
            {channel.description}
          </p>
        )}
      </div>
    </div>
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
            icon={VisibilityIcon}
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
        anything: the composer replaces the dock and the strip opens, while the
        feed keeps its scroll, its loaded history and the reader's place in the
        conversation. ──────────────────────────────────────────────────────── */
  const gameOpen = gameUuid !== null;
  /* WHICH SECTIONS THIS READER CAN REACH — derived from the access model, one
     entry per tab, so the strip and the pane can never disagree about what is
     available. Chat is the room itself and is open to anyone who may read it;
     Lists and Files each hang off their own capability, because their reads
     are separate rulings (and the lists one may yet open — see
     `channelAccess`). */
  const sectionAvailable: Record<ChannelTab, boolean> = {
    chat: true,
    lists: access.canReadLists,
    files: canParticipate,
  };
  const sections = CHANNEL_TABS.filter((section) => sectionAvailable[section.id]);

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

        {/* Chat / Lists / Files — only the sections this reader can reach, and
            NO STRIP AT ALL when that leaves one. A previewer's two other
            destinations are blocked, and a tab strip whose only tab is the one
            already showing is furniture: its absence reclaims a row and a
            hairline for the reader who came to read.

            ALWAYS MOUNTED, ZERO-HEIGHT WHEN HIDDEN — `EnablePushNudge`'s
            grid-rows idiom, reused rather than re-invented (the protect list's
            instruction). It matters here because the strip appears the instant
            a previewer JOINS: snapping ~41px of chrome in above a transcript
            shortens the scroll viewport in one frame and drags the
            conversation out from under the reader. Opening it over 200ms lets
            the feed's viewport-resize keeper follow the change smoothly, and
            `motion-reduce` collapses that to the same instant swap the rest of
            the app makes. Inert and `aria-hidden` while closed, so nothing
            focusable sits at zero height. */}
        <div
          aria-hidden={sections.length <= 1}
          inert={sections.length <= 1}
          className={cn(
            'grid shrink-0 transition-[grid-template-rows] duration-200 ease-out',
            'motion-reduce:transition-none',
            sections.length > 1 ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="border-b px-4">
              <div className="mx-auto w-full max-w-3xl">
                <TabRow
                  tabs={sections}
                  value={tab}
                  onChange={selectTab}
                  ariaLabel="Channel sections"
                  className="flex w-fit items-center gap-4"
                  tabClassName={(selected) =>
                    cn(
                      'v2-interactive relative flex min-h-10 items-center gap-1.5 rounded-none px-0.5 text-sm font-medium',
                      'transition-colors duration-150 motion-reduce:transition-none',
                      selected
                        ? 'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                        : 'text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  {(item) => item.label}
                </TabRow>
              </div>
            </div>
          </div>
        </div>

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
              typingUsers={room.typingUsers}
              respondingTurns={room.respondingTurns}
              onStartReply={handleStartReply}
              onFocusComposer={focusComposer}
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
                      onSentSuccess={handleSentSuccess}
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
                  <ChannelPreviewDock
                    channelName={channel.name}
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
          viewerUuid={viewerUuid}
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

const CHANNEL_TABS: readonly { id: ChannelTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'lists', label: 'Lists' },
  { id: 'files', label: 'Files' },
];

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
  LogIn,
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
 * CHAT KEEPS ITS MOUNT across tab switches (v1's forceMount contract): the
 * feed pane toggles its display class instead of unmounting, so its scroll
 * position, outbox rows, unread divider and room-fed cache writes survive a
 * detour to Lists or Files. Lists/Files mount per visit (their caches make
 * that cheap, and the URL keeps their selection).
 *
 * MEMBERSHIP BRANCHES: member → tabs + feed + composer; non-member of a
 * `space_public` channel → identity header + a designed join panel (the
 * teach-and-act empty-state grammar); 403 → the designed refusal (never a
 * redirect, never auto-mapped to verify-email — collab model's rule).
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
  const isMember = channel?.is_member === true;

  const room = useChannelRoom(channelUuid, { enabled: isMember });
  const reporter = useChannelReadPointer(channelUuid, { enabled: isMember });

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
   * `canOpen` matters more here than anywhere: this screen RENDERS for a
   * non-member of a `space_public` channel (the join panel), so without a gate
   * `?panel=edit` in a copied link would hand a stranger the admin form
   * prefilled with the channel's name, description and visibility, and
   * `?panel=members` would open a sheet whose query only 403s. Gate keys are
   * panel FAMILIES, so `ai` covers `ai:{uuid}` as well. `undefined` until the
   * channel lands: the pending screen renders no panels, and refusing on an
   * unresolved role would strip a real admin's deep link.
   */
  const panel = useUrlOverlay('panel', {
    canOpen: channel
      ? {
          edit: canManage,
          members: isMember,
          pinned: isMember,
          saved: isMember,
          quizzes: isMember,
          ai: isMember,
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
    // Values are bare uuids, so the gate is the whole param: only a member
    // reaches the branch that renders `GameOverlay` at all.
    canOpen: channel ? isMember : undefined,
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

  const selectTab = useCallback((next: ChannelTab) => {
    setTab(next);
    quietReplaceUrlParams({
      tab: next === 'chat' ? null : next,
      // Leaving Lists keeps `?list=` so a return trip restores the selection;
      // the param is meaningless on other tabs and harmless in the URL.
    });
  }, []);

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

  const handleStartReply = useCallback((message: Message) => {
    setReplyTo(message);
    composerRef.current?.focus();
  }, []);

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

  if (detailQuery.isError || !channel) {
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
              {isMember ? (
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

          <div className="flex shrink-0 items-center gap-2">
            {!isMember && channel.visibility === 'space_public' && (
              <Button
                size="sm"
                onClick={() => {
                  setMembershipActionError(null);
                  joinMutation.mutate(undefined, {
                    onError: (error) =>
                      setMembershipActionError(extractApiError(error).message),
                  });
                }}
                disabled={joinMutation.isPending}
              >
                {joinMutation.isPending ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <LogIn aria-hidden className="size-4" />
                )}
                Join
              </Button>
            )}
            {/* The two collection affordances — quiet, iconic, and only for
                members (both endpoints gate on membership). They sit beside
                the menu rather than inside it because they are READING moves
                the reader makes mid-conversation, not settings. */}
            {isMember && (
              <>
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
              </>
            )}
            {isMember && (
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
        {membershipActionError && (
          <p className="mt-1 text-xs font-medium text-destructive">
            {membershipActionError}
          </p>
        )}
      </div>
    </div>
  );

  /* ── Non-member: identity + the designed join panel ───────────────────── */
  if (!isMember) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {identityHeader}
        <div className="mx-auto w-full max-w-3xl flex-1 px-4">
          <CollabMessage
            icon={VisibilityIcon}
            tone="accent"
            title={`Join ${channel.name} to read along`}
            description={
              channel.description?.trim() ||
              `${channel.name} is a channel in ${channel.space.name}. Join to read the conversation and take part.`
            }
            action={
              channel.visibility === 'space_public' ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setMembershipActionError(null);
                    joinMutation.mutate(undefined, {
                      onError: (error) =>
                        setMembershipActionError(extractApiError(error).message),
                    });
                  }}
                  disabled={joinMutation.isPending}
                >
                  {joinMutation.isPending && (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  )}
                  Join channel
                </Button>
              ) : undefined
            }
            footnote={
              channel.visibility === 'private'
                ? 'This channel is invite-only — ask a member to add you.'
                : undefined
            }
          />
        </div>
      </div>
    );
  }

  /* ── Member: tabs + panes ─────────────────────────────────────────────── */
  const gameOpen = gameUuid !== null;

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

        {/* The earned moment for closed-app push (W5). Members only — it sits
            inside this branch, so a non-member reading a public channel is
            never asked. Renders a zero-height inert row when there is nothing
            to ask. */}
        <EnablePushNudge />

        {/* The standing door into a running game (W6) — renders nothing at all
            when no quiz is live here, so the channel's geometry is unchanged
            the rest of the time. */}
        <LiveQuizBar
          channelUuid={channel.uuid}
          viewerId={viewerId}
          onOpenGame={openGame}
        />

        <div className="shrink-0 border-b px-4">
          <div className="mx-auto w-full max-w-3xl">
            <TabRow
              tabs={CHANNEL_TABS}
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
              active={tab === 'chat'}
              targetMessageUuid={targetMessageUuid}
              typingUsers={room.typingUsers}
              respondingTurns={room.respondingTurns}
              onStartReply={handleStartReply}
              onFocusComposer={focusComposer}
              onViewAiSession={openAiSession}
              onOpenGame={openGame}
              composer={
                <ChannelComposer
                  ref={composerRef}
                  channel={channel}
                  viewerId={viewerId}
                  replyTo={replyTo}
                  onCancelReply={() => setReplyTo(null)}
                  onTyping={room.notifyTyping}
                  onSentSuccess={handleSentSuccess}
                />
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

      {/* ── Sheets & dialogs ────────────────────────────────────────────── */}
      <QuizLibrarySheet
        channel={channel}
        viewerId={viewerId}
        viewerUuid={viewerUuid}
        onOpenGame={openGame}
        {...panel.bind('quizzes')}
      />

      <PinnedMessagesSheet
        channel={channel}
        viewerId={viewerId}
        onJumpToMessage={jumpToMessage}
        {...panel.bind('pinned')}
      />

      <SavedMessagesSheet
        channel={channel}
        viewerId={viewerId}
        onJumpToMessage={jumpToMessage}
        {...panel.bind('saved')}
      />

      {/* Not `bind`: this sheet answers to TWO values (`ai` and `ai:{uuid}`),
          so its open test is a prefix rather than an equality. */}
      <ChannelAiSessionsSheet
        channelUuid={channel.uuid}
        channelName={channel.name}
        viewerId={viewerId}
        open={aiOpen}
        onOpenChange={(next) => {
          if (!next) panel.close();
        }}
        sessionUuid={aiSessionUuid}
        onSelectSession={selectAiSession}
      />

      <ChannelMembersSheet
        channel={channel}
        viewerId={viewerId}
        viewerUuid={viewerUuid}
        {...panel.bind('members')}
      />

      {/* Mounted unconditionally now, keyed on `openKey`: it stays through its
          closing transition and remounts on each opening, so its fields
          re-derive from the current channel (the house dialog contract). */}
      <ChannelEditDialog
        key={panel.keyFor('edit')}
        channel={channel}
        {...panel.bind('edit')}
      />

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

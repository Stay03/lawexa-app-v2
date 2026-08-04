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
import {
  quietPushUrlParams,
  quietReplaceUrlParams,
} from '@/v2/runtime/url-params';
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
 * presence room while the game runs. `?game=` uses the same quiet history
 * writers as `?tab=`, with ONE difference: opening a game PUSHES an entry
 * (Back leaves the game and lands back in the chat, the mobile expectation)
 * while closing REPLACES, so the mode is never a walk through history. A
 * `popstate` listener adopts whatever the URL really says, which is what makes
 * Back, Forward and a shared link all agree.
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
  const [membersOpen, setMembersOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [membershipActionError, setMembershipActionError] = useState<string | null>(null);
  const composerRef = useRef<ChannelComposerHandle>(null);
  const feedRef = useRef<ChannelFeedHandle>(null);

  /* ── W3 side surfaces. All three are LENSES over this channel, so they open
        as sheets over the transcript and hand the reader back to it — never a
        second place to read messages (design-research DIRECTION 14). ─────── */
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  /** The session the sheet is showing; `null` = its list. Owned here because
   *  the sheet has two entrances (the menu, and any AI message's "view this
   *  conversation"), and controlling it removes any need to sync inside. */
  const [sessionUuid, setSessionUuid] = useState<string | null>(null);

  /* ── Game mode (W6). Same URL-as-mirror contract as `?tab=`, with a PUSH on
        open so Back leaves the game. Initialised from the LIVE URL for the
        same reason the tab is: a Back/Forward restore can serve stale props
        while the address bar is current. ─────────────────────────────────── */
  const [gameUuid, setGameUuid] = useState<string | null>(() => {
    if (typeof window === 'undefined') return initialGameUuid;
    return new URLSearchParams(window.location.search).get('game') ?? initialGameUuid;
  });
  const [quizzesOpen, setQuizzesOpen] = useState(false);

  const openGame = useCallback((nextGameUuid: string) => {
    // IDEMPOTENT AT THE SOURCE. Three affordances open a game (the live bar,
    // a transcript card, the library sheet) and each can be double-tapped; two
    // pushes would mean two history entries, so Back would take two presses to
    // leave one game. The live URL is the truth, so it is what gets checked.
    if (
      new URLSearchParams(window.location.search).get('game') === nextGameUuid
    ) {
      return;
    }
    setGameUuid(nextGameUuid);
    quietPushUrlParams({ game: nextGameUuid });
  }, []);

  const closeGame = useCallback(() => {
    setGameUuid(null);
    quietReplaceUrlParams({ game: null });
  }, []);

  // Back/Forward re-derives EVERY value this screen mirrors into the URL, not
  // just the one W6 added. `?game=` is the first PUSH on this route, so a Back
  // out of a game now restores an entry whose `?tab=` may differ from the tab
  // on screen — reading only `game` here would leave the strip pointing at
  // Lists while the chat is shown. (`?list=` is owned by `ListsTab`'s own
  // state, which re-reads it on mount; it is not this listener's to restore.)
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setGameUuid(params.get('game'));
      setTab(parseChannelTab(params.get('tab')));
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

  /** Land on a message from a panel: back to Chat (through the ONE tab writer,
   *  so the URL stays in step), then let the feed resolve it — it pulls older
   *  pages when the message isn't loaded, and gives up silently when it can't
   *  be reached. The Chat pane keeps its mount across tabs, so the imperative
   *  handle is live even when the reader was on Lists or Files. */
  const jumpToMessage = useCallback(
    (messageUuid: string) => {
      selectTab('chat');
      feedRef.current?.jumpToMessage(messageUuid);
    },
    [selectTab],
  );

  const openAiSession = useCallback((nextSessionUuid: string) => {
    setSessionUuid(nextSessionUuid);
    setSessionsOpen(true);
  }, []);

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
  const canManage = canManageChannel(channel);
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
                  onClick={() => setMembersOpen(true)}
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
                  onClick={() => setPinnedOpen(true)}
                >
                  <Pin aria-hidden className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Saved messages"
                  title="Saved messages (private to you)"
                  onClick={() => setSavedOpen(true)}
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
                  <DropdownMenuItem onClick={() => setMembersOpen(true)}>
                    <Users aria-hidden className="size-4" />
                    Members
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSessionUuid(null);
                      setSessionsOpen(true);
                    }}
                  >
                    <Sparkles aria-hidden className="size-4" />
                    Lawexa sessions
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setQuizzesOpen(true)}>
                    <Trophy aria-hidden className="size-4" />
                    Quizzes
                  </DropdownMenuItem>
                  {canManage && (
                    <DropdownMenuItem onClick={() => setEditOpen(true)}>
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
        open={quizzesOpen}
        onOpenChange={setQuizzesOpen}
        onOpenGame={openGame}
      />

      <PinnedMessagesSheet
        channel={channel}
        viewerId={viewerId}
        open={pinnedOpen}
        onOpenChange={setPinnedOpen}
        onJumpToMessage={jumpToMessage}
      />

      <SavedMessagesSheet
        channel={channel}
        viewerId={viewerId}
        open={savedOpen}
        onOpenChange={setSavedOpen}
        onJumpToMessage={jumpToMessage}
      />

      <ChannelAiSessionsSheet
        channelUuid={channel.uuid}
        channelName={channel.name}
        viewerId={viewerId}
        viewerUuid={viewerUuid}
        open={sessionsOpen}
        onOpenChange={setSessionsOpen}
        sessionUuid={sessionUuid}
        onSelectSession={setSessionUuid}
      />

      <ChannelMembersSheet
        channel={channel}
        viewerId={viewerId}
        viewerUuid={viewerUuid}
        open={membersOpen}
        onOpenChange={setMembersOpen}
      />

      {editOpen && (
        <ChannelEditDialog
          channel={channel}
          open={editOpen}
          onOpenChange={setEditOpen}
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

const CHANNEL_TABS: readonly { id: ChannelTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'lists', label: 'Lists' },
  { id: 'files', label: 'Files' },
];

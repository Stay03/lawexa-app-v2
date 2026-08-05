'use client';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  CornerUpRight,
  Loader2,
  MessagesSquare,
  RotateCcw,
  Sparkles,
  WifiOff,
  Wrench,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import type { AiSession, AiSessionStatus, AiTranscriptMessage } from '@/types/collab';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useEngagementThrottled } from '../engagement-throttle';
import { LawexaMarkdown } from '../feed/LawexaMessageContent';
import { PlainMessageContent } from '../feed/MessageContent';
import { channelsQueries } from '../queries';
import { LawexaAvatar, MemberAvatar } from '../ui/avatars';
import { RelativeTime } from '../ui/RelativeTime';
import { useResetChannelAi } from './mutations';
import {
  humanTurn,
  isDialogueRow,
  machineryLabel,
  shapeTranscript,
} from './transcript-model';

/**
 * ChannelAiSessionsSheet — the channel's Lawexa history: which conversations
 * happened, and what was actually said inside each one. Phase-5 W3; study A9
 * marks v1's sheet KEEP-the-model, REDESIGN + BUILD NEW (the transcript now
 * returns the COMPLETE record, and a message can open its own session).
 * Sources: plan W3 item 7, api-digest §C — 2026-08-04.
 *
 * TWO LEVELS, ONE SHEET: the session list drills into a transcript and back.
 * Both are read-only. Nothing fetches until the sheet is open, and the
 * transcript only when a session is selected.
 *
 * CONTROLLED SELECTION. The screen owns which session is showing, because the
 * sheet has two entrances: the channel menu (opens the LIST) and "view this
 * conversation" on any Lawexa message (opens THAT transcript directly, via
 * `metadata.session_uuid`). Keeping the selection outside means the second
 * entrance needs no internal syncing effect at all.
 *
 * DIALOGUE BY DEFAULT, EVERYTHING ON REQUEST. The endpoint returns the tool
 * machinery as well as the conversation. The default view is what people said;
 * a toggle — labelled with the exact number it is hiding, so it is never a
 * mystery switch — reveals the rest as quiet marked rows. The filter is a lens
 * over the same fetched pages (`./transcript-model.ts`), never a second
 * request.
 *
 * ROW GRAMMAR IS THE CHANNEL'S, NOT THE CONVERSATION SCREEN'S. A channel
 * session has MANY human askers, so rows keep the feed's avatar + name + time
 * identity header rather than the conversation's single-user right-aligned
 * bubble, which would erase who asked what. Lawexa's own body renders through
 * the feed's markdown prose, so an answer reads identically in both places.
 *
 * THE TRANSCRIPT IS NOT THE MESSAGES TABLE. Its rows come from the agent's own
 * conversation and carry no `uuid`, no `is_ai` and no resolved mention list
 * ({@link AiTranscriptMessage}), so this view keys on `id`, takes authorship
 * from `role` alone, and renders bodies through the mention-free renderers —
 * handing a transcript row to the feed's mention-aware ones threw.
 *
 * A USER TURN NOW HAS TWO POSSIBLE ERAS, and {@link humanTurn} is the one place
 * that knows which: since 2026-08-04 the row carries `user_content` (what the
 * person actually typed) and `asked_by` (who they were), so a turn from then on
 * shows the real person with their avatar; a turn from before carries only the
 * assembled prompt, so its question is recovered by parse and it stays
 * deliberately UNNAMED — the only name inside that prompt is one any member can
 * forge, and this product will not print it as authorship.
 *
 * AND A TURN CAN NOW POINT BACK. `metadata.channel_message_uuid` names the
 * channel message that summoned it, so a question read here has a door to the
 * conversation it came out of — the same jump the pins and saves panels make,
 * through the same screen-owned handler. Only offered when the row carries the
 * uuid, which is again the post-deploy rows.
 */

/** `useLayoutEffect` in the browser, `useEffect` on the server — a layout
 *  effect does nothing during SSR and React warns about it. Resolved once at
 *  module scope so the call site stays unconditional (rules-of-hooks). */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Subtle status tint — an active session reads as live, the rest archival.
 *  No red anywhere: an expired session is not a failure. */
const STATUS_TONE: Record<AiSessionStatus, string> = {
  active: 'bg-primary/10 text-primary',
  expired: 'bg-muted text-muted-foreground',
  closed: 'bg-muted text-muted-foreground',
};

export function ChannelAiSessionsSheet({
  channelUuid,
  channelName,
  viewerId,
  canReset,
  open,
  onOpenChange,
  sessionUuid,
  onSelectSession,
  onJumpToMessage,
}: {
  channelUuid: string;
  channelName: string;
  viewerId: number | null;
  /** False for a space member previewing a `space_public` channel they never
   *  joined: the history reads, `POST /ai/reset` is refused, so the footer
   *  offering it is not rendered. */
  canReset: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = show the session list. */
  sessionUuid: string | null;
  onSelectSession: (sessionUuid: string | null) => void;
  /** Land on a channel message from a transcript turn — the screen closes this
   *  sheet in place, returns to Chat and lets the feed resolve the uuid. */
  onJumpToMessage: (messageUuid: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Variant-matched width, or these are dead classes: the primitive sizes
          itself with `data-[side=right]:w-3/4` + `data-[side=right]:sm:max-w-sm`,
          and an attribute selector outranks a bare utility — so a plain
          `w-full sm:max-w-lg` loses silently and the sheet renders at three
          quarters of a phone screen. Same trap, same remedy, as `SpaceDrawer`. */}
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
      >
        {sessionUuid ? (
          <TranscriptView
            channelUuid={channelUuid}
            sessionUuid={sessionUuid}
            viewerId={viewerId}
            open={open}
            onBack={() => onSelectSession(null)}
            onJumpToMessage={onJumpToMessage}
          />
        ) : (
          <SessionListView
            channelUuid={channelUuid}
            channelName={channelName}
            viewerId={viewerId}
            canReset={canReset}
            open={open}
            onSelect={onSelectSession}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ── List view ────────────────────────────────────────────────────────────── */

function SessionListView({
  channelUuid,
  channelName,
  viewerId,
  canReset,
  open,
  onSelect,
}: {
  channelUuid: string;
  channelName: string;
  viewerId: number | null;
  canReset: boolean;
  open: boolean;
  onSelect: (sessionUuid: string) => void;
}) {
  const query = useInfiniteQuery({
    ...channelsQueries.aiSessions({ channelUuid, viewerId }),
    enabled: open,
  });
  const sessions = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );
  const hasActive = sessions.some((session) => session.status === 'active');

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="flex items-center gap-2">
          <Sparkles aria-hidden className="size-4 text-primary" />
          Lawexa sessions
        </SheetTitle>
        <p className="text-sm text-muted-foreground">
          Every conversation with Lawexa in {channelName}
        </p>
      </SheetHeader>

      <div className="v2-quiet-scroll min-h-0 flex-1 overflow-y-auto">
        {query.isPending ? (
          <SessionListSkeleton />
        ) : query.isError ? (
          <div className="px-4 py-6">
            <CollabMessage
              icon={WifiOff}
              tone="alert"
              title="Couldn't load sessions"
              description="We couldn't load Lawexa's history for this channel. Please try again."
              action={
                <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-4 py-6">
            <CollabMessage
              icon={Sparkles}
              tone="neutral"
              title="No Lawexa sessions yet"
              description="Mention @lawexa in the channel and the conversation that follows will be kept here."
            />
          </div>
        ) : (
          <ul className="divide-y">
            {sessions.map((session) => (
              <SessionRow
                key={session.uuid}
                session={session}
                onSelect={() => onSelect(session.uuid)}
              />
            ))}
            {query.hasNextPage && (
              <li className="flex justify-center p-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                >
                  {query.isFetchingNextPage && (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  )}
                  Load older sessions
                </Button>
              </li>
            )}
          </ul>
        )}
      </div>

      {canReset && (
        <ResetFooter channelUuid={channelUuid} hasActiveSession={hasActive} />
      )}
    </>
  );
}

function SessionRow({
  session,
  onSelect,
}: {
  session: AiSession;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'v2-interactive flex w-full items-center gap-3 px-4 py-3 text-left',
          'transition-colors duration-150 hover:bg-muted/60 motion-reduce:transition-none',
          FOCUS_RING,
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles aria-hidden className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                STATUS_TONE[session.status],
              )}
            >
              {session.status_label}
            </span>
            <RelativeTime
              iso={session.started_at}
              className="text-xs text-muted-foreground"
            />
          </span>
          <span className="mt-1 block truncate text-sm text-foreground">
            Started by {session.started_by?.name ?? 'someone'}
          </span>
          <span className="block text-xs text-muted-foreground">
            {session.message_count}{' '}
            {session.message_count === 1 ? 'message' : 'messages'}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

/**
 * "Start fresh" — closes the active session and posts an `ai_divider` so the
 * transcript shows where the memory ended. Confirmed, because the effect is
 * shared: everyone in the channel loses the running context, not just the
 * person who pressed it. Idempotent server-side, so a double-press is safe.
 */
function ResetFooter({
  channelUuid,
  hasActiveSession,
}: {
  channelUuid: string;
  hasActiveSession: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const reset = useResetChannelAi(channelUuid);
  const throttled = useEngagementThrottled('ai-reset');

  /* ONE LINE UNDER THE BUTTON carries all three states in priority order —
     cooling down, last attempt failed, or what the action does. A cooldown
     outranks the failure text because it EXPLAINS it: "it didn't work" is
     unhelpful when the real answer is "you did it a moment ago". */
  const footnote = throttled
    ? 'You just did that — try again in a moment.'
    : reset.isError
      ? "Couldn't start a fresh session. Try again."
      : hasActiveSession
        ? 'Lawexa forgets the current thread and starts clean.'
        : 'There is no active session — this is already a clean start.';

  return (
    <div className="v2-safe-bottom shrink-0 border-t px-4 py-3">
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setConfirmOpen(true)}
        disabled={reset.isPending || throttled}
      >
        {reset.isPending ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <RotateCcw aria-hidden className="size-4" />
        )}
        Start a fresh session
      </Button>
      <p
        className={cn(
          'mt-1.5 text-center text-xs transition-colors duration-150 motion-reduce:transition-none',
          // No red: a throttle is not a fault, and a failed reset is
          // retryable — the destructive token stays reserved (house rule).
          'text-muted-foreground',
        )}
      >
        {footnote}
      </p>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a fresh Lawexa session?</AlertDialogTitle>
            <AlertDialogDescription>
              Lawexa will forget the current conversation for everyone in this
              channel and answer the next mention with a clean slate. The
              messages stay in the channel, and this session stays in the
              history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                reset.mutate();
                setConfirmOpen(false);
              }}
            >
              Start fresh
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SessionListSkeleton() {
  return (
    <div aria-hidden className="divide-y">
      {[0, 1, 2, 3, 4].map((index) => (
        <div
          key={index}
          className="flex items-center gap-3 px-4 py-3"
          style={{ opacity: Math.max(0.3, 1 - index * 0.16) }}
        >
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2 rounded" />
            <Skeleton className="h-3 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Transcript view ──────────────────────────────────────────────────────── */

function TranscriptView({
  channelUuid,
  sessionUuid,
  viewerId,
  open,
  onBack,
  onJumpToMessage,
}: {
  channelUuid: string;
  sessionUuid: string;
  viewerId: number | null;
  open: boolean;
  onBack: () => void;
  onJumpToMessage: (messageUuid: string) => void;
}) {
  const [showEverything, setShowEverything] = useState(false);
  const query = useInfiniteQuery({
    ...channelsQueries.aiSessionTranscript({ channelUuid, sessionUuid, viewerId }),
    enabled: open,
  });

  const { rows, hiddenCount } = useMemo(
    () => shapeTranscript(query.data?.pages, showEverything),
    [query.data, showEverything],
  );

  /* ── "Load earlier" preserves the reading position (audit L9), with the
        same bottom-anchored technique the channel feed uses: capture the
        viewport's distance from the CONTENT BOTTOM before the pull, restore it
        in a LAYOUT effect once the fetch settles. Bottom-anchored because
        pages prepend ABOVE the viewport, and a layout effect because a passive
        one paints a frame at the wrong offset (Safari has no scroll anchoring
        here). Keyed to fetch SETTLEMENT, so nothing consumes the restore while
        the request is still in flight. ─────────────────────────────────────── */
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingRestoreRef = useRef<number | null>(null);
  const isFetchingEarlier = query.isFetchingNextPage;

  const loadEarlier = () => {
    const element = scrollRef.current;
    if (element) {
      pendingRestoreRef.current = element.scrollHeight - element.scrollTop;
    }
    void query.fetchNextPage();
  };

  useIsomorphicLayoutEffect(() => {
    if (pendingRestoreRef.current === null || isFetchingEarlier) return;
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight - pendingRestoreRef.current;
    pendingRestoreRef.current = null;
  }, [query.data, isFetchingEarlier]);

  return (
    <>
      <SheetHeader className="gap-2 border-b">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 gap-1 px-2 text-muted-foreground"
            onClick={onBack}
          >
            <ChevronLeft aria-hidden className="size-4" />
            All sessions
          </Button>
        </div>
        <SheetTitle className="flex items-center gap-2">
          <Sparkles aria-hidden className="size-4 text-primary" />
          Lawexa session
        </SheetTitle>
        {/* The toggle names its own cost. It only exists once we KNOW something
            is hidden, so it never appears as a switch with nothing behind it. */}
        {(hiddenCount > 0 || showEverything) && (
          <button
            type="button"
            onClick={() => setShowEverything((current) => !current)}
            aria-pressed={showEverything}
            className={cn(
              'v2-interactive w-fit rounded-md text-xs font-medium text-muted-foreground',
              'transition-colors duration-150 hover:text-foreground motion-reduce:transition-none',
              FOCUS_RING,
            )}
          >
            {showEverything
              ? 'Hide the tool steps'
              : `Show everything (${hiddenCount} tool ${hiddenCount === 1 ? 'step' : 'steps'})`}
          </button>
        )}
      </SheetHeader>

      <div ref={scrollRef} className="v2-quiet-scroll min-h-0 flex-1 overflow-y-auto">
        {query.isPending ? (
          <TranscriptSkeleton />
        ) : query.isError ? (
          <div className="px-4 py-6">
            <CollabMessage
              icon={WifiOff}
              tone="alert"
              title="Couldn't load this session"
              description="We couldn't load this session's transcript. Please try again."
              action={
                <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-6">
            <CollabMessage
              icon={MessagesSquare}
              tone="neutral"
              title="Nothing to show"
              description={
                hiddenCount > 0
                  ? 'This session only contains tool steps — turn on “Show everything” to see them.'
                  : 'This session has no messages.'
              }
            />
          </div>
        ) : (
          <div className="space-y-4 px-4 py-4">
            {query.hasNextPage && (
              <div className="flex justify-center pb-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadEarlier}
                  disabled={query.isFetchingNextPage}
                >
                  {query.isFetchingNextPage && (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  )}
                  Load earlier
                </Button>
              </div>
            )}
            {rows.map((row) => (
              <TranscriptRow
                key={row.id}
                message={row}
                onJumpToMessage={onJumpToMessage}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * One transcript row, in three shapes off `role`: machinery, Lawexa's answer,
 * the human's question. Read-only by construction — history is not editable, so
 * this is deliberately NOT the feed's `MessageRow` with its action cluster.
 * Machinery rows (only visible under "Show everything") wear a quiet marker and
 * a monospace body: they are a record of what the agent did, not something to
 * read as prose, so they show their content raw, prompt scaffolding and all.
 */
function TranscriptRow({
  message,
  onJumpToMessage,
}: {
  message: AiTranscriptMessage;
  onJumpToMessage: (messageUuid: string) => void;
}) {
  // THE SAME PREDICATE THE FILTER USES — never a second copy. A row that the
  // dialogue view hid must render as machinery when "Show everything" reveals
  // it; two definitions would let a hidden row come back dressed as prose.
  if (!isDialogueRow(message)) {
    return (
      <div className="flex gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Wrench aria-hidden className="size-3" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-muted-foreground capitalize">
              {machineryLabel(message)}
            </span>
            <RelativeTime
              iso={message.created_at}
              className="text-[11px] text-muted-foreground/80"
            />
          </div>
          <pre className="v2-quiet-scroll mt-1 max-h-40 overflow-auto rounded-md bg-muted/60 px-2 py-1.5 text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {message.content}
          </pre>
        </div>
      </div>
    );
  }

  if (message.role === 'assistant') {
    return (
      <DialogueRow
        avatar={<LawexaAvatar size="sm" className="mt-0.5 shrink-0" />}
        name="Lawexa"
        createdAt={message.created_at}
      >
        <LawexaMarkdown content={message.content} />
      </DialogueRow>
    );
  }

  // A HUMAN TURN — named when the SERVER named it, neutral when it did not.
  // `asked_by` is stamped from the authenticated summoner; the name inside the
  // assembled prompt is member-writable and is never read as an identity (see
  // `./human-turn.ts`). So a post-2026-08-04 turn finally shows the real
  // person, and an older one keeps the stand-in — the difference is a fact
  // about the record, not about the reader.
  const turn = humanTurn(message);
  // Bound to a local const so the narrowing survives into the click handler.
  const summonedBy = turn.channelMessageUuid;
  return (
    <DialogueRow
      avatar={
        <MemberAvatar user={turn.askedBy} size="sm" className="mt-0.5 shrink-0" />
      }
      name={turn.askedBy?.name ?? 'Someone in this channel'}
      unnamed={turn.askedBy === null}
      createdAt={message.created_at}
      footer={
        summonedBy ? (
          <button
            type="button"
            onClick={() => onJumpToMessage(summonedBy)}
            className={cn(
              'v2-interactive mt-1 inline-flex items-center gap-1 rounded text-xs text-muted-foreground',
              'transition-colors duration-150 hover:text-foreground motion-reduce:transition-none',
              FOCUS_RING,
            )}
          >
            <CornerUpRight aria-hidden className="size-3 shrink-0" />
            Go to this message in the channel
          </button>
        ) : undefined
      }
    >
      <PlainMessageContent content={turn.text} />
    </DialogueRow>
  );
}

/** The identity header + body shared by both dialogue rows — the feed's row
 *  grammar, so an answer reads the same here as it does in the channel. */
function DialogueRow({
  avatar,
  name,
  unnamed = false,
  createdAt,
  footer,
  children,
}: {
  avatar: ReactNode;
  name: string;
  /** The name is a stand-in, not an attribution — draw it quietly. */
  unnamed?: boolean;
  createdAt: string;
  /** A quiet line UNDER the body — today, the way back to the channel message
   *  that summoned this turn. Below rather than beside, so it never competes
   *  with the words the person wrote. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={cn('text-sm font-medium', unnamed && 'text-muted-foreground')}
          >
            {name}
          </span>
          <RelativeTime iso={createdAt} className="text-xs text-muted-foreground" />
        </div>
        <div className="mt-0.5">{children}</div>
        {footer}
      </div>
    </div>
  );
}

function TranscriptSkeleton() {
  return (
    <div aria-hidden className="space-y-4 px-4 py-4">
      {[70, 55, 85, 45].map((width, index) => (
        <div
          key={index}
          className="flex gap-3"
          style={{ opacity: Math.max(0.3, 1 - index * 0.18) }}
        >
          <Skeleton className="mt-0.5 size-6 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-20 rounded" />
              <Skeleton className="h-3 w-10 rounded" />
            </div>
            <Skeleton className="h-3.5 rounded" style={{ width: `${width}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

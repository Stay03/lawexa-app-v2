'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { ArrowLeft, Ban, Loader2, LogIn, Trophy, UserPlus, WifiOff } from 'lucide-react';

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
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import { QuizTile } from '@/v2/features/quiz/solo/QuizTile';
import { RaisedButton } from '@/v2/features/quiz/solo/ui';
import {
  CancelledStage,
  CountdownStage,
  FinalAnswerStage,
  LobbyStage,
  PodiumStage,
  QuestionStage,
} from './GamePhases';
import { GameInviteDialog } from './GameInviteDialog';
import { canJoinNow } from './model';
import { gameInRoom, roomNoun, type QuizRoom } from './quiz-room';
import { COMPACT_RAISED, GameStage, GameStageSkeleton } from './ui';
import { useLiveGame } from './use-game';
import '@/v2/features/quiz/solo/solo-quiz.css';
import './quiz-game.css';

/**
 * GameOverlay — the live game as a MODE over the channel, not a page away
 * from it.
 *
 * Phase-5 W6; sources: `docs/api/channel-quiz.md` (backend repo),
 * `api-digest.md` §E, plan W6. Design: design-research OWNER FEEL DIRECTIVE.
 *
 * ── WHY A MODE AND NOT A ROUTE ──────────────────────────────────────────────
 * A game lasts minutes and belongs to the room it is played in. Routing to
 * `/quiz-games/{uuid}` (the contract's suggestion) would unmount the channel:
 * the feed's scroll position, its loaded history, the unread divider and the
 * composer draft would all be rebuilt on the way back, and the presence room
 * would be left and rejoined — for a surface that is, conceptually, the same
 * room with the lights down. So the overlay covers the channel's pane region,
 * the chat stays mounted and warm behind it, and leaving the game is instant.
 *
 * IT IS STILL AN ADDRESS. `?game={uuid}` is written with the quiet history
 * writers (`v2/runtime/url-params`) exactly as the case side chat does: OPEN
 * pushes an entry, so Back closes the game and lands on the chat; close and
 * in-mode hops replace, so the mode never becomes a walk through history. A
 * direct link, a refresh or a shared URL re-enters the same game because the
 * route shell reads `?game=` and hands it back as an initial prop.
 *
 * ── WHAT THIS COMPONENT OWNS ────────────────────────────────────────────────
 * The frame (identity, phase caption, exit, the host's cancel), the designed
 * refusals for a game that cannot be shown, the watching/late-join bar, and
 * the polite live region that announces phase changes for readers who cannot
 * see them. Every phase body lives in `./GamePhases.tsx`; all state, timing
 * and transport live in `./use-game.ts`.
 *
 * IN THE QUIZ'S OWN LOOK (Stay and Arthur, 11 November 2026). `v2-solo` on the
 * frame carries the solo quiz's tokens to every phase: the header shows the
 * quiz's letter tile, and its actions, the join bar's and the refusals' are
 * the solo quiz's raised buttons.
 */

/** One coarse sentence per phase for the polite live region. Question and
 *  reveal name their INDEX, because "question" alone would announce the same
 *  word ten times and tell a screen-reader user nothing about progress — and
 *  the last one says so, which is the whole point of `is_final`: a reader who
 *  cannot see the screen learns the game is ending before it ends. */
function announce(game: ReturnType<typeof useLiveGame>): string {
  const state = game.state;
  if (!state) return '';
  if (game.closingAnswer) return 'The game is over. This was the last answer';
  const current = state.current_question;
  const index = (current?.index ?? 0) + 1;
  const total = state.game.question_count;
  const last = current?.is_final === true ? ', the last one' : '';
  switch (game.phase) {
    case 'lobby':
      return `Quiz lobby: ${state.game.quiz.title}`;
    case 'countdown':
      return 'The game is about to start';
    case 'question':
      return `Question ${index} of ${total}${last}`;
    case 'reveal':
      return `Answer revealed for question ${index}${last}`;
    case 'cancelled':
      return 'This game was cancelled';
    default:
      return 'Final scores';
  }
}

const PHASE_CAPTION = {
  lobby: 'Lobby',
  countdown: 'Starting',
  question: 'Question',
  reveal: 'Answer',
  finished: 'Final scores',
  cancelled: 'Cancelled',
} as const;

/** The caption for the beat where the game is over but its last question is
 *  still being closed on screen. */
const LAST_ANSWER_CAPTION = 'Last answer';

/** The header's actions: the solo quiz's raised button, small enough to sit in
 *  the header's row beside the title. */
const HEADER_RAISED = 'h-9 rounded-xl px-3 text-sm';

export function GameOverlay({
  room,
  cover = 'room',
  gameUuid,
  viewerId,
  viewerUuid,
  mayInvite = false,
  place,
  spaceName = null,
  onClose,
}: {
  /** The room the overlay is over: a channel, or a Space itself (quiz-room.ts). */
  room: QuizRoom;
  /**
   * What the mode covers. `room`: the screen it sits in, which is a fixed-height
   * pane (a channel, a chat). `viewport`: the whole window, for a page that
   * scrolls in the shell (a Space's page), where an absolute layer would sit at
   * the page's top and scroll away.
   */
  cover?: 'room' | 'viewport';
  gameUuid: string;
  viewerId: number | null;
  viewerUuid: string | null;
  /** Whether the reader may host in the game's Space, and so hand out its
   *  link (`GameInviteDialog`). A channel's game has no link. */
  mayInvite?: boolean;
  /**
   * Where leaving the game returns to, as a noun: "channel", "Space" (a
   * Space's page) or "chat" (a Space chat). "Back to the …" and the cancel
   * dialog name it; the room alone cannot, since a Space game is played from
   * its page and its chats (live quiz review, 11 November 2026). Defaults to
   * the room's own noun.
   */
  place?: string;
  /** The game's Space by name, which a player's result card names
   *  ("… came 2nd in Torts 101, LASU LSS"). The room carries only its uuid. */
  spaceName?: string | null;
  onClose: () => void;
}) {
  const game = useLiveGame({ room, gameUuid, viewerId, viewerUuid });
  const placeNoun = place ?? roomNoun(room);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const frameRef = useRef<HTMLElement>(null);

  // The affordance that opened this mode (a card's Join, the live bar) is now
  // covered, so keyboard focus would be stranded on a hidden control or fall
  // to the body. Move it into the game once, on open. Deliberately NO Escape
  // handler: an accidental Escape mid-question would eject a player from a
  // timed round, and Back — browser, gesture or the arrow above — already
  // leaves in one step.
  useEffect(() => {
    frameRef.current?.focus({ preventScroll: true });
  }, []);

  const state = game.state;
  const title = state?.game.quiz.title ?? 'Live quiz';
  const phase = game.phase;
  // AN ENDING HOLD IS THE ONE TIME `phase` LAGS THE SERVER on purpose: the game
  // is finished, the screen is still on its last question. Everything in this
  // frame that speaks about "now" reads the hold first, so the header never
  // says "Final scores" over a question, and no affordance offers a move
  // (cancel, join) into a game that is already over.
  const ending = game.holdingFinalReveal || game.closingAnswer !== null;
  const caption = game.closingAnswer
    ? LAST_ANSWER_CAPTION
    : game.holdingFinalReveal
      ? PHASE_CAPTION.reveal
      : PHASE_CAPTION[phase];

  const canCancel =
    game.isHost &&
    state !== null &&
    !ending &&
    phase !== 'finished' &&
    phase !== 'cancelled';
  // While people can still come in: before the end, in a Space's game.
  const canInvite =
    mayInvite &&
    room.kind === 'space' &&
    state !== null &&
    !ending &&
    phase !== 'finished' &&
    phase !== 'cancelled';
  const showJoinBar =
    state !== null &&
    !game.isPlaying &&
    !ending &&
    phase !== 'lobby' &&
    canJoinNow(state) &&
    game.joinErrorStatus !== 403;

  const frame = (
    <section
      ref={frameRef}
      tabIndex={-1}
      aria-label="Live quiz"
      className={cn(
        'v2-solo outline-none',
        // Above the feed's floating composer overlay — the mode covers the
        // whole screen it is in, not just its pane region; or, on a page that
        // scrolls in the shell, the whole window.
        cover === 'viewport' ? 'fixed inset-0 z-50' : 'absolute inset-0 z-20',
        'flex min-h-0 flex-col bg-background',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200',
      )}
    >
      {/* ── Frame header ──────────────────────────────────────────────── */}
      <div className="shrink-0 border-b px-4 pt-2.5 pb-3">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onClose}
            aria-label={`Back to the ${placeNoun}`}
            title={`Back to the ${placeNoun}`}
          >
            <ArrowLeft aria-hidden className="size-4" />
          </Button>
          {state ? <QuizTile uuid={state.game.quiz.uuid} title={title} size="sm" /> : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">
              {title}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {caption}
              {/* The quiet half of the failed-read rule (see `GameBody`): the
                  game stays exactly where it is, and this is the only thing
                  that changes. No panel, no interruption — the recovery beat is
                  already asking again. */}
              {game.readFailing && (
                <span className="inline-flex items-center gap-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                  <WifiOff aria-hidden className="size-3" />
                  Reconnecting…
                </span>
              )}
            </p>
          </div>
          {canInvite && (
            <RaisedButton
              tone="quiet"
              className={cn(HEADER_RAISED, 'shrink-0')}
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus aria-hidden className="size-4" />
              Invite
            </RaisedButton>
          )}
          {canCancel && (
            <RaisedButton
              tone="quiet"
              className={cn(HEADER_RAISED, 'shrink-0 text-muted-foreground hover:text-destructive')}
              onClick={() => setCancelOpen(true)}
            >
              <Ban aria-hidden className="size-4" />
              End game
            </RaisedButton>
          )}
        </div>
      </div>

      {/* Phase changes, for readers who can't see them. Polite and COARSE —
          one sentence per phase, never a per-second timer reading (which is
          exactly why the clock leaves are `aria-live="off"`). */}
      <p role="status" aria-live="polite" className="sr-only">
        {announce(game)}
      </p>

      {/* ── Late join / watching ──────────────────────────────────────── */}
      {showJoinBar && (
        <div className="shrink-0 border-b bg-primary/5 px-4 pt-2 pb-3">
          <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              You&rsquo;re watching. Join now and you play from the next
              question.
            </p>
            <RaisedButton className={COMPACT_RAISED} onClick={game.join} disabled={game.joining}>
              {game.joining ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <LogIn aria-hidden className="size-4" />
              )}
              Join
            </RaisedButton>
          </div>
        </div>
      )}
      {game.joinErrorStatus === 403 && (
        <div className="shrink-0 border-b px-4 py-2">
          <p className="mx-auto w-full max-w-2xl text-xs text-muted-foreground">
            This quiz doesn&rsquo;t allow joining once it has started. You can
            watch this one through.
          </p>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <GameBody
        game={game}
        room={room}
        placeNoun={placeNoun}
        spaceName={spaceName}
        viewerUuid={viewerUuid}
        viewerId={viewerId}
        onClose={onClose}
      />

      {inviteOpen && canInvite && (
        <GameInviteDialog
          gameUuid={gameUuid}
          quizUuid={state?.game.quiz.uuid ?? null}
          quizTitle={title}
          onOpenChange={setInviteOpen}
        />
      )}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this game?</AlertDialogTitle>
            <AlertDialogDescription>
              The game stops for everyone straight away. A cancelled game keeps
              no scores and posts nothing to the {placeNoun}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={game.cancelling}>
              Keep playing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                game.cancel();
                setCancelOpen(false);
              }}
              disabled={game.cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {game.cancelling && (
                <Loader2 aria-hidden className="mr-1 size-4 animate-spin" />
              )}
              End game
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {cover === 'viewport' ? <DialogPrimitive.Title className="sr-only">Live quiz</DialogPrimitive.Title> : null}
    </section>
  );

  // In a room the screen makes the rest inert itself (ChannelScreen). Over the
  // whole window there is nothing the screen can mark, so the game is a modal
  // dialog: focus stays in it and the page under it is hidden from assistive
  // tech (live quiz review, 11 November 2026). Escape stays off, as above.
  if (cover === 'room') return frame;
  return (
    <DialogPrimitive.Root open modal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          asChild
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            frameRef.current?.focus({ preventScroll: true });
          }}
        >
          {frame}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** The three-state region plus the phase router — split out so the frame above
 *  it never re-renders on a phase body's own churn. */
function GameBody({
  game,
  room,
  placeNoun,
  spaceName,
  viewerId,
  viewerUuid,
  onClose,
}: {
  game: ReturnType<typeof useLiveGame>;
  room: QuizRoom;
  /** What leaving returns to ("channel", "Space", "chat"); see `GameOverlay`'s `place`. */
  placeNoun: string;
  spaceName: string | null;
  viewerId: number | null;
  viewerUuid: string | null;
  onClose: () => void;
}) {
  if (game.isPending) return <GameStageSkeleton />;

  // A FAILED READ NEVER TAKES THE GAME OFF THE SCREEN.
  //
  // React Query keeps `data` when a REFETCH fails, so a single 500 or timeout
  // mid-question used to replace the whole game — question, tiles, timer,
  // locked answer — with an error card, and the recovery beat then flipped the
  // screen back and forth every few seconds. It also made the player unable to
  // answer for as long as it lasted. The read that exists to unfreeze the room
  // must never be the thing that blanks it: the designed refusals below are for
  // a game we have NOTHING to show for; while a snapshot is in hand the game
  // plays on and the frame header carries a quiet "reconnecting" mark.
  if (!game.state) {
    if (game.errorStatus === 403) {
      return (
        <GameStage>
          <CollabMessage
            icon={Trophy}
            tone="alert"
            title="This game isn't yours to watch"
            description={`Live quizzes are open to members of the ${roomNoun(room)} they run in.`}
            action={
              <RaisedButton tone="quiet" className={COMPACT_RAISED} onClick={onClose}>
                Back to the {placeNoun}
              </RaisedButton>
            }
          />
        </GameStage>
      );
    }
    if (game.errorStatus === 404) {
      return (
        <GameStage>
          <CollabMessage
            icon={Trophy}
            tone="neutral"
            title="This game is gone"
            description={`It may have been removed along with its quiz. Nothing else in the ${roomNoun(room)} changed.`}
            action={
              <RaisedButton tone="quiet" className={COMPACT_RAISED} onClick={onClose}>
                Back to the {placeNoun}
              </RaisedButton>
            }
          />
        </GameStage>
      );
    }
    return (
      <GameStage>
        <CollabMessage
          icon={WifiOff}
          tone="alert"
          title="Couldn't reach the game"
          description="The game keeps running on our side. This screen just lost touch with it."
          action={
            <RaisedButton tone="quiet" className={COMPACT_RAISED} onClick={game.retry}>
              Try again
            </RaisedButton>
          }
        />
      </GameStage>
    );
  }

  // A hand-edited or stale `?game=` can name a game in ANOTHER room the
  // reader also belongs to — the server would serve it happily, and this
  // screen would then run a game whose events arrive on a room it is not
  // listening to, under the wrong room's name. Say so instead (audit L9).
  if (!gameInRoom(game.state.game, room)) {
    const noun = roomNoun(room);
    return (
      <GameStage>
        <CollabMessage
          icon={Trophy}
          tone="neutral"
          title={`This game belongs to another ${noun}`}
          description={`Quizzes are played in the ${noun} they were started in. Open that ${noun} to join or see how it went.`}
          action={
            <RaisedButton tone="quiet" className={COMPACT_RAISED} onClick={onClose}>
              Back to the {placeNoun}
            </RaisedButton>
          }
        />
      </GameStage>
    );
  }

  const gameUuid = game.state.game.uuid;

  // The game is over, but its last question never had a reveal — close that
  // question from the results before the podium (see `FinalAnswerStage`).
  if (game.closingAnswer) {
    return (
      <FinalAnswerStage
        closing={game.closingAnswer}
        gameUuid={gameUuid}
        viewerId={viewerId}
        isPlaying={game.isPlaying}
        onContinue={game.skipToScores}
      />
    );
  }

  switch (game.phase) {
    case 'lobby':
      return <LobbyStage game={game} />;
    case 'countdown':
      return <CountdownStage game={game} />;
    case 'question':
    case 'reveal':
      return <QuestionStage game={game} viewerUuid={viewerUuid} />;
    case 'cancelled':
      return (
        <CancelledStage cancelledBy={game.cancelledBy} onBack={onClose} backLabel={`Back to the ${placeNoun}`} />
      );
    case 'finished':
    default:
      return (
        <PodiumStage
          gameUuid={gameUuid}
          viewerId={viewerId}
          viewerUuid={viewerUuid}
          certificate={game.state.certificate}
          spaceName={spaceName}
        />
      );
  }
}

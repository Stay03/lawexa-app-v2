'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Ban, Loader2, LogIn, Trophy, WifiOff } from 'lucide-react';

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
import {
  CancelledStage,
  CountdownStage,
  LobbyStage,
  PodiumStage,
  QuestionStage,
} from './GamePhases';
import { canJoinNow } from './model';
import { GameStage, GameStageSkeleton } from './ui';
import { useLiveGame } from './use-game';
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
 */

/** One coarse sentence per phase for the polite live region. Question and
 *  reveal name their INDEX, because "question" alone would announce the same
 *  word ten times and tell a screen-reader user nothing about progress. */
function announce(game: ReturnType<typeof useLiveGame>): string {
  const state = game.state;
  if (!state) return '';
  const index = (state.current_question?.index ?? 0) + 1;
  const total = state.game.question_count;
  switch (game.phase) {
    case 'lobby':
      return `Quiz lobby: ${state.game.quiz.title}`;
    case 'countdown':
      return 'The game is about to start';
    case 'question':
      return `Question ${index} of ${total}`;
    case 'reveal':
      return `Answer revealed for question ${index}`;
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

export function GameOverlay({
  channelUuid,
  gameUuid,
  viewerId,
  viewerUuid,
  onClose,
}: {
  channelUuid: string;
  gameUuid: string;
  viewerId: number | null;
  viewerUuid: string | null;
  onClose: () => void;
}) {
  const game = useLiveGame({ channelUuid, gameUuid, viewerId, viewerUuid });
  const [cancelOpen, setCancelOpen] = useState(false);
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
  // The hold keeps the last reveal on screen while the server has already
  // finished — say "Answer", not "Final scores", until it really is.
  const caption = game.holdingFinalReveal
    ? PHASE_CAPTION.reveal
    : PHASE_CAPTION[phase];

  const canCancel =
    game.isHost && state !== null && phase !== 'finished' && phase !== 'cancelled';
  const showJoinBar =
    state !== null &&
    !game.isPlaying &&
    phase !== 'lobby' &&
    canJoinNow(state) &&
    game.joinErrorStatus !== 403;

  return (
    <section
      ref={frameRef}
      tabIndex={-1}
      aria-label="Live quiz"
      className={cn(
        'outline-none',
        // Above the feed's floating composer overlay — the mode covers the
        // whole channel screen, not just its pane region.
        'absolute inset-0 z-20 flex min-h-0 flex-col bg-background',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200',
      )}
    >
      {/* ── Frame header ──────────────────────────────────────────────── */}
      <div className="shrink-0 border-b px-4 py-2.5">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onClose}
            aria-label="Back to the channel"
            title="Back to the channel"
          >
            <ArrowLeft aria-hidden className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {title}
            </p>
            <p className="text-xs text-muted-foreground">{caption}</p>
          </div>
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => setCancelOpen(true)}
            >
              <Ban aria-hidden className="size-4" />
              End game
            </Button>
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
        <div className="shrink-0 border-b bg-primary/5 px-4 py-2">
          <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              You&rsquo;re watching. Join now and you play from the next
              question.
            </p>
            <Button size="sm" onClick={game.join} disabled={game.joining}>
              {game.joining ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <LogIn aria-hidden className="size-4" />
              )}
              Join
            </Button>
          </div>
        </div>
      )}
      {game.joinErrorStatus === 403 && (
        <div className="shrink-0 border-b px-4 py-2">
          <p className="mx-auto w-full max-w-2xl text-xs text-muted-foreground">
            This quiz doesn&rsquo;t allow joining once it has started — you can
            watch this one through.
          </p>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <GameBody
        game={game}
        channelUuid={channelUuid}
        viewerUuid={viewerUuid}
        viewerId={viewerId}
        onClose={onClose}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this game?</AlertDialogTitle>
            <AlertDialogDescription>
              The game stops for everyone straight away. A cancelled game keeps
              no scores and posts nothing to the channel.
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
    </section>
  );
}

/** The three-state region plus the phase router — split out so the frame above
 *  it never re-renders on a phase body's own churn. */
function GameBody({
  game,
  channelUuid,
  viewerId,
  viewerUuid,
  onClose,
}: {
  game: ReturnType<typeof useLiveGame>;
  channelUuid: string;
  viewerId: number | null;
  viewerUuid: string | null;
  onClose: () => void;
}) {
  if (game.isPending) return <GameStageSkeleton />;

  if (game.isError || !game.state) {
    if (game.errorStatus === 403) {
      return (
        <GameStage>
          <CollabMessage
            icon={Trophy}
            tone="alert"
            title="This game isn't yours to watch"
            description="Live quizzes are open to members of the channel they run in."
            action={
              <Button variant="outline" size="sm" onClick={onClose}>
                Back to the channel
              </Button>
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
            description="It may have been removed along with its quiz. Nothing else in the channel changed."
            action={
              <Button variant="outline" size="sm" onClick={onClose}>
                Back to the channel
              </Button>
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
          description="The game keeps running on our side — this screen just lost touch with it."
          action={
            <Button variant="outline" size="sm" onClick={game.retry}>
              Try again
            </Button>
          }
        />
      </GameStage>
    );
  }

  // A hand-edited or stale `?game=` can name a game in ANOTHER channel the
  // reader also belongs to — the server would serve it happily, and this
  // screen would then run a game whose events arrive on a room it is not
  // listening to, under the wrong channel's name. Say so instead (audit L9).
  if (game.state.game.channel_uuid !== channelUuid) {
    return (
      <GameStage>
        <CollabMessage
          icon={Trophy}
          tone="neutral"
          title="This game belongs to another channel"
          description="Quizzes are played in the channel they were started in. Open that channel to join or see how it went."
          action={
            <Button variant="outline" size="sm" onClick={onClose}>
              Back to the channel
            </Button>
          }
        />
      </GameStage>
    );
  }

  const gameUuid = game.state.game.uuid;

  switch (game.phase) {
    case 'lobby':
      return <LobbyStage game={game} />;
    case 'countdown':
      return <CountdownStage game={game} />;
    case 'question':
    case 'reveal':
      return <QuestionStage game={game} viewerUuid={viewerUuid} />;
    case 'cancelled':
      return <CancelledStage cancelledBy={game.cancelledBy} onBack={onClose} />;
    case 'finished':
    default:
      return (
        <PodiumStage
          gameUuid={gameUuid}
          viewerId={viewerId}
          viewerUuid={viewerUuid}
        />
      );
  }
}

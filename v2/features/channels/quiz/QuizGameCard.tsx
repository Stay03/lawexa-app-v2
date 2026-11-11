'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { formatFullTimestamp, formatMessageTime } from '@/lib/utils/collab';
import { RaisedButton } from '@/v2/features/quiz/solo/ui';
import { useJoinGame } from './mutations';
import { channelQuizQueries } from './queries';
import type { QuizRoom } from './quiz-room';
import { COMPACT_RAISED, GameMark } from './ui';
import '@/v2/features/quiz/solo/solo-quiz.css';

/**
 * One quiz line as the card draws it, from a channel's system message or a
 * Space chat's event row: both carry the same two types and the game's uuid.
 */
export interface QuizGameLine {
  finished: boolean;
  /** The game the card opens; null draws the sentence alone. */
  gameUuid: string | null;
  /** The server's sentence. */
  content: string;
  /** ISO time the line was written. */
  createdAt: string;
}

/**
 * QuizGameCard — the designed card for the two quiz lines
 * (`metadata.type: 'quiz_game_live' | 'quiz_game_finished'`; digest §E), in a
 * channel's feed and in a Space's chat (live quiz in Spaces, 7a007a8c).
 *
 * W2 shipped it render-only because an action that could not work yet must not
 * exist. W6 gives it the actions: `metadata.game_uuid` is the handle for both
 * — Join / Watch on a live card, See results on a finished one. Unknown FUTURE
 * `metadata.type` values never reach this component; the feed model's fallback
 * renders them as plain text (contractual).
 *
 * NO DEAD BUTTONS, IN ANY STATE — and the live card is the one that could rot,
 * because a game ends and its card stays in the transcript forever. So the card
 * consults the channel's live-game probe (ONE shared query for the whole feed,
 * `channelQuizQueries.activeGame`): while that probe names THIS game, the card
 * offers the way in; once it doesn't, the card says the game has ended and
 * offers to show what happened instead. Every press leads somewhere true.
 *
 * "ENDED" IS A CLAIM, AND IT NEEDS EVIDENCE (audit M1). The probe has three
 * outcomes, not two, and only ONE of them licenses that sentence:
 *  - PENDING — nothing is known yet, so the card holds a skeleton in the
 *    action row. A live game announced seconds ago must never be declared over
 *    for the half-second before its probe answers;
 *  - ERROR — still nothing known. The card offers a neutral way in rather than
 *    reporting a state it failed to read;
 *  - RESOLVED and not naming this game — now, and only now, it has ended.
 *
 * JOIN IS A REAL JOIN. Pressing Join posts it and then opens the game, so the
 * player is in the lobby the moment the screen arrives rather than facing a
 * second button. A refusal (late joining off) is not an error either: the game
 * screen opens anyway and explains, in place, that this one is watch-only.
 *
 * IN THE QUIZ'S OWN LOOK (Stay and Arthur, 11 November 2026): a rounded-2xl
 * card on a 2px border, the game's gold tile (`GameMark`: live, or the trophy
 * once finished), and its actions as the solo quiz's raised button a size
 * down: gold to play, the quiet twin for everything else.
 */
export function QuizGameCard({
  line,
  room,
  viewerId,
  onOpenGame,
}: {
  line: QuizGameLine;
  /** The room the card sits in, whose live-game probe it reads (quiz-room.ts). */
  room: QuizRoom;
  viewerId: number | null;
  /** Opens the room's game mode (screen-owned; `?game=`). */
  onOpenGame: (gameUuid: string) => void;
}) {
  const { finished, gameUuid } = line;

  const activeQuery = useQuery({
    ...channelQuizQueries.activeGame({ room, viewerId }),
    // A finished card can never become live again — it needs no probe.
    enabled: !finished && gameUuid !== null,
  });
  const liveGame = activeQuery.data?.data?.[0] ?? null;
  const stillLive = !finished && liveGame?.uuid === gameUuid;
  const lateJoinOff = stillLive && liveGame.settings.allow_late_join === false;
  /** Nothing known YET — reserve the row's shape. */
  const probePending = !finished && activeQuery.isPending;
  /** Nothing known AT ALL — offer a way in, claim nothing (see the docblock). */
  const probeUnreadable = !finished && !stillLive && activeQuery.isError;

  const join = useJoinGame(gameUuid ?? '', viewerId);

  // DOUBLE-TAP IS GUARDED AT THE SOURCE (audit L5). A local "opening" flag
  // would look right and rot: this card is not unmounted by opening a game
  // (the mode covers the feed), so the flag would still be set when the reader
  // came back and the button would be dead. `openGame` in `ChannelScreen`
  // instead checks the LIVE URL before pushing, which cannot go stale and
  // covers the card, the live bar and the library sheet in one place.
  const open = () => {
    if (gameUuid) onOpenGame(gameUuid);
  };

  return (
    <div className="v2-solo mx-auto w-full max-w-md">
      <div className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-4">
        <GameMark finished={finished} />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-[11px] font-bold tracking-[0.08em] uppercase',
              stillLive ? 'text-[var(--solo-gold-text)]' : 'text-muted-foreground',
            )}
          >
            {finished ? 'Quiz finished' : stillLive ? 'Live quiz' : 'Quiz'}
          </p>
          <p className="mt-0.5 text-sm font-semibold break-words text-foreground">
            {line.content}
          </p>

          {gameUuid && (
            <div className="mt-3 flex flex-wrap items-center gap-2 pb-1">
              {finished ? (
                <RaisedButton tone="quiet" className={COMPACT_RAISED} onClick={open}>
                  See results
                </RaisedButton>
              ) : probePending ? (
                // Nothing is known about this game yet. Reserve the row's
                // shape rather than guess at its state.
                <Skeleton aria-hidden className="h-10 w-20 rounded-xl" />
              ) : probeUnreadable ? (
                // The probe failed, so whether this game is still running is
                // simply unknown. Open it — the game screen reads the game
                // itself and states the truth there.
                <RaisedButton tone="quiet" className={COMPACT_RAISED} onClick={open}>
                  Open quiz
                </RaisedButton>
              ) : stillLive ? (
                <RaisedButton
                  tone={lateJoinOff ? 'quiet' : 'primary'}
                  className={COMPACT_RAISED}
                  disabled={join.isPending}
                  onClick={() => {
                    if (lateJoinOff) {
                      open();
                      return;
                    }
                    // Join first, open either way: a refusal is a state on the
                    // game screen, not a reason to stay in the chat.
                    join.mutate(undefined, {
                      onSettled: () => onOpenGame(gameUuid),
                    });
                  }}
                >
                  {join.isPending && (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  )}
                  {lateJoinOff ? 'Watch' : 'Join'}
                </RaisedButton>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">
                    This game has ended
                  </span>
                  <RaisedButton
                    tone="quiet"
                    className="h-8 rounded-lg px-3 text-xs"
                    onClick={open}
                  >
                    See what happened
                  </RaisedButton>
                </>
              )}
            </div>
          )}
        </div>
        <time
          dateTime={line.createdAt}
          title={formatFullTimestamp(line.createdAt)}
          className="shrink-0 pt-0.5 text-xs text-muted-foreground"
        >
          {formatMessageTime(line.createdAt)}
        </time>
      </div>
    </div>
  );
}

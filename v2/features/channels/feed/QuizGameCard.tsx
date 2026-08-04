'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Radio, Trophy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatFullTimestamp, formatMessageTime } from '@/lib/utils/collab';
import type { Message } from '@/types/collab';
import { useJoinGame } from '../quiz/mutations';
import { channelQuizQueries } from '../quiz/queries';

/**
 * QuizGameCard — the designed card for the two quiz system messages
 * (`metadata.type: 'quiz_game_live' | 'quiz_game_finished'`; digest §E).
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
 */
export function QuizGameCard({
  message,
  channelUuid,
  viewerId,
  onOpenGame,
}: {
  message: Message;
  channelUuid: string;
  viewerId: number | null;
  /** Opens the channel's game mode (screen-owned; `?game=`). */
  onOpenGame: (gameUuid: string) => void;
}) {
  const finished = message.metadata.type === 'quiz_game_finished';
  const gameUuid = message.metadata.game_uuid ?? null;

  const activeQuery = useQuery({
    ...channelQuizQueries.activeGame({ channelUuid, viewerId }),
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
    <div className="mx-auto w-full max-w-md">
      <div className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3">
        <span
          aria-hidden
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          {finished ? <Trophy className="size-4" /> : <Radio className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {finished ? 'Quiz finished' : stillLive ? 'Live quiz' : 'Quiz'}
          </p>
          <p className="mt-0.5 text-sm break-words text-foreground">
            {message.content}
          </p>

          {gameUuid && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {finished ? (
                <Button size="sm" variant="outline" onClick={open}>
                  See results
                </Button>
              ) : probePending ? (
                // Nothing is known about this game yet. Reserve the row's
                // shape rather than guess at its state.
                <Skeleton aria-hidden className="h-8 w-20 rounded-md" />
              ) : probeUnreadable ? (
                // The probe failed, so whether this game is still running is
                // simply unknown. Open it — the game screen reads the game
                // itself and states the truth there.
                <Button size="sm" variant="outline" onClick={open}>
                  Open quiz
                </Button>
              ) : stillLive ? (
                <Button
                  size="sm"
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
                </Button>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">
                    This game has ended
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={open}
                  >
                    See what happened
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        <time
          dateTime={message.created_at}
          title={formatFullTimestamp(message.created_at)}
          className="shrink-0 pt-0.5 text-xs text-muted-foreground"
        >
          {formatMessageTime(message.created_at)}
        </time>
      </div>
    </div>
  );
}

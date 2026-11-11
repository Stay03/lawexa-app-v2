'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { RaisedButton } from '@/v2/features/quiz/solo/ui';
import { useJoinGame } from './mutations';
import { channelQuizQueries } from './queries';
import type { QuizGame } from '@/types/channel-quiz';
import type { QuizRoom } from './quiz-room';
import { COMPACT_RAISED, LiveQuizTile } from './ui';
import '@/v2/features/quiz/solo/solo-quiz.css';

/**
 * LiveQuizBar — the channel's standing answer to "is a quiz running right
 * now?".
 *
 * Phase-5 W6. It exists because the transcript card is not a reliable door:
 * the `quiz_game_live` system message sits wherever it was posted, so a reader
 * scrolled up — or one who arrived after it — has no way in. A quiet bar under
 * the channel header is always where a live game is, and it disappears the
 * moment the game ends, which is exactly the "no dead affordances" rule.
 *
 * IT RENDERS NOTHING when no game is live: no reserved space, no placeholder,
 * no layout shift for the 99% of channel-time with no quiz in it. When one
 * appears it fades in over 200ms (motion-reduce honoured), which is inside the
 * house budget — a bar sliding into a conversation would be noise.
 *
 * ONE QUERY, SHARED. This mounts the same `activeGame` probe every quiz card
 * reads, so the bar costs nothing extra; its docblock in `./queries.ts` covers
 * the cadence and why it currently has one.
 *
 * ANY ROOM: a channel's, or a Space's own (its page and its chats; live quiz
 * in Spaces, 10 November 2026), by the room's probe.
 *
 * TWO SHAPES, ONE BAR. Under a channel's or a chat's header it is a `strip`,
 * edge to edge, its content on the transcript's centred column. On a Space's
 * page it is a `card` in the page's own column, aligned with the header above
 * it: a strip there centred its words away from everything else on the page
 * (fixture pictures, 10 November 2026).
 *
 * IN THE QUIZ'S OWN LOOK (Stay and Arthur, 11 November 2026): the quiz's
 * letter tile with a live dot, its title in bold, and Join or Watch as the
 * solo quiz's raised button a size down (`COMPACT_RAISED`). `v2-solo` on the
 * root carries the tokens the lip and the dot are drawn from.
 */
/**
 * The game live in a room, by the room's one shared probe, or null: what the
 * bar shows, and what a screen asks when its layout depends on the bar being
 * there (a phone chat's transcript stops passing under the header while it
 * is, ConversationScreen).
 */
export function useRoomLiveGame(room: QuizRoom | null, viewerId: number | null): QuizGame | null {
  const query = useQuery({
    ...channelQuizQueries.activeGame({ room: room ?? NO_ROOM, viewerId }),
    enabled: room !== null,
  });
  return room === null ? null : (query.data?.data?.[0] ?? null);
}

/** Stands in for a room not known yet; its probe is never enabled. */
const NO_ROOM: QuizRoom = { kind: 'space', uuid: '' };

export function LiveQuizBar({
  room,
  viewerId,
  onOpenGame,
  shape = 'strip',
}: {
  room: QuizRoom;
  viewerId: number | null;
  onOpenGame: (gameUuid: string) => void;
  shape?: 'strip' | 'card';
}) {
  const game = useRoomLiveGame(room, viewerId);
  const join = useJoinGame(game?.uuid ?? '', viewerId);

  if (!game) return null;

  const lobby = game.status === 'lobby';
  const canEnterAsPlayer = lobby || game.settings.allow_late_join;
  const players = game.player_count;

  return (
    <div
      className={cn(
        'v2-solo shrink-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
        shape === 'strip'
          ? 'border-b bg-primary/5 px-4 pt-2 pb-3'
          : 'rounded-2xl border-2 border-border bg-card px-3 pt-3 pb-3.5',
      )}
    >
      <div className={cn('flex w-full items-center gap-3', shape === 'strip' && 'mx-auto max-w-3xl')}>
        <LiveQuizTile uuid={game.quiz.uuid} title={game.quiz.title} size={shape === 'strip' ? 'sm' : 'md'} />
        <p className="min-w-0 flex-1 truncate text-sm text-foreground">
          <span className="font-bold">{game.quiz.title}</span>{' '}
          <span className="text-muted-foreground">
            {lobby ? 'is starting' : 'is live'}
            {players !== undefined &&
              ` · ${players} ${players === 1 ? 'player' : 'players'}`}
          </span>
        </p>
        {/* DOUBLE-TAP IS GUARDED AT THE SOURCE, NOT HERE (audit L5). The Watch
            path has no mutation to wait on, so the obvious guard is a local
            "opening" flag — but this bar is not unmounted by opening a game
            (the mode covers it), so that flag would still be set when the
            reader came back, leaving a permanently dead button. `openGame` in
            `ChannelScreen` is idempotent against the LIVE URL instead, which
            cannot go stale and covers all three entry points at once. */}
        {/* Gold to play; watching is the quiet twin. */}
        <RaisedButton
          tone={canEnterAsPlayer ? 'primary' : 'quiet'}
          className={cn(COMPACT_RAISED, 'shrink-0')}
          disabled={join.isPending}
          onClick={() => {
            if (!canEnterAsPlayer) {
              onOpenGame(game.uuid);
              return;
            }
            // Join, then open either way — a refusal is a state on the game
            // screen, never a reason to leave the reader in the chat.
            join.mutate(undefined, { onSettled: () => onOpenGame(game.uuid) });
          }}
        >
          {join.isPending && (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          )}
          {canEnterAsPlayer ? 'Join' : 'Watch'}
        </RaisedButton>
      </div>
    </div>
  );
}

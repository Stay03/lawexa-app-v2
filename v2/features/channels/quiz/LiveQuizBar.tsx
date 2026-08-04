'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Radio } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useJoinGame } from './mutations';
import { channelQuizQueries } from './queries';

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
 */
export function LiveQuizBar({
  channelUuid,
  viewerId,
  onOpenGame,
}: {
  channelUuid: string;
  viewerId: number | null;
  onOpenGame: (gameUuid: string) => void;
}) {
  const query = useQuery(
    channelQuizQueries.activeGame({ channelUuid, viewerId }),
  );
  const game = query.data?.data?.[0] ?? null;
  const join = useJoinGame(game?.uuid ?? '', viewerId);

  if (!game) return null;

  const lobby = game.status === 'lobby';
  const canEnterAsPlayer = lobby || game.settings.allow_late_join;
  const players = game.player_count;

  return (
    <div className="shrink-0 border-b bg-primary/5 px-4 py-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
        >
          <Radio className="size-3.5" />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm text-foreground">
          <span className="font-medium">{game.quiz.title}</span>{' '}
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
        <Button
          size="sm"
          className="shrink-0"
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
        </Button>
      </div>
    </div>
  );
}

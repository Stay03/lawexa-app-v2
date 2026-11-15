'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Radio, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { extractApiError } from '@/lib/utils/api-error';
import type { LiveQuizGame } from '@/types/channel-quiz';
import { useFindGameByCode } from '@/v2/features/channels/quiz/mutations';
import { channelQuizQueries } from '@/v2/features/channels/quiz/queries';
import {
  codeRefusal,
  isJoinCode,
  JOIN_CODE_LENGTH,
  liveGameAction,
  liveGameState,
  NO_GAME_FOR_CODE,
  normalizeJoinCode,
  openGameHref,
} from '@/v2/features/channels/quiz/open-game';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { QuizTile } from '../solo/QuizTile';
import { RaisedButton } from '../solo/ui';

/**
 * LiveNowRow — the top of the Quiz page's Explore tab for a signed-in account
 * (live quiz without a Space, Stay's decisions, thread 12341975): the public
 * games in their lobby or running, each with its quiz, host, where it is and
 * how many play, and a way in; and a field for a 6-character join code.
 *
 * A game by link is never listed (the server's list holds public games only),
 * and a finished game leaves the row on the next read: the list is read
 * every 20 seconds while the row is on screen, and again when a game it
 * shows ends (`liveGamesPage`, `useOpenQuizLive`). The heading and the code
 * field are there from the first frame; the cards fade in when the list
 * answers, and an empty list says so in one quiet line.
 *
 * The cards are the prototype Stay and Arthur saw (proto-live-no-space,
 * 31fba56a): one row that scrolls sideways on a phone, three across on a
 * computer, in the quiz's own raised buttons.
 */
export function LiveNowRow({ viewerId }: { viewerId: number | null }) {
  const live = useQuery(channelQuizQueries.liveGamesPage({ viewerId }));
  const games = live.data?.data.games ?? [];

  return (
    <section aria-labelledby="live-now" className="mb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="relative flex size-2.5">
            <span className="absolute inline-flex size-full rounded-full bg-red-500/60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
          </span>
          <h2 id="live-now" className="text-base font-bold text-foreground">
            Live now
          </h2>
          <span className="hidden text-sm text-muted-foreground sm:inline">Public games anyone can join</span>
        </div>
        <JoinByCode />
      </div>
      {games.length > 0 ? (
        <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          {games.map((game) => (
            <LiveGameCard key={game.uuid} game={game} />
          ))}
        </ul>
      ) : live.isSuccess ? (
        <p className="text-sm text-muted-foreground">No public games right now. Host one from any quiz, or join with a code.</p>
      ) : null}
    </section>
  );
}

function LiveGameCard({ game }: { game: LiveQuizGame }) {
  const started = game.status !== 'lobby';
  return (
    <li className="flex w-[17rem] shrink-0 snap-start flex-col gap-3 rounded-2xl border-2 border-border bg-card p-4 md:w-auto">
      <div className="flex min-w-0 items-start gap-3">
        <QuizTile uuid={game.quiz.uuid} title={game.quiz.title} size="md" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{game.quiz.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {game.host ? `Hosted by ${game.host.name}` : 'Hosted on Lawexa'}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className={cn('inline-flex items-center gap-1', started && 'text-foreground')}>
          <Radio aria-hidden className={cn('size-3.5', started ? 'text-red-500' : 'text-muted-foreground')} />
          {liveGameState(game)}
        </span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Users aria-hidden className="size-3.5" />
          {game.player_count} playing
        </span>
      </div>
      <RaisedButton asChild className={cn('h-11 w-full text-sm', FOCUS_RING)}>
        <Link href={openGameHref(game.uuid)}>{liveGameAction(game)}</Link>
      </RaisedButton>
    </li>
  );
}

/**
 * The join code field: six characters, any case, spaces allowed. A code that
 * finds no game says so in one sentence, whether it never existed or the
 * game has ended (Techlead, 15 November 2026).
 */
function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const lookup = useFindGameByCode();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeJoinCode(code);
    if (normalized === '' || lookup.isPending) return;
    if (!isJoinCode(normalized)) {
      setError(NO_GAME_FOR_CODE);
      return;
    }
    setError(null);
    lookup.mutate(normalized, {
      onSuccess: (response) => router.push(openGameHref(response.data.uuid)),
      onError: (failure) => setError(codeRefusal(extractApiError(failure).status)),
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Input
          value={code}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
            if (error) setError(null);
          }}
          aria-label="Join code"
          aria-invalid={error !== null}
          aria-describedby={error ? 'join-code-error' : undefined}
          placeholder="Join code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={JOIN_CODE_LENGTH + 2}
          className="h-11 w-32 rounded-xl border-2 text-center font-comfortaa font-bold tracking-[0.15em] placeholder:font-sans placeholder:font-normal placeholder:tracking-normal"
        />
        <RaisedButton type="submit" className="h-11 px-4 text-sm" disabled={code.trim() === '' || lookup.isPending}>
          {lookup.isPending ? <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" /> : null}
          Join
        </RaisedButton>
      </div>
      {error ? (
        <p id="join-code-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}

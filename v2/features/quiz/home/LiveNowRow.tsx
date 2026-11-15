'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Hash, Loader2 } from 'lucide-react';

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
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { QuizTile } from '../solo/QuizTile';
import { RaisedButton } from '../solo/ui';

/**
 * LiveNowRow — the Quiz page's row of circles under the title (concept C,
 * Stay's pick, 15 November 2026: "Go with C"): "Enter code" first, then each
 * public game in its lobby or running, as its quiz tile in a red Live ring
 * with its title and how many play. The row scrolls sideways when it fills.
 * With no game live, one quiet line sits beside the code circle.
 *
 * A game by link is never listed (the server's list holds public games only),
 * and a finished game leaves the row on the next read: the list is read every
 * 20 seconds while the row is on screen, and again when a game it shows ends
 * (`liveGamesPage`, `useOpenQuizLive`). The code circle is there from the
 * first frame; the games fade in when the list answers.
 */
export function LiveNowRow({ viewerId, onCode }: { viewerId: number | null; onCode: () => void }) {
  const live = useQuery(channelQuizQueries.liveGamesPage({ viewerId }));
  const games = live.data?.data.games ?? [];

  return (
    <section aria-labelledby="live-now" className="mb-4">
      <h2 id="live-now" className="sr-only">
        Live now
      </h2>
      <ul className="-mx-4 flex items-start gap-3 overflow-x-auto px-4 pt-1 pb-1">
        <li className={STORY}>
          <button
            type="button"
            onClick={onCode}
            aria-label="Enter a game code"
            className={cn(
              'v2-interactive flex size-16 items-center justify-center rounded-full border-2 border-dashed border-primary/70 text-primary transition-colors hover:bg-primary/10',
              FOCUS_RING,
            )}
          >
            <Hash aria-hidden className="size-6" />
          </button>
          <span aria-hidden className={STORY_LABEL}>
            Enter code
          </span>
        </li>
        {games.map((game) => (
          <LiveGameCircle key={game.uuid} game={game} />
        ))}
        {live.isSuccess && games.length === 0 ? (
          <li className="flex min-h-16 items-center pl-1 text-sm leading-snug text-muted-foreground">
            No live games right now.
            <br />
            Host one from any quiz.
          </li>
        ) : null}
      </ul>
    </section>
  );
}

const STORY = 'flex w-[5.5rem] shrink-0 flex-col items-center gap-1.5 text-center';
const STORY_LABEL = 'line-clamp-2 w-full text-xs leading-tight font-medium text-foreground';

/** One live game: its tile in a red ring, a Live tag, its title and how many play. The whole circle opens the game. */
function LiveGameCircle({ game }: { game: LiveQuizGame }) {
  return (
    <li className={cn(STORY, 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200')}>
      <Link
        href={openGameHref(game.uuid)}
        aria-label={`${liveGameAction(game)} ${game.quiz.title}, ${liveGameState(game)}, ${game.player_count} playing`}
        className={cn('relative rounded-full', FOCUS_RING)}
      >
        <span className="flex size-16 items-center justify-center rounded-full p-[3px] ring-2 ring-red-500">
          <QuizTile uuid={game.quiz.uuid} title={game.quiz.title} className="size-full rounded-full text-xl shadow-none" />
        </span>
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-1.5 py-px text-[10px] leading-4 font-bold text-white ring-2 ring-background">
          Live
        </span>
      </Link>
      <span aria-hidden className={cn(STORY_LABEL, 'mt-1')}>
        {game.quiz.title}
      </span>
      <span aria-hidden className="-mt-0.5 text-[11px] tabular-nums text-muted-foreground">
        {game.player_count} playing
      </span>
    </li>
  );
}

/** "Enter code": the code in a bottom sheet on a phone, a centred dialog on a computer. */
export function CodeSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      size="content"
      title="Join a game"
      description="Enter the 6-character code the host shared."
    >
      <JoinByCode />
    </ResponsiveOverlay>
  );
}

/**
 * The join code field: six characters, any case, spaces allowed, then Join
 * game. A code that finds no game says so in one sentence, whether it never
 * existed or the game has ended (Techlead, 15 November 2026).
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
    <form onSubmit={submit} className="flex flex-col gap-3">
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
        autoFocus
        maxLength={JOIN_CODE_LENGTH + 2}
        className="h-16 w-full rounded-xl border-2 text-center font-comfortaa text-3xl font-bold tracking-[0.3em] placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal"
      />
      {error ? (
        <p id="join-code-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <RaisedButton type="submit" className="h-12 w-full text-base" disabled={code.trim() === '' || lookup.isPending}>
        {lookup.isPending ? <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" /> : null}
        Join game
      </RaisedButton>
    </form>
  );
}

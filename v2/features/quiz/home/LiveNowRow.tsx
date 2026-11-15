'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Hash, Loader2, Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
 * LiveNowRow — the Quiz page's row of live games under the title (Stay, 15
 * November 2026, 18:19Z: option 1a): each public game in its lobby or running,
 * as its quiz tile in a red Live ring with its title and how many play. The
 * row scrolls sideways when it fills, and is not there at all when nothing is
 * live. Joining with a code and creating a quiz are both on the title line's +
 * (`JoinOrCreateMenu`).
 *
 * A game by link is never listed (the server's list holds public games only),
 * and a finished game leaves the row on the next read: the list is read every
 * 20 seconds while the row is on screen, and again when a game it shows ends
 * (`liveGamesPage`, `useOpenQuizLive`). The games fade in when the list answers.
 */
export function LiveNowRow({ viewerId }: { viewerId: number | null }) {
  const live = useQuery(channelQuizQueries.liveGamesPage({ viewerId }));
  const games = live.data?.data.games ?? [];
  // Nothing live, or not read yet: no row, so nothing says "none" and nothing jumps.
  if (games.length === 0) return null;

  return (
    <section aria-labelledby="live-now" className="mb-4">
      <h2 id="live-now" className="sr-only">
        Live now
      </h2>
      <ul className="-mx-4 flex items-start gap-3 overflow-x-auto px-4 pt-1 pb-1">
        {games.map((game) => (
          <LiveGameCircle key={game.uuid} game={game} />
        ))}
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

/**
 * The title line's +: one button for Join and Create (Stay, 15 November 2026,
 * 17:52Z "can't they be the same button", and 18:19Z option 1a). It opens a
 * small menu: "Join with a code" opens the code sheet, "Create a quiz" the
 * quiz form.
 */
export function JoinOrCreateMenu({ onJoin, onCreate }: { onJoin: () => void; onCreate: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Join or create a quiz"
          title="Join or create"
          className={cn(
            'v2-interactive inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/70',
            FOCUS_RING,
          )}
        >
          <Plus aria-hidden className="size-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56 p-1.5">
        <DropdownMenuItem onSelect={onJoin} className="gap-3 rounded-lg px-3 py-2.5 text-sm">
          <Hash aria-hidden className="size-4 text-primary" />
          Join with a code
        </DropdownMenuItem>
        {/* "Create", not "New" (Arthur, 28 October 2026: "New quiz presupposes to play a new quiz"). */}
        <DropdownMenuItem onSelect={onCreate} className="gap-3 rounded-lg px-3 py-2.5 text-sm">
          <Plus aria-hidden className="size-4" />
          Create a quiz
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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

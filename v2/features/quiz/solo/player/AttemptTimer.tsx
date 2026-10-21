'use client';

import { useServerCountdown } from '@/v2/features/channels/quiz/game-clock';
import { PhaseRow } from '@/v2/features/channels/quiz/ui';
import { questionDeadlineMs } from '../model';

/**
 * AttemptTimer — the question's draining bar and the seconds left, on the
 * app's own clock.
 *
 * THE SAME BAR AS THE CHANNEL GAME, A DIFFERENT REFEREE. The live game draws
 * from server stamps and waits for the server at zero; a solo attempt has no
 * stamps on the wire (the server clamps `response_ms` and never refuses a
 * late answer), so the moment the question OPENED is the device's own wall
 * clock, read once in the handler that opened it, and the deadline is that
 * plus the limit. The game clock advances on `performance.now()` after one
 * wall read, so the bar cannot jump if the device's clock is corrected mid-
 * question. At zero it says "Time's up" and nothing more: the player locks
 * the grid on its own timeout, and this leaf only draws.
 *
 * A CLOCK LEAF, KEPT SMALL. It is the one subscriber to the five-a-second
 * tick on the play screen, so the tick never re-renders the option grid.
 */
export function AttemptTimer({
  openedAtMs,
  limitSeconds,
}: {
  /** `Date.now()` when the question opened, read in the handler. */
  openedAtMs: number;
  limitSeconds: number;
}) {
  const clock = useServerCountdown(
    new Date(questionDeadlineMs(openedAtMs, limitSeconds)).toISOString(),
    new Date(openedAtMs).toISOString(),
  );
  const fraction = clock.expired ? 0 : (clock.fraction ?? 1);

  return (
    <PhaseRow>
      <div
        aria-hidden
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full origin-left rounded-full bg-primary transition-transform duration-200 ease-linear motion-reduce:transition-none"
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>
      {clock.expired ? (
        <span className="shrink-0 text-sm text-muted-foreground">Time&rsquo;s up</span>
      ) : (
        <span
          role="timer"
          aria-live="off"
          className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground"
        >
          {clock.seconds}s
        </span>
      )}
    </PhaseRow>
  );
}

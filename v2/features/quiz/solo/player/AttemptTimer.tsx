'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { useServerCountdown } from '@/v2/features/channels/quiz/game-clock';
import { questionDeadlineMs } from '../model';

/**
 * AttemptTimer — the question's thin draining rail and the seconds left, on
 * the app's own clock; and {@link FrozenRail}, the same rail once the
 * question is over.
 *
 * THE SAME CLOCK AS THE CHANNEL GAME, A DIFFERENT REFEREE. The live game draws
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
 *
 * ONE RAIL, TWO MOODS (design B1): while the question is open the fill is
 * gold and the digits count down; after the answer the fill freezes grey
 * where the clock stopped and the digits say how long the answer took, so
 * the row never changes shape between the question and its reveal.
 */

const DIGITS =
  'w-11 shrink-0 text-right font-comfortaa text-[13px] font-bold tabular-nums text-muted-foreground';

export function ClockRail({
  fraction,
  frozen = false,
  children,
}: {
  /** How much of the time is left, 0–1. */
  fraction: number;
  frozen?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex h-5 items-center gap-3">
      <div
        aria-hidden
        className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--solo-track)]"
      >
        <div
          className={cn(
            'h-full origin-left rounded-full transition-transform duration-200 ease-linear motion-reduce:transition-none',
            frozen ? 'bg-muted-foreground/40' : 'bg-primary',
          )}
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>
      {children}
    </div>
  );
}

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
    <ClockRail fraction={fraction}>
      {clock.expired ? (
        <span className="shrink-0 text-[13px] font-semibold text-muted-foreground">
          Time&rsquo;s up
        </span>
      ) : (
        <span role="timer" aria-live="off" className={DIGITS}>
          {clock.seconds} s
        </span>
      )}
    </ClockRail>
  );
}

/** The rail after the answer: frozen where the clock stopped, with the time
 *  the answer took or the word for what happened instead. */
export function FrozenRail({ fraction, label }: { fraction: number; label: string }) {
  return (
    <ClockRail frozen fraction={Math.min(1, Math.max(0, fraction))}>
      <span className={DIGITS}>{label}</span>
    </ClockRail>
  );
}

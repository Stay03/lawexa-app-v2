'use client';

import { useSyncExternalStore } from 'react';

/**
 * game-clock — how a live game renders time without ever becoming its own
 * referee.
 *
 * THE CONTRACT (channel-quiz.md, "Timers"; api-digest §E): every phase
 * boundary is an ISO-8601 server timestamp with sub-second precision
 * (`countdown_ends_at`, `opens_at`, `ends_at`). Clients render countdowns FROM
 * those and, when one reaches zero, wait for the server — which may be ±1s
 * late. No client may advance a phase, close a question or score an answer.
 *
 * THE MODEL, IN THREE PARTS:
 *
 *  1. **A monotonic clock, not the wall clock.** The module keeps
 *     `now = wallOrigin + (performance.now() − perfOrigin)`: the wall clock is
 *     read ONCE, when the first subscriber arrives, and every advance after
 *     that comes from `performance.now()`, which cannot be dragged by an NTP
 *     correction, a timezone change or a user setting their clock mid-game.
 *     So a timer can never jump or run backwards while a question is open.
 *
 *  2. **The clock read happens in the STORE, never in render.** React Compiler
 *     lint (enforced as errors here) rightly rejects `Date.now()` in a render
 *     path; `useSyncExternalStore` is the sanctioned shape, exactly as
 *     `../use-minute-now.ts` does it for the feed's relative timestamps. One
 *     interval serves every subscriber and stops with the last of them.
 *
 *  3. **The remaining time is BOUNDED, never corrected.** There is no
 *     server-now on the wire (the HTTP `Date` header is not CORS-exposed), so
 *     the offset between this device's clock and the server's is simply
 *     unknown and nothing here can remove it. What it can do is stop that
 *     unknown from printing an absurd number, and there are two cases:
 *      - A phase with BOTH stamps (`opens_at`→`ends_at`, the countdown) has an
 *        exact duration, because both come from the same server clock. The
 *        reading is clamped to it, so a device running behind can never show
 *        more than the phase's real length.
 *      - A phase with only an END stamp (the gap between questions:
 *        `next_opens_at` and no published start) has no such duration, and the
 *        clamp above does NOT cover it. Those callers pass an explicit `capMs`
 *        instead — a bound, honestly labelled as one, not a correction.
 *     A device running ahead lands on zero either way, which is a designed
 *     waiting state and still fully answerable (the server decides whether an
 *     answer is in time; a late one is a quiet 409, never an error).
 *
 * Phase-5 W6, 2026-08-04.
 */

/** ~5 frames a second: smooth enough for a digit, cheap enough that only the
 *  small clock leaves subscribe to it. */
const TICK_MS = 200;

let wallOrigin = 0;
let perfOrigin = 0;
let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

/**
 * EVERY FIRE ADVANCES THE CLOCK. An earlier version skipped any fire that
 * landed less than a full tick after the last sample — which, against a
 * `setInterval` of exactly that period, threw away roughly every other frame
 * whenever the timer ran a hair early. The next sample then arrived 400ms
 * later, and the timer bar (whose transition is one tick long) finished its
 * interpolation and sat still: a visible stutter on the one element in this
 * feature built to move continuously.
 */
function tick(): void {
  now = wallOrigin + (performance.now() - perfOrigin);
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  if (listeners.size === 0) {
    // The one wall-clock read. Everything after it is monotonic.
    wallOrigin = Date.now();
    perfOrigin = performance.now();
    now = wallOrigin;
    timer = setInterval(tick, TICK_MS);
  }
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
      // BACK TO "NO CLOCK YET", which is what `getSnapshot` then reports until
      // the next subscriber re-anchors it. Leaving the last reading in place
      // would make a game reopened ten minutes later paint one frame from a
      // dead clock — "next question in 605s" — before the first tick corrected
      // it.
      now = 0;
    }
  };
}

function getSnapshot(): number {
  return now;
}

/** SSR and any frame with no clock running: "no clock yet". */
function getServerSnapshot(): number {
  return 0;
}

/** The monotonic epoch estimate in ms — `0` whenever no subscriber is holding
 *  the clock open (before the first one, and again after the last leaves). */
export function useGameClock(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** What a countdown needs to draw itself. */
export interface PhaseClock {
  /** Milliseconds left, never negative. */
  remainingMs: number;
  /** Whole seconds left, rounded UP so the last second reads "1", not "0". */
  seconds: number;
  /** The phase's full length in ms — `null` when its start is unknown. */
  totalMs: number | null;
  /** Remaining share `0..1` for a bar — `null` when the length is unknown. */
  fraction: number | null;
  /** The deadline has passed: the UI must WAIT (the server may be ±1s). */
  expired: boolean;
  /**
   * How far PAST the deadline this reading is, in ms — `0` until it passes.
   *
   * Not the same question as `expired`, and the difference is what lets a
   * screen be honest without being alarmist: the server is allowed to be a
   * second late, and since the recovery watchdog it deliberately waits five
   * before it acts. So a surface can stay quiet for the first beats and only
   * then say it is waiting (`CATCH_UP_AFTER_MS` in `./model.ts`).
   */
  overdueMs: number;
  /** No deadline at all — a reveal, a lobby, a finished game. */
  idle: boolean;
  /**
   * The clock is running and this reading is real. `false` on the SSR frame and
   * on the single client frame before the store's first subscriber starts it —
   * a consumer with no phase length to fall back on (the count-in dial) should
   * render its shape without a number for that frame rather than print a zero
   * it is about to contradict.
   */
  ready: boolean;
}

const IDLE_CLOCK: PhaseClock = {
  remainingMs: 0,
  seconds: 0,
  totalMs: null,
  fraction: null,
  expired: false,
  overdueMs: 0,
  idle: true,
  ready: false,
};

/**
 * Pure derivation — exported so the shaping can be reasoned about (and tested)
 * without a React tree. `nowMs === 0` means no clock is running, and the honest
 * paint for that frame is "full time, not expired": a frame showing 0:00 would
 * be a lie the very next tick corrects.
 *
 * `capMs` is the bound for a countdown with NO start stamp (see the module
 * docblock, part 3). It is ignored when the phase has a real duration, because
 * that duration is the better bound.
 */
export function phaseClock(
  deadlineIso: string | null | undefined,
  startIso: string | null | undefined,
  nowMs: number,
  capMs?: number,
): PhaseClock {
  if (!deadlineIso) return IDLE_CLOCK;
  const deadline = Date.parse(deadlineIso);
  if (!Number.isFinite(deadline)) return IDLE_CLOCK;

  const start = startIso ? Date.parse(startIso) : NaN;
  const totalMs =
    Number.isFinite(start) && deadline > start ? deadline - start : null;
  const ceiling = totalMs ?? (capMs !== undefined && capMs > 0 ? capMs : null);

  if (nowMs === 0) {
    return {
      remainingMs: totalMs ?? 0,
      seconds: totalMs ? Math.ceil(totalMs / 1000) : 0,
      totalMs,
      fraction: totalMs ? 1 : null,
      expired: false,
      overdueMs: 0,
      idle: false,
      ready: false,
    };
  }

  let remainingMs = deadline - nowMs;
  if (ceiling !== null) remainingMs = Math.min(remainingMs, ceiling);
  remainingMs = Math.max(0, remainingMs);

  return {
    remainingMs,
    seconds: Math.ceil(remainingMs / 1000),
    // The bar's denominator is the phase's REAL length or nothing — a cap is a
    // bound on a number, not a claim about how long the phase is, so it must
    // never become a progress fraction.
    totalMs,
    fraction: totalMs ? Math.min(1, remainingMs / totalMs) : null,
    expired: remainingMs <= 0,
    overdueMs: Math.max(0, nowMs - deadline),
    idle: false,
    ready: true,
  };
}

/**
 * Subscribe a clock leaf to one phase deadline. Keep the consumers SMALL — a
 * timer digit, a bar — so the five-a-second tick never re-renders an option
 * grid or a leaderboard.
 */
export function useServerCountdown(
  deadlineIso: string | null | undefined,
  startIso?: string | null,
  capMs?: number,
): PhaseClock {
  const nowMs = useGameClock();
  return phaseClock(deadlineIso, startIso, nowMs, capMs);
}

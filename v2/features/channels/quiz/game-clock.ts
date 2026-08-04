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
 *  3. **The remaining time is CLAMPED to the phase's own duration.** The
 *     duration `ends_at − opens_at` is computed from two stamps of the SAME
 *     server clock, so it is exact regardless of how far this device's clock is
 *     from the server's. Only the alignment between the two clocks is
 *     uncertain — there is no server-now on the wire (the HTTP `Date` header is
 *     not CORS-exposed) — so the clamp bounds that uncertainty: a device
 *     running behind can never show MORE than the question's real length, and
 *     one running ahead lands on zero, which is a designed "waiting for the
 *     server" state and still fully answerable (the server decides whether the
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

function tick(): void {
  const next = wallOrigin + (performance.now() - perfOrigin);
  if (next - now < TICK_MS) return;
  now = next;
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
    }
  };
}

function getSnapshot(): number {
  return now;
}

/** SSR and the frame before the first subscription: "no clock yet". */
function getServerSnapshot(): number {
  return 0;
}

/** The monotonic epoch estimate in ms — `0` before the clock is running. */
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
  idle: true,
  ready: false,
};

/**
 * Pure derivation — exported so the shaping can be reasoned about (and tested)
 * without a React tree. `nowMs === 0` means the clock has not started yet, and
 * the honest paint for that frame is "full time, not expired": a first frame
 * showing 0:00 would be a lie the very next tick corrects.
 */
export function phaseClock(
  deadlineIso: string | null | undefined,
  startIso: string | null | undefined,
  nowMs: number,
): PhaseClock {
  if (!deadlineIso) return IDLE_CLOCK;
  const deadline = Date.parse(deadlineIso);
  if (!Number.isFinite(deadline)) return IDLE_CLOCK;

  const start = startIso ? Date.parse(startIso) : NaN;
  const totalMs =
    Number.isFinite(start) && deadline > start ? deadline - start : null;

  if (nowMs === 0) {
    return {
      remainingMs: totalMs ?? 0,
      seconds: totalMs ? Math.ceil(totalMs / 1000) : 0,
      totalMs,
      fraction: totalMs ? 1 : null,
      expired: false,
      idle: false,
      ready: false,
    };
  }

  let remainingMs = deadline - nowMs;
  if (totalMs !== null) remainingMs = Math.min(remainingMs, totalMs);
  remainingMs = Math.max(0, remainingMs);

  return {
    remainingMs,
    seconds: Math.ceil(remainingMs / 1000),
    totalMs,
    fraction: totalMs ? Math.min(1, remainingMs / totalMs) : null,
    expired: remainingMs <= 0,
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
): PhaseClock {
  const nowMs = useGameClock();
  return phaseClock(deadlineIso, startIso, nowMs);
}

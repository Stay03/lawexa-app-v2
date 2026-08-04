'use client';

import { useSyncExternalStore } from 'react';

/**
 * use-minute-now — a shared minute-quantised clock for the feed's relative
 * timestamps ("3m", "2h" — design-research DIRECTION 3: relative in feed,
 * exact on hover). One module-level interval serves every subscriber, and the
 * snapshot only moves once a minute — so ONLY the tiny timestamp components
 * subscribe and re-render on the tick, while the memoised message rows around
 * them hold (the no-list-rerender discipline from the conversation screen).
 *
 * The interval starts with the first subscriber and stops with the last, so
 * an idle app schedules nothing. `Date.now()` is read inside the subscription
 * machinery, never in render (React Compiler lint) — the snapshot is a stored
 * number. Server snapshot is 0; the label helpers treat a zero clock as
 * "don't render a relative age yet", which matches SSR (the exact hover
 * timestamp and day headers carry the meaning until hydration).
 */

const MINUTE_MS = 60_000;

let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick(): void {
  const next = Date.now();
  // Quantise: only a whole-minute move notifies, so a subscriber burst
  // (mount storm) can't cause spurious re-renders.
  if (next - now < MINUTE_MS) return;
  now = next;
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  if (listeners.size === 0) {
    now = Date.now();
    timer = setInterval(tick, MINUTE_MS);
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

function getServerSnapshot(): number {
  return 0;
}

/** The current minute-quantised epoch (0 during SSR / before hydration). */
export function useMinuteNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

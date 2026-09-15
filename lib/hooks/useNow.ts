'use client';

import { useCallback, useSyncExternalStore } from 'react';

const listeners = new Map<number, Set<() => void>>();
const timers = new Map<number, ReturnType<typeof setInterval>>();
const snapshots = new Map<number, number>();

function tick(intervalMs: number) {
  snapshots.set(intervalMs, Date.now());
  for (const listener of listeners.get(intervalMs) ?? []) listener();
}

function subscribe(intervalMs: number, onStoreChange: () => void) {
  let set = listeners.get(intervalMs);
  if (!set) {
    set = new Set();
    listeners.set(intervalMs, set);
  }
  set.add(onStoreChange);

  if (!timers.has(intervalMs)) {
    timers.set(
      intervalMs,
      setInterval(() => tick(intervalMs), intervalMs)
    );
  }

  return () => {
    set.delete(onStoreChange);
    if (set.size > 0) return;
    clearInterval(timers.get(intervalMs));
    timers.delete(intervalMs);
    listeners.delete(intervalMs);
    snapshots.delete(intervalMs);
  };
}

/**
 * The wall clock, re-read every `intervalMs`, as a value a component may read
 * during render.
 *
 * `Date.now()` called in a render body is impure and the React Compiler lint
 * rejects it; a `useState` + `useEffect` ticker is setState-in-effect, which it
 * also rejects. An external store is the shape that is allowed to change
 * underneath a pure render.
 *
 * ZERO ON THE SERVER AND THROUGH HYDRATION, because there is no honest wall
 * clock for a prerendered page. Treat 0 as "no clock yet" and render whatever
 * does not need one.
 */
export function useNow(intervalMs: number): number {
  const subscribeAtInterval = useCallback(
    (onStoreChange: () => void) => subscribe(intervalMs, onStoreChange),
    [intervalMs]
  );

  return useSyncExternalStore(
    subscribeAtInterval,
    () => {
      const cached = snapshots.get(intervalMs);
      if (cached !== undefined) return cached;
      const now = Date.now();
      snapshots.set(intervalMs, now);
      return now;
    },
    () => 0
  );
}

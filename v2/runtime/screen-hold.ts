'use client';

import { useEffect, useId, useSyncExternalStore } from 'react';

/**
 * screen-hold — "the reader is in the middle of something", for surfaces that
 * must not cover the screen while it lasts.
 *
 * A screen holds while it is busy: a chat while an answer is being written
 * (ConversationScreen, every chat including a case's and a Space's), a quiz
 * while it is being played (PlayerScreen, AttemptPlayerScreen). A pop-up that
 * would sit over the page (the "Lawexa, redesigned" intro) waits until no
 * screen holds.
 *
 * One module-level set of holders, read through `useSyncExternalStore`, so the
 * holders and the readers need no shared provider and no setState in an
 * effect. The server snapshot is "nothing holds": the readers that care only
 * act after mounting anyway.
 */

const holders = new Set<string>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Adds or removes one holder. Exported for the tests; screens use the hook. */
export function setScreenHold(holder: string, holding: boolean): void {
  const had = holders.has(holder);
  if (holding === had) return;
  if (holding) holders.add(holder);
  else holders.delete(holder);
  notify();
}

/** Whether any screen holds now. */
export function screenHeld(): boolean {
  return holders.size > 0;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** This screen holds while `holding` is true, and lets go when it unmounts. */
export function useScreenHold(holding: boolean): void {
  const holder = useId();
  useEffect(() => {
    setScreenHold(holder, holding);
    return () => setScreenHold(holder, false);
  }, [holder, holding]);
}

/** `true` while any screen holds. */
export function useScreenHeld(): boolean {
  return useSyncExternalStore(subscribe, screenHeld, () => false);
}

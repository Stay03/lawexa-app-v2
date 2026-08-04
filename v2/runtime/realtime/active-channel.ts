import { useSyncExternalStore } from 'react';

/**
 * active-channel — the tiny external store that answers the dispatcher's one
 * visibility question: "is this event's channel the conversation the user has
 * OPEN right now?" (design-research.md DIRECTION 6: never notify the visible
 * conversation; plan W1 item 3). Document visibility is read separately at
 * decision time — this store only tracks WHICH channel screen is mounted.
 *
 * REGISTRATION SEAM (W2): the channel screen registers via its mark-read hook
 * (`v2/features/channels/mark-read.ts` calls register/unregister on mount).
 * Until W2 mounts a channel screen nothing registers, so the store answers
 * `null` and no suppression occurs — which is exactly right, because no
 * conversation is visible.
 *
 * Module-store shape per `v2/stream-style.ts` (primitive snapshot, so the
 * `useSyncExternalStore` return is referentially stable by construction). Not
 * `'use client'`; no `window` access at all.
 */

let activeChannelUuid: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** The channel screen announces itself. Last writer wins (route transitions
 *  overlap for a frame; the incoming screen is the truth). */
export function registerActiveChannel(channelUuid: string): void {
  if (activeChannelUuid === channelUuid) return;
  activeChannelUuid = channelUuid;
  notify();
}

/**
 * The channel screen retracts itself — uuid-checked so a stale unmount cleanup
 * (old screen unmounting AFTER the new one registered) can never clear the
 * newer registration.
 */
export function unregisterActiveChannel(channelUuid: string): void {
  if (activeChannelUuid !== channelUuid) return;
  activeChannelUuid = null;
  notify();
}

/** Read once, outside React — the dispatcher's per-event read path. */
export function getActiveChannelUuid(): string | null {
  return activeChannelUuid;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): string | null {
  return activeChannelUuid;
}

function getServerSnapshot(): null {
  return null;
}

/** Subscribe a component to the currently-open channel (header affordances). */
export function useActiveChannelUuid(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

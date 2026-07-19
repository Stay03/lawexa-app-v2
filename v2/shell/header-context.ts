import { useSyncExternalStore } from 'react';

/**
 * header-context — what the header's CENTRE slot shows on non-home routes
 * (owner #43, option A: the Chat | Work | Study tabs are scoped to the home;
 * every other route surfaces its context here instead — e.g. `/c/{id}`
 * publishes the conversation title + its confidential flag).
 *
 * A tiny module-level external store on the exact `home-tab.ts` idiom:
 * `useSyncExternalStore` with referentially-stable snapshots (the context
 * object is replaced only when a value actually changes, so subscribers never
 * loop), an SSR-safe server snapshot, and no `'use client'` directive — it
 * touches no browser API and is consumed only by client components.
 *
 * OWNERSHIP SEAM. Route features PUBLISH (`setHeaderContext` when their data
 * resolves, `clearHeaderContext` on unmount so the next route never inherits
 * stale context); `V2Header` CONSUMES via `useHeaderContext()`. Publisher and
 * consumer never touch each other's files — this module is the only shared
 * surface.
 */

export interface HeaderContext {
  /** Route title for the centre slot — null while unresolved (skeleton-first). */
  title: string | null;
  /** Confidential surface flag — drives the compact confidential badge. */
  confidential: boolean;
}

const EMPTY: HeaderContext = { title: null, confidential: false };

let context: HeaderContext = EMPTY;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): HeaderContext {
  return context;
}

function getServerSnapshot(): HeaderContext {
  return EMPTY;
}

/** Publish the active route's header context. Idempotent — equal values are a no-op. */
export function setHeaderContext(next: HeaderContext): void {
  if (next.title === context.title && next.confidential === context.confidential) {
    return;
  }
  context =
    next.title === null && !next.confidential ? EMPTY : { title: next.title, confidential: next.confidential };
  emit();
}

/** Reset to empty — call from the publisher's unmount cleanup. */
export function clearHeaderContext(): void {
  if (context === EMPTY) return;
  context = EMPTY;
  emit();
}

/** Subscribe the header to the published route context. */
export function useHeaderContext(): HeaderContext {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

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

/**
 * Who published the current context, when the publisher named itself (a
 * conversation id). A move-first tap publishes the destination's title while
 * the screen it came from is still mounted, and that screen then unmounts when
 * the destination commits: an owned clear lets the old screen's cleanup leave
 * the new title alone. Unnamed publishers keep the old rule (their clear always
 * clears).
 */
let owner: string | null = null;

/** The context paired with its owner, one stable object per change of either. */
export interface HeaderSnapshot {
  context: HeaderContext;
  owner: string | null;
}

const NO_OWNED: HeaderSnapshot = { context: EMPTY, owner: null };
let owned: HeaderSnapshot = NO_OWNED;

/** Re-pair `owned` after a write. `true` when it changed, so subscribers hear it. */
function syncOwned(): boolean {
  if (owned.context === context && owned.owner === owner) return false;
  owned = context === EMPTY && owner === null ? NO_OWNED : { context, owner };
  return true;
}

/**
 * Publish the active route's header context. Idempotent — equal values are a
 * no-op for subscribers. `publisher` names who owns it from now on, even when
 * the value is unchanged (a chat taking over the title its tap published).
 */
export function setHeaderContext(next: HeaderContext, publisher?: string): void {
  owner = publisher ?? null;
  if (next.title !== context.title || next.confidential !== context.confidential) {
    context =
      next.title === null && !next.confidential ? EMPTY : { title: next.title, confidential: next.confidential };
  }
  // An owner change alone still notifies, for `useHeaderContextFor`; the plain
  // hook's snapshot is unchanged then, so its readers do not re-render.
  if (syncOwned()) emit();
}

/**
 * Reset to empty — call from the publisher's unmount cleanup. With
 * `publisher`, only when it still owns the context.
 */
export function clearHeaderContext(publisher?: string): void {
  if (publisher !== undefined && publisher !== owner) return;
  owner = null;
  context = EMPTY;
  if (syncOwned()) emit();
}

/** The current context and its owner, to put back after a cancelled move. */
export function snapshotHeaderContext(): HeaderSnapshot {
  return { context, owner };
}

export function restoreHeaderContext(snapshot: HeaderSnapshot): void {
  setHeaderContext(snapshot.context, snapshot.owner ?? undefined);
}

/** Subscribe the header to the published route context. */
export function useHeaderContext(): HeaderContext {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function getOwnedSnapshot(): HeaderSnapshot {
  return owned;
}

function getServerOwnedSnapshot(): HeaderSnapshot {
  return NO_OWNED;
}

/**
 * The context only while `publisher` owns it, else the empty one. Pure, for
 * `node:test`; the breadcrumb's guard (see {@link useHeaderContextFor}).
 */
export function headerContextFor(snapshot: HeaderSnapshot, publisher: string): HeaderContext {
  return snapshot.owner === publisher ? snapshot.context : EMPTY;
}

/**
 * The context published FOR `publisher` (a conversation id), or the empty one.
 * The desktop breadcrumb reads a chat's title through this: a move-first tap
 * publishes the next chat's title while the address still names the last one,
 * and a plain link move paints the last chat's title for a frame on the next
 * address (checker, 16 October 2026). Guarded by owner the way
 * `screen-context.ts` guards by pathname.
 */
export function useHeaderContextFor(publisher: string): HeaderContext {
  const snapshot = useSyncExternalStore(subscribe, getOwnedSnapshot, getServerOwnedSnapshot);
  return headerContextFor(snapshot, publisher);
}

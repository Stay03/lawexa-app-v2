import { useSyncExternalStore } from 'react';

/**
 * header-place — the quiet second line under a route title in the header's
 * centre: the PLACE the thing on screen belongs to, as a link to it (Spaces
 * F3, 12 October 2026: a chat in a space shows the space's name under its
 * title, linking to the space).
 *
 * ── WHY A STORE OF ITS OWN, NOT A THIRD FIELD ON `header-context` ──────────
 * The title has several publishers with their own rules about who owns it and
 * when it may be cleared (a move-first tap publishes it before the screen
 * mounts, the screen takes it over, a cancelled tap puts the old one back).
 * The place has one publisher, the open chat, and is known only after its
 * record loads. Folding it into the title's context would make every one of
 * those title writes decide what to do with a place it knows nothing about,
 * and a tap from a list would wipe a place the chat was still showing. Kept
 * apart, the title's rules stay exactly as they were, and the place is
 * published and cleared by the one screen that knows it.
 *
 * Same idiom as `header-context.ts`: a module-level external store read
 * through `useSyncExternalStore`, referentially stable snapshots, an SSR-safe
 * empty server snapshot, an owner so an outgoing screen's clear cannot wipe
 * the incoming screen's place.
 */

export interface HeaderPlace {
  /** The place's name, shown under the title. */
  label: string;
  /** Where the line links to. */
  href: string;
}

let place: HeaderPlace | null = null;
let owner: string | null = null;

/** The place paired with its owner, one stable object per change of either. */
export interface OwnedHeaderPlace {
  place: HeaderPlace | null;
  owner: string | null;
}

const NO_OWNED: OwnedHeaderPlace = { place: null, owner: null };
let owned: OwnedHeaderPlace = NO_OWNED;

/** Re-pair `owned` after a write. `true` when it changed. */
function syncOwned(): boolean {
  if (owned.place === place && owned.owner === owner) return false;
  owned = place === null && owner === null ? NO_OWNED : { place, owner };
  return true;
}
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

function getSnapshot(): HeaderPlace | null {
  return place;
}

function getServerSnapshot(): HeaderPlace | null {
  return null;
}

/** Publish the place, owned by `publisher` (the chat's id). Equal values are a
 *  no-op for subscribers. */
export function setHeaderPlace(next: HeaderPlace, publisher: string): void {
  owner = publisher;
  if (!place || place.label !== next.label || place.href !== next.href) {
    place = { label: next.label, href: next.href };
  }
  // An owner change alone still notifies, for `useHeaderPlaceFor`; the plain
  // hook's snapshot is unchanged then, so its readers do not re-render.
  if (syncOwned()) emit();
}

/** Drop the place, only while `publisher` still owns it. */
export function clearHeaderPlace(publisher: string): void {
  if (publisher !== owner) return;
  owner = null;
  place = null;
  if (syncOwned()) emit();
}

/** Subscribe the header to the published place. */
export function useHeaderPlace(): HeaderPlace | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function getOwnedSnapshot(): OwnedHeaderPlace {
  return owned;
}

function getServerOwnedSnapshot(): OwnedHeaderPlace {
  return NO_OWNED;
}

/** The place only while `publisher` owns it. Pure, for `node:test`. */
export function headerPlaceFor(snapshot: OwnedHeaderPlace, publisher: string): HeaderPlace | null {
  return snapshot.owner === publisher ? snapshot.place : null;
}

/**
 * The place published FOR `publisher` (a conversation id), or `null`. The
 * desktop breadcrumb reads it so the last chat's space never names the next
 * chat for a frame (checker, 16 October 2026); same guard as
 * `useHeaderContextFor`.
 */
export function useHeaderPlaceFor(publisher: string): HeaderPlace | null {
  const snapshot = useSyncExternalStore(subscribe, getOwnedSnapshot, getServerOwnedSnapshot);
  return headerPlaceFor(snapshot, publisher);
}

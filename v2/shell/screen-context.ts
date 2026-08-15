import { useSyncExternalStore } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * screen-context — the two things about a pushed screen that its ADDRESS cannot
 * know, published by the screen and consumed by the bar.
 *
 * `pushed-route.ts` answers everything a pathname can answer, synchronously,
 * and that is deliberately most of it. This store carries only the remainder:
 *
 *  1. THE PARENT, when it is a fact about the data. `/folders/{uuid}` goes up
 *     to its PARENT FOLDER when it has one, and the parent's uuid arrives with
 *     the folder. `/notes/{slug}` goes back to My notes for a note the reader
 *     owns, because a draft appears on no other stream, and ownership is
 *     decided against the session id. Neither is in the URL.
 *
 *  2. THE SCREEN'S OWN ACTIONS, so a screen never grows a SECOND kebab in its
 *     body under a bar that already has one. `/folders/{uuid}` carried one at
 *     y124 and `/spaces/{uuid}` one at y183; both now fold into the bar's
 *     single overflow menu, which is where the owner's "at most three things in
 *     the bar: back, title, ONE action on the right" puts them.
 *
 * ── WHY THE ACTIONS ARE DATA AND NOT A `ReactNode` ─────────────────────────
 * A rendered menu handed through a module store has to be memoised whole or
 * every publish is a new snapshot and `useSyncExternalStore` loops (React
 * #185 — this codebase has been bitten by exactly that). A flat descriptor is
 * comparable field by field, so an equal set is a genuine no-op however the
 * publisher built it. It is the same shape `PlaceHeader`'s `HeaderLens`
 * already uses for the identical job (folding a screen's controls into one
 * menu on a phone), reused rather than re-invented.
 *
 * ── WHY EVERY SNAPSHOT CARRIES ITS PATHNAME ────────────────────────────────
 * The store is module-level and the publisher clears it on unmount, but a
 * route change can paint the new screen before the old one's cleanup has run.
 * A back address that outlived its screen by one frame would point the next
 * screen's chevron at the last one's parent; a stale ACTION would run the last
 * screen's Delete. So the snapshot names the address it describes and the
 * consumers use it only while that address still matches. A guard is cheaper
 * than a class of bug.
 *
 * Referentially-stable snapshots, an SSR-safe server snapshot, and no
 * `'use client'` directive: it touches no browser API and is consumed only by
 * client components. Same rules as `header-context.ts`.
 */

/** One row of a screen's own overflow menu. Plain data, always. */
export interface ScreenAction {
  /** Stable across renders — it is the React key and the equality anchor. */
  id: string;
  /** What the row says. It is the accessible name too; there is no icon-only
   *  variant of this control. */
  label: string;
  icon: LucideIcon;
  /** MUST be referentially stable, or every render republishes. */
  onSelect: () => void;
  /** Destructive verbs are styled as such and sit under a separator. */
  destructive?: boolean;
}

/** Overrides the route's default "up". Address and label always travel together. */
export interface ScreenBack {
  href: string;
  label: string;
}

export interface ScreenContext {
  /** The address this describes. See the docblock: consumers guard on it. */
  pathname: string;
  /** `null` keeps the route default from `pushed-route.ts`. */
  back: ScreenBack | null;
  /** Empty means the bar's menu shows only the app's own rows. */
  actions: readonly ScreenAction[];
}

const NO_ACTIONS: readonly ScreenAction[] = [];

let context: ScreenContext | null = null;
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

function getSnapshot(): ScreenContext | null {
  return context;
}

function getServerSnapshot(): ScreenContext | null {
  return null;
}

function sameBack(left: ScreenBack | null, right: ScreenBack | null): boolean {
  if (left === null || right === null) return left === right;
  return left.href === right.href && left.label === right.label;
}

function sameActions(
  left: readonly ScreenAction[],
  right: readonly ScreenAction[],
): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((action, index) => {
    const other = right[index];
    return (
      action.id === other.id &&
      action.label === other.label &&
      action.icon === other.icon &&
      action.onSelect === other.onSelect &&
      (action.destructive ?? false) === (other.destructive ?? false)
    );
  });
}

function isSame(left: ScreenContext, right: ScreenContext): boolean {
  return (
    left.pathname === right.pathname &&
    sameBack(left.back, right.back) &&
    sameActions(left.actions, right.actions)
  );
}

/** Publish this screen's context. Idempotent: an equal value is a no-op. */
export function setScreenContext(next: ScreenContext): void {
  if (context !== null && isSame(context, next)) return;
  context = next;
  emit();
}

/** Reset to nothing. Call from the publisher's unmount cleanup. */
export function clearScreenContext(): void {
  if (context === null) return;
  context = null;
  emit();
}

/**
 * The context published for `pathname`, or `null`. The pathname argument is
 * the guard described in the docblock: a snapshot for another address is
 * treated as absent rather than trusted.
 */
export function useScreenContext(pathname: string): ScreenContext | null {
  const published = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return published !== null && published.pathname === pathname ? published : null;
}

/** The screen's own menu rows for `pathname`, never `undefined`. */
export function useScreenActions(pathname: string): readonly ScreenAction[] {
  return useScreenContext(pathname)?.actions ?? NO_ACTIONS;
}

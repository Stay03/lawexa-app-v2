import { useSyncExternalStore } from 'react';

import type { SpaceType } from '@/types/collab';

/**
 * collab-header — what the shell header shows while the reader is inside a
 * space. The frame PUBLISHES; `V2Header` CONSUMES. Neither file reaches into
 * the other; this module is the only shared surface.
 *
 * ── WHY IT IS NOT `v2/shell/header-context.ts` ─────────────────────────────
 * That store carries a route TITLE — one string for the header's centre — and
 * every non-collab route still uses it untouched. A channel needs more than a
 * title: a back affordance, its space's crest, and the space name as a kicker
 * under the channel name. Widening the shared store would push a collab-shaped
 * payload onto `/cases/{slug}` and `/c/{id}`, which have no use for it, so the
 * collab context gets its own store on the identical idiom instead. Exactly one
 * of the two is rendered at a time (see `V2Header`), so they never compete.
 *
 * ── WHY THE OPENER IS IN THE SNAPSHOT ──────────────────────────────────────
 * The crest in the header opens the space drawer, and the drawer's open state
 * belongs to the frame (it is a `useUrlOverlay` param, so Back closes it). The
 * header is a SIBLING of the frame in the shell grid, not an ancestor or a
 * descendant, so no React context can reach from one to the other — the
 * callback rides the snapshot instead. It must be referentially stable
 * (`useUrlOverlay`'s dispatchers are), or every publish would be a new snapshot
 * and `useSyncExternalStore` would loop.
 *
 * Referentially-stable snapshots, an SSR-safe server snapshot, and no
 * `'use client'` directive — it touches no browser API and is consumed only by
 * client components. Same rules as `header-context.ts`.
 */

/**
 * The drawer is opened from outside itself (there is no `SheetTrigger`), so
 * Radix has no trigger to restore focus to on close — without help, focus lands
 * on `<body>` and keyboard and screen reader users lose their place.
 *
 * There are TWO openers because the header has to answer two different widths
 * with two different controls (see `CollabHeaderSlot`), and only one of them is
 * ever displayed. They therefore cannot share an id: duplicate ids are invalid,
 * and `getElementById` would hand back whichever came first in the document —
 * quite possibly the `display:none` one, whose `focus()` is a silent no-op.
 *
 * The ids live in this dependency-free module so the header can carry them and
 * the sheet can find them without either importing the other.
 */
export const SPACE_DRAWER_TRIGGER_IDS = [
  'v2-space-rail-trigger-compact',
  'v2-space-rail-trigger-wide',
] as const;

/**
 * Focus whichever opener this width is actually showing.
 *
 * `offsetParent === null` is the cheap, layout-accurate test for "hidden by a
 * `display:none` ancestor", which is exactly how the two variants are switched.
 * (It also reports null for `position: fixed`, which the header is not.) If
 * neither is on screen — the rail is docked, so no opener exists — focus is
 * left alone rather than thrown somewhere arbitrary.
 */
export function focusSpaceDrawerTrigger(): void {
  for (const id of SPACE_DRAWER_TRIGGER_IDS) {
    const element = document.getElementById(id);
    if (element !== null && element.offsetParent !== null) {
      element.focus();
      return;
    }
  }
}

export interface CollabHeaderContext {
  /**
   * `null` while a channel's space is still resolving. The crest then paints
   * its neutral, hue-less ground rather than guessing a colour it would have
   * to change a moment later.
   */
  spaceUuid: string | null;
  /** `null` until the space lands — the header shows its shimmer, not a guess. */
  spaceName: string | null;
  spaceType: SpaceType | null;
  /** `null` on a space route: there, the space name IS the title. */
  channelName: string | null;
  /** Where the mobile back chevron goes — the space, the spaces list, or (out
   *  of a thread) the parent channel it branched from. */
  backHref: string;
  /** The chevron's accessible name. It travels with `backHref`, because a glyph
   *  labelled "Back to the space" that leads to a channel is a lie told only to
   *  the readers who cannot see where it points. */
  backLabel: string;
  /** Opens the space drawer. MUST be referentially stable (see the docblock). */
  openRail: () => void;
}

/**
 * ── WHAT IS DELIBERATELY NOT IN THIS CONTEXT: WHO PAINTS THE PHONE BAR ──────
 *
 * A channel screen wears one bar below `md:` and the shell's stands down
 * (mobile overhaul, phase 3). That used to be a `barOwner` field here, set by
 * the frame to `'screen'` once its channel query landed and `'shell'` until
 * then.
 *
 * It was wrong twice over. A published value arrives after an effect, so the
 * first painted frame of a channel always showed the shell's bar; and it was
 * derived from DATA (`channelName !== null`), so it stayed wrong for the whole
 * fetch. The reader saw two stacked bars, then one, with the channel's name
 * moving between them — the owner's complaint of 15 August 2026: "double
 * skeleton, the title jumping from place to place".
 *
 * Which screen owns the bar is a fact about the ADDRESS, so `V2Header` reads it
 * off `usePathname()` (see `screenOwnsPhoneBar` there) and nothing publishes
 * it. Anything else in this context is genuinely late — a name, a crest — and
 * is drawn skeleton-first because of it. Bar OWNERSHIP never was.
 */

let context: CollabHeaderContext | null = null;
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

function getSnapshot(): CollabHeaderContext | null {
  return context;
}

function getServerSnapshot(): CollabHeaderContext | null {
  return null;
}

function isSame(
  left: CollabHeaderContext,
  right: CollabHeaderContext,
): boolean {
  return (
    left.spaceUuid === right.spaceUuid &&
    left.spaceName === right.spaceName &&
    left.spaceType === right.spaceType &&
    left.channelName === right.channelName &&
    left.backHref === right.backHref &&
    left.backLabel === right.backLabel &&
    left.openRail === right.openRail
  );
}

/** Publish the collab header context. Idempotent — equal values are a no-op. */
export function setCollabHeader(next: CollabHeaderContext): void {
  if (context !== null && isSame(context, next)) return;
  context = next;
  emit();
}

/** Reset to nothing — call from the publisher's unmount cleanup, so the header
 *  never keeps a space's crest on a route that has left the space. */
export function clearCollabHeader(): void {
  if (context === null) return;
  context = null;
  emit();
}

/** Subscribe the header to the collab context; `null` = not in a space. */
export function useCollabHeader(): CollabHeaderContext | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

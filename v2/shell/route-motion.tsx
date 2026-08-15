'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { V2_SHELL_CONTENT_ID } from './shell-content';

/**
 * RouteMotion: route changes MOVE rather than cut (mobile native overhaul,
 * phase 9).
 *
 * Every route change in v2 snapped. Tap a case, a channel, a space, a note, or
 * the chevron back out of one, and the screen was simply replaced between two
 * frames. On a phone that reads as a flash, not as going somewhere. This module
 * gives the shell's content region a short directional entrance on every
 * pathname change: forward comes in from the right, back comes in from the
 * left.
 *
 * It renders null. Like `DocumentLock`, `TouchPress`, `KeyboardInsetSync` and
 * `ScrollMemory` it is a behaviour mounted once by the v2 layout that reaches
 * the shell element by its id. The keyframes live in `shell.css`; this file
 * only decides WHEN a screen enters and from WHICH side.
 *
 * ── WHY NOT THE VIEW TRANSITIONS API ───────────────────────────────────────
 * Measured against this codebase rather than against a write-up, and rejected
 * on five separate counts, any one of which would have been enough:
 *
 *  1. IT IS NOT INSTALLED. React's `<ViewTransition>` ships only on the canary
 *     and experimental channels; this app is on stable `react@19.2.3`, whose
 *     export list has no `ViewTransition` in it (checked, not assumed). Next
 *     16.2's `experimental.viewTransition` flag does not wrap navigations: it
 *     swaps the WHOLE app's React for Next's bundled experimental build. v1 is
 *     the app real users are on today. Nothing in phase 9 is worth moving them
 *     onto an experimental React.
 *  2. BACK WOULD NOT ANIMATE, WHICH IS THE MOVE THAT MATTERS MOST HERE.
 *     Browser-initiated traversals carry no transition type, `router.back()`
 *     fires no exit animation (vercel/next.js#86881), and popstate runs no
 *     transition at all (#94369). Phase 5's back control IS `router.back()`,
 *     and Android's system back and iOS's edge swipe are both popstate. A
 *     transition that plays going in and cuts coming out is worse than a
 *     consistent cut.
 *  3. EVERY ROUTE HERE HAS A `loading.tsx`. When the destination suspends into
 *     a fallback, no old/new pair forms: the navigation animates the SKELETON,
 *     and the real content arrives in a second, separate transition that has
 *     already lost the transition type. The directional part would degrade to
 *     a cross-fade on exactly the slow navigations where direction helps most.
 *  4. THE SNAPSHOT LAYER PAINTS ABOVE EVERYTHING, including the shell's fixed
 *     header and dock, so both would need per-element `::view-transition-*`
 *     opt-outs to stop them cross-fading with themselves, and captured
 *     elements stop hit-testing for the length of the animation.
 *  5. THE INNER SCROLLER IS UNPROVEN GROUND. The pseudo-element tree is flat,
 *     so ancestor clipping is lost, and how a scrolling box should be captured
 *     is still an open CSSWG question (w3c/csswg-drafts#11079). This shell is
 *     one fixed grid with one scrolling region, which is not the layout the
 *     API's worked examples assume.
 *
 * A CSS animation on the region that already exists costs none of that, runs
 * on the compositor, and is three properties wide.
 *
 * ── WHY THE SHELL'S CONTENT REGION IS THE THING THAT MOVES ─────────────────
 * Because it is the screen, and because it is the only element that can move
 * without consequences. `.v2-shell` is `overflow: hidden`, so a translated
 * content region is clipped by the shell and cannot produce a sideways scroll
 * range. A wrapper INSIDE the scroller could not say that: a transformed
 * descendant adds to its scroller's scrollable overflow, so a 1rem slide would
 * hand the reader 1rem of horizontal scroll for the length of the animation, a
 * scrolling defect introduced by a motion patch, which is precisely what phase
 * 4 was about.
 *
 * NOTHING MOVES IN LAYOUT. `transform` and `opacity` are compositor
 * properties: no reflow, no layout shift, no change to `scrollTop`, and the
 * header and dock rows are untouched because they are separate grid items.
 *
 * NOTHING FIXED IS TRAPPED BY IT. A transform makes its element the containing
 * block for `position: fixed` descendants, so this would be a real hazard if
 * the content region held any. It holds none: every fixed layer in v2 (the
 * case chat sheet, the image viewer, the mention picker, the drawer) portals
 * to `body`, and `CaseMentionList` documents the transform hazard as the
 * reason it does. Route arrival is also the one moment at which no such layer
 * can be open, because the screen that owned it has just unmounted.
 *
 * ── WHY AN ATTRIBUTE THAT ALTERNATES ───────────────────────────────────────
 * A CSS animation only restarts when `animation-name` changes, and two
 * navigations in the same direction would otherwise reuse the same name and
 * play nothing the second time. The alternatives are worse: forcing a reflow
 * to re-trigger the class costs a synchronous layout at the busiest moment of
 * a navigation, and driving it from `element.animate()` would move the motion
 * out of the stylesheet and out of the `motion-safe:` vocabulary the rest of
 * the app is written in. So the attribute carries a parity (`forward-a`,
 * `forward-b`, `back-a`, `back-b`) and flipping it guarantees a fresh
 * animation on every navigation, including two in a row in the same direction
 * and including a second navigation that interrupts the first.
 *
 * ── REDUCED MOTION REMOVES THE TRAVEL, NOT THE APP ─────────────────────────
 * The rules in `shell.css` live inside `@media (prefers-reduced-motion:
 * no-preference)`, the same query `motion-safe:` compiles to. Under `reduce`
 * the rules and the keyframes simply do not exist, so the attribute this
 * module writes matches nothing and the screen changes exactly as it did
 * before phase 9. There is no second code path to keep in step.
 *
 * ── WHY THE ENTRANCE IS A LAYOUT EFFECT ────────────────────────────────────
 * `useEffect` runs AFTER the browser has painted. Writing the attribute there
 * would let the new screen paint once at its final position, and only then
 * throw it back to transparent and 1rem off: an entrance that begins with the
 * flash it exists to remove. A layout effect runs after the DOM mutation and
 * before that paint, so the first frame the reader ever sees is the animation's
 * first frame. The local isomorphic wrapper is the same one `ChannelComposer`,
 * `ChannelFeed` and `MessageList` each keep, for the same reason: React warns
 * about a layout effect during a server render.
 *
 * ── IT DOES NOT FIGHT ANYTHING NAVIGATION ALREADY OWNS ─────────────────────
 * It writes no history state, calls no `preventDefault`, intercepts no click
 * and never touches `scrollTop`. `useBackTo` still decides whether a chevron
 * pushes or goes back; `ScrollMemory` still owns restoration. This module only
 * observes, and only to learn which way the reader is going.
 *
 * AND IT REPORTS THE HISTORY MOVE, NOT THE BUTTON'S NAME. When `useBackTo`
 * cannot prove the parent is one entry behind (a reader who landed in a
 * channel from a notification, with nothing behind them) the chevron stays a
 * link and pushes, on purpose. The screen then enters from the right, because
 * that is what actually happened: a new entry, with the phone's own Back button
 * now pointing at this screen. Animating it as a back move would promise a
 * traversal that did not occur, which is the confusion phase 5 exists to
 * remove.
 *
 * ── AND IT ONLY FIRES ON REAL ROUTE CHANGES ────────────────────────────────
 * The effect keys on `usePathname()` alone. A URL overlay opening, a filter
 * being typed, a quiet param write: all of those change the query string and
 * none of them change the pathname, so none of them slide the screen. That is
 * the correct line, because a panel over a screen is not a change of screen.
 */

/** Which way the reader is going. */
type Direction = 'forward' | 'back';

/** Written on the shell content region; read by the rules in `shell.css`. */
const ENTER_ATTR = 'data-v2-route-enter';

/**
 * How long a `popstate` may claim the next route change as a back move, on the
 * engines that have no Navigation API to ask.
 *
 * A traversal that changes nothing but the query string, such as closing a URL
 * overlay, never reaches the effect, so an unconsumed mark must not colour the
 * next forward push. A click releases it first in almost every case; this is
 * the backstop for the rest. Next serves a traversal from its client router
 * cache, so the commit normally lands within a frame or two: half a second is
 * generous for that and short enough that no separate navigation can inherit
 * the mark.
 */
const POPSTATE_CLAIM_MS = 500;

/**
 * The direction the NEXT committed route change will use. One instance per
 * app, like the trail in `back-to.ts` and the active key in
 * `scroll-memory.tsx`: there is one tab, one history, and one shell.
 */
let pendingDirection: Direction = 'forward';

/** The slice of the Navigation API this module reads. Observation only:
 *  `intercept()` is never called, and nothing here writes history state. */
interface NavigationDestinationLike {
  readonly index: number;
}
interface NavigateEventLike extends Event {
  readonly hashChange?: boolean;
  readonly navigationType?: 'push' | 'replace' | 'traverse' | 'reload';
  readonly destination?: NavigationDestinationLike;
}
interface NavigationLike {
  readonly currentEntry: { readonly index: number } | null;
  addEventListener: (type: 'navigate', listener: (event: NavigateEventLike) => void) => void;
  removeEventListener: (type: 'navigate', listener: (event: NavigateEventLike) => void) => void;
}

function navigationApi(): NavigationLike | null {
  const candidate = (window as Window & { navigation?: NavigationLike }).navigation;
  if (!candidate || typeof candidate.addEventListener !== 'function') return null;
  return candidate;
}

/** Flip the parity so the animation name always changes, whatever the
 *  direction. `null` (nothing has entered yet) starts at `a`. */
function nextToken(previous: string | null, direction: Direction): string {
  return `${direction}-${previous?.endsWith('-a') ? 'b' : 'a'}`;
}

/** `useLayoutEffect` in the browser, `useEffect` on the server, because React
 *  warns that a layout effect does nothing during a server render. Kept local,
 *  like the copies in `ChannelComposer`, `ChannelFeed` and `MessageList`. */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function RouteMotion(): null {
  const pathname = usePathname();
  /** The pathname the last entrance was played for. `null` until the first
   *  render settles, which is what keeps a hard load from sliding: arriving by
   *  URL is not a move between screens. */
  const played = useRef<string | null>(null);

  // Learn the direction BEFORE the route commits. The Navigation API answers
  // exactly, because a traversal knows the index it is going to, so a lower one
  // is back and a higher one is forward. It is the same read-only surface
  // `useBackTo` already relies on (Baseline since January 2026).
  useEffect(() => {
    const navigation = navigationApi();
    let claim = 0;

    const onNavigate = (event: NavigateEventLike) => {
      if (event.hashChange) return; // an in-page jump is not a screen change
      // A `replace` is every quiet history write in the app: the scroll stamp,
      // the overlay's param edits, Next's own post-hydration init. None of them
      // is a reader going anywhere, so none of them may overwrite the direction
      // a real navigation has already recorded.
      if (event.navigationType === 'replace') return;
      if (event.navigationType === 'traverse') {
        const from = navigation?.currentEntry?.index ?? -1;
        const to = event.destination?.index ?? -1;
        pendingDirection = to >= 0 && from >= 0 && to < from ? 'back' : 'forward';
        return;
      }
      pendingDirection = 'forward';
    };

    const dropClaim = () => {
      window.clearTimeout(claim);
      claim = 0;
      pendingDirection = 'forward';
    };

    // Without the API, `popstate` is all there is. It cannot tell a Back from a
    // Forward, so both read as back. That is the honest degradation, because
    // Back is what a phone reader presses and Forward is what almost nobody
    // does, and it still matters: roughly a third of iPhones in the field run a
    // Safari older than the one that shipped the Navigation API.
    const onPopState = () => {
      pendingDirection = 'back';
      window.clearTimeout(claim);
      claim = window.setTimeout(dropClaim, POPSTATE_CLAIM_MS);
    };

    // A traversal that only closed a URL overlay never changes the pathname, so
    // its mark is never consumed. The next thing the reader does is the honest
    // release: a Back button and an edge swipe are not clicks, so a click while
    // a mark is outstanding can only be somebody going somewhere new. (The
    // phase-5 chevron is a click that then calls `router.back()`, which is the
    // opposite order: the mark is set after this fires, not cleared by it.)
    const onClick = () => {
      if (claim) dropClaim();
    };

    if (navigation) {
      navigation.addEventListener('navigate', onNavigate);
    } else {
      window.addEventListener('popstate', onPopState);
      document.addEventListener('click', onClick, { capture: true, passive: true });
    }
    return () => {
      window.clearTimeout(claim);
      if (navigation) {
        navigation.removeEventListener('navigate', onNavigate);
      } else {
        window.removeEventListener('popstate', onPopState);
        document.removeEventListener('click', onClick, true);
      }
    };
  }, []);

  // Play the entrance on the commit that put the new screen on the page, and
  // before it is painted. The pathname changes when the router commits the
  // destination: its content if the route was prefetched, its `loading.tsx` if
  // it was not, so the screen moves at the moment there is something to move
  // either way.
  useIsomorphicLayoutEffect(() => {
    if (played.current === pathname) return;
    const first = played.current === null;
    played.current = pathname;
    if (first) return;

    const region = document.getElementById(V2_SHELL_CONTENT_ID);
    if (!region) return;
    region.setAttribute(ENTER_ATTR, nextToken(region.getAttribute(ENTER_ATTR), pendingDirection));
    pendingDirection = 'forward';
  }, [pathname]);

  return null;
}

'use client';

import { useSyncExternalStore } from 'react';

/**
 * Does this browser keep the reader's place when content above them changes
 * height?
 *
 * ── WHY ANYTHING HAS TO ASK ────────────────────────────────────────────────
 * Both transcripts skip the render work for off-screen message groups with
 * `content-visibility: auto`, and give each one a GUESSED height
 * (`contain-intrinsic-size`) to stand in until it is really laid out. Every
 * time the browser swaps a guess for the real height above the viewport, the
 * content below it moves — and a reader scrolling up is exactly the person
 * standing below it.
 *
 * Chrome, Edge and Firefox absorb that silently: CSS scroll anchoring adjusts
 * the scroll position by the same amount, so nothing appears to move. It has
 * been quietly doing that work for this app since the feed was written; the
 * conversation list's own comment even says so out loud ("a height change costs
 * nothing, the browser's scroll anchoring absorbs it").
 *
 * SAFARI HAS NEVER IMPLEMENTED IT. Not on the iPhone, not on the Mac, not in
 * any version shipping today (WebKit bug 171099; it lands in Safari 27, due
 * around September 2026). So on every Apple device the guesses settle and the
 * page walks under the reader's thumb: "when scrolling up it looks very glitchy
 * and broken" and "load more moves the screen" — both reported by the same
 * person on an iPhone AND a MacBook, which is the tell.
 *
 * ── WHY THE TEST IS THIS ONE, AND NOT A BROWSER SNIFF ──────────────────────
 * `overflow-anchor` is not a proxy for Safari. It is the precise capability
 * whose absence causes the defect, so the optimisation is gated on the exact
 * thing that makes it safe. The day Safari 27 lands, those readers get the
 * optimisation back with no code change and no version list to maintain.
 *
 * ── FALSE ON THE SERVER, ON PURPOSE ────────────────────────────────────────
 * The server cannot know, so it renders the honest, heavier arrangement: every
 * group measured. A browser that supports anchoring turns the optimisation on
 * after hydration, which is a re-render, not a mismatch. The other way round
 * would paint Safari's first screenful with the guesses in place, which is the
 * frame the reader is most likely to be scrolling.
 */

/** A capability, not a state: nothing can change it while the tab is open, so
 *  there is nothing to subscribe to. */
const subscribe = () => () => {};

function hasScrollAnchoring(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports('overflow-anchor', 'auto');
}

export function useScrollAnchoring(): boolean {
  return useSyncExternalStore(subscribe, hasScrollAnchoring, () => false);
}

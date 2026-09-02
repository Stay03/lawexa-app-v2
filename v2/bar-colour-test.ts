'use client';

import { useSyncExternalStore } from 'react';

/**
 * A colour the owner can force onto the phone's status bar, by hand.
 *
 * ── WHY THIS EXISTS, AND IT IS A QUESTION NOT A FEATURE ───────────────────
 * On 2 September 2026 the bar stopped following the app's theme in the
 * INSTALLED app, and after a night of it we could not tell which of two things
 * was painting it, because both carry the same colour:
 *
 *   the installed app's own colour, fixed when it was installed, and
 *   the page's dark instruction, which asks the PHONE rather than the app.
 *
 * Seeing near-black tells you nothing, since both are near-black. Every
 * explanation offered that night picked one of the two and none could separate
 * them — the same fault as a check that returns the same answer whichever way
 * the truth falls.
 *
 * The owner proposed the way out himself: "if you can add a quick settings for
 * me to change the bar color when testing i think that will help too." He is
 * right, and it is better than the alternative on the table, which needed a
 * deploy and a reinstall for every colour tried.
 *
 * ── WHAT IT ANSWERS, IN ONE LOOK ──────────────────────────────────────────
 * Set an unmistakable colour, open the installed app, and look.
 *
 *   bar turns that colour  →  the app IS reading the page. Removing the two
 *                             device-conditional instructions should fix it.
 *   bar stays as it was    →  the app is NOT reading the page at all, and no
 *                             page-side change can ever move it. Then it holds
 *                             one colour, he picks it, and we say so plainly.
 *
 * Those two answers need opposite work, which is the whole reason not to guess.
 *
 * ── IT IS THE SAME CHANNEL AS THE BAR TUNING, ON PURPOSE ──────────────────
 * Written by the v1 developer panel, read by the v2 shell, over `localStorage`,
 * exactly like {@link ./bar-tuning}. That module explains the reasoning in full;
 * this one follows it rather than inventing a second way to do the same thing.
 *
 * Unset is the shipped behaviour, so an account that never touches it renders
 * precisely what everyone else gets.
 *
 * ── IT WRITES EXACTLY ONE SOURCE, AND THAT IS WHAT MAKES IT AN EXPERIMENT ──
 * This value reaches the PAGE'S OWN instruction and nothing else. The colour
 * fixed at install time is not touched by it, cannot be touched by it, and must
 * stay where it is while the test runs.
 *
 * That is not tidiness, it is the whole design. Two sources currently hold the
 * same near-black, so the only way to learn which one paints the bar is to move
 * ONE of them and watch. Move both and the result means nothing again, which is
 * the position we were already stuck in. If a future change makes this write the
 * install colour too, it stops being an experiment and becomes another
 * measurement that returns the same answer either way.
 */

export const BAR_COLOUR_TEST_KEY = 'lawexa-v2-bar-colour';

/** `storage` does not fire in the tab that wrote it, and that is the only tab
 *  that matters while somebody is trying colours. */
export const BAR_COLOUR_TEST_EVENT = 'lawexa-v2-bar-colour-change';

/** Six-digit hex only. The status bar attribute is read by things that are not
 *  the page's own stylesheet, and a value they cannot parse is discarded in
 *  silence — which would look exactly like the bug being investigated. */
const HEX = /^#[0-9a-fA-F]{6}$/;

function getSnapshot(): string | null {
  const raw = localStorage.getItem(BAR_COLOUR_TEST_KEY);
  return raw !== null && HEX.test(raw) ? raw : null;
}

/** No override on the server, because there is no browser to have stored one.
 *  Returning the same value every time keeps hydration quiet. */
function getServerSnapshot(): string | null {
  return null;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(BAR_COLOUR_TEST_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(BAR_COLOUR_TEST_EVENT, onChange);
  };
}

/** The forced colour, or `null` when the app should decide for itself. */
export function useBarColourTest(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Same value, read once, for code that is not a component. */
export function readBarColourTest(): string | null {
  if (typeof window === 'undefined') return null;
  return getSnapshot();
}

/** `null` clears it and hands the bar back to the app. An unparseable value is
 *  refused rather than stored, so the panel cannot leave the bar in a state
 *  nothing will paint. */
export function writeBarColourTest(next: string | null): void {
  if (typeof window === 'undefined') return;
  if (next === null) {
    localStorage.removeItem(BAR_COLOUR_TEST_KEY);
  } else {
    if (!HEX.test(next)) return;
    localStorage.setItem(BAR_COLOUR_TEST_KEY, next);
  }
  window.dispatchEvent(new Event(BAR_COLOUR_TEST_EVENT));
}

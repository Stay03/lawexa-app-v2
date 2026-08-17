'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

/**
 * Paints the phone's own status bar the same colour as the app underneath it.
 *
 * ── WHY (the owner, 17 August 2026) ────────────────────────────────────────
 * "can I change the colour of the os bar above the app area like how native
 * apps don't have them", with a photo of ChatGPT's Android app beside ours.
 * The difference in that photo is not decoration: their app runs its own
 * background right up under the clock, so there is no band, and the page looks
 * like it owns the whole screen. Ours drew a gold stripe across the top.
 *
 * ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
 * `viewport.themeColor` declared the brand gold `#C9A227` for light and
 * `#0a0a0a` for dark. The dark one was near enough; the light one was a brand
 * colour sitting above a WHITE page, which is exactly the band he photographed.
 *
 * ── AND WHY THE STATIC DECLARATION CANNOT FINISH THE JOB ───────────────────
 * Those two values are chosen by `prefers-color-scheme`, which is the PHONE's
 * setting. Our own theme switch is not the phone's setting. Somebody reading in
 * dark mode on a phone set to light would keep a white status bar over a black
 * page — the same mismatch, only worse for being deliberate.
 *
 * So the meta tag is kept in step with the theme actually being rendered. The
 * static values stay in the layout as the answer for the first paint, before
 * this has run; this only ever corrects them.
 *
 * ── THE BAR AT THE BOTTOM IS NOT OURS ──────────────────────────────────────
 * Android's gesture bar takes its colour from the system, and recent Chrome
 * lets the page background show through beneath it because the viewport is
 * `viewport-fit: cover`. There is no web API that paints it directly, so this
 * file does not pretend to. What it can do it does: the page's own background
 * reaches the bottom edge.
 */
export function SystemBarColour() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    /* The colour the app is ACTUALLY painting, read from the page rather than
       restated here. A second copy of the background colour is a second thing
       to forget when the palette moves. */
    const painted = getComputedStyle(document.body).backgroundColor;
    if (!painted || painted === 'rgba(0, 0, 0, 0)') return;

    /* The media-scoped tags from `viewport.themeColor` cannot be corrected —
       they answer to the phone, not to us — so they are left alone and one
       unscoped tag is kept alongside them. An unscoped `theme-color` wins over
       a media-scoped one that does not match, and loses to one that does, which
       is why this must be the only unscoped tag on the page. */
    let tag = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]:not([media])',
    );
    if (!tag) {
      tag = document.createElement('meta');
      tag.name = 'theme-color';
      document.head.appendChild(tag);
    }
    tag.content = painted;
  }, [resolvedTheme]);

  return null;
}

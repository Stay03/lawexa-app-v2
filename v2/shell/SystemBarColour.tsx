'use client';

import { useEffect } from 'react';

import { useBarColourTest } from '@/v2/bar-colour-test';

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
  /**
   * A colour forced by hand from developer settings, or `null` for normal
   * behaviour. It exists to answer one question the owner cannot otherwise
   * settle: whether the INSTALLED app reads this page at all, or paints its bar
   * from the colour fixed at install time. Both are the same near-black today,
   * so only an obviously different colour can tell them apart. See
   * `v2/bar-colour-test.ts`.
   */
  const forced = useBarColourTest();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    /**
     * Puts a colour on the page's own bar instruction, first in the head.
     *
     * Both callers need every part of this — finding or making the tag, moving
     * it to the front, setting it — so it is one function rather than two
     * copies that could drift. The reasoning for the position is below.
     */
    const write = (colour: string) => {
      /* The media-scoped tags from `viewport.themeColor` cannot be corrected —
         they answer to the phone, not to us — so they are left alone and one
         unscoped tag is kept alongside them. */
      let tag = document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]:not([media])',
      );
      if (!tag) {
        tag = document.createElement('meta');
        tag.name = 'theme-color';
      }
      /**
       * FIRST IN THE HEAD, NOT LAST. This was `appendChild` and that is why the
       * bar stopped following the theme — the owner reported it on 1 September
       * as "it used to switch and it stopped".
       *
       * The browser takes the FIRST `theme-color` whose `media` matches. The v2
       * layout declares one for light AND one for dark, so whatever the phone is
       * set to, one of them always matches and always sits earlier in the head
       * than a tag appended at the end. Our correction was being written
       * faithfully and then ignored, every time.
       *
       * An unscoped tag beating a NON-matching media one was the old reasoning.
       * True, and beside the point once BOTH schemes are declared: there is no
       * longer any such thing as a non-matching pair.
       *
       * `insertBefore` on a node already in place is a move, not a duplicate, so
       * repainting stays idempotent.
       */
      document.head.insertBefore(tag, document.head.firstChild);
      tag.content = colour;
    };

    const paint = () => {
      /* The override wins outright and skips every step below it. That is the
         point: the test is only meaningful if what reaches the bar is exactly
         what he typed, with nothing of ours in between it and the answer. */
      if (forced !== null) {
        write(forced);
        return;
      }

      /* The colour the app is ACTUALLY painting, read from the page rather than
         restated here. A second copy of the background is a second thing to
         forget when the palette moves. */
      const painted = getComputedStyle(document.body).backgroundColor;
      if (!painted || painted === 'rgba(0, 0, 0, 0)') return;

      /**
       * WRITE A HEX, NEVER WHAT `getComputedStyle` HANDED US.
       *
       * The palette is authored in `oklch()`. Chrome serialises a computed
       * colour in the space it was authored in, so this used to read
       * `lab(2.75381 0 0)` — measured in the live DOM on 2 September 2026 — and
       * that string went straight into the meta tag.
       *
       * A page stylesheet and a browser's system-UI painter are not the same
       * parser. The tag can sit first, hold the right colour, and still do
       * nothing if whatever reads it does not speak CSS Color 4. A hex is
       * understood by every consumer that has ever read this attribute, and it
       * costs one canvas assignment, so there is no reason to hand over
       * anything else.
       *
       * This is NOT confirmed as the cause of the owner's phone ignoring the
       * bar colour. It is a real defect found while looking for that, and it is
       * worth removing whether or not it turns out to be the one.
       */
      /* PAINT IT AND READ THE PIXEL BACK. Reading `fillStyle` is not enough and
         I measured why: canvas hands `lab()` and `oklch()` straight back
         unchanged, converting only `rgb()` and hex. It normalises the values
         that were already safe and preserves exactly the one that is not.
         Painting a single pixel and reading its bytes goes through the actual
         rasteriser, so any colour the browser can render comes back as three
         numbers whatever space it was written in. */
      let colour = painted;
      const ctx = document.createElement('canvas').getContext('2d', {
        willReadFrequently: true,
      });
      if (ctx) {
        /* Painted TWICE over different starting colours. An unparseable value
           leaves `fillStyle` untouched, and the rectangle is then painted in
           whatever colour was already set — so a single pass returns a
           confident black for a value the browser actually rejected. Measured:
           an invalid string came back `#000000`, indistinguishable from a real
           black. Two different starting colours cannot both be coincidence: if
           the two reads agree, the value was parsed. */
        const read = (fallback: string) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = fallback;
          ctx.fillStyle = painted;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
          return a > 0
            ? `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
            : null;
        };
        const first = read('#ff0000');
        if (first !== null && first === read('#00ff00')) colour = first;
      }

      write(colour);
    };

    /**
     * ── WATCHING THE CLASS, NOT THE HOOK ───────────────────────────────────
     * The first version ran off `resolvedTheme` and was ONE STEP BEHIND. The
     * owner caught it within the hour: "when I switch to dark mode the page
     * changes immediately but the top bar still remains white, when I change it
     * to white again the page changes to white but this time the bar shows
     * black."
     *
     * His second message is what identified it: "if I close the app and start
     * it again it starts with the proper combination". Correct on a fresh load,
     * wrong only on a switch, is the signature of reading too early rather than
     * reading the wrong thing. `next-themes` writes the class in its own
     * effect, and nothing orders that against mine — so on a switch I measured
     * the page before it had changed, and painted the bar the colour it was
     * leaving.
     *
     * So this no longer asks React when the theme changed. It watches the
     * element that actually carries the theme and paints when THAT changes,
     * whatever order the effects run in.
     */
    const observer = new MutationObserver(paint);
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
    paint();

    return () => observer.disconnect();
  }, [forced]);

  return null;
}

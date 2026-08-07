'use client';

import { useEffect } from 'react';

/**
 * Keyboard-inset sync for the overlay case (docs/v2-docs/foundation-standards.md §4).
 *
 * The shell height is `calc(100dvh - var(--keyboard-inset, 0px))`. When a browser
 * RESIZES the layout viewport for the on-screen keyboard, the ICB shrinks and
 * `dvh` already tracks the keyboard for free (Chrome 108+/Firefox 132+ honour our
 * `interactive-widget=resizes-content`; pre-108 Chrome resized by default). When a
 * browser OVERLAYS the keyboard instead — iOS Safari always, post-108 Chrome
 * without the meta, and any engine that ignores it (older WebView / older Samsung
 * Internet on budget phones like the Galaxy A21) — only the VISUAL viewport shrinks,
 * `dvh` stays full, and the dock/composer would sit BEHIND the keyboard. This hook
 * writes the occluded height into `--keyboard-inset` so the shell shrinks and the
 * composer rides above the keyboard.
 *
 * BEHAVIOUR MEASUREMENT, NOT CAPABILITY SNIFFING (owner keyboard-bug fix, verified
 * against MDN + the Chrome viewport-resize-behavior blog + bramus' explainer):
 *   - The occlusion formula `innerHeight − visualViewport.height − offsetTop` is
 *     SELF-CALIBRATING. In the RESIZE case `window.innerHeight` shrinks in lockstep
 *     with `visualViewport.height` (both reflect the resized layout viewport, and
 *     `offsetTop` is 0 since there is nothing to scroll past), so the formula yields
 *     ≈0 and we write 0 — no double-count with `dvh`. In the OVERLAY case only
 *     `visualViewport.height` shrinks while `innerHeight` holds, so the formula
 *     yields the true keyboard height and we write it. One formula, correct on every
 *     platform.
 *   - The previous `'virtualKeyboard' in navigator` early-return was WRONG: Chromium
 *     has exposed `navigator.virtualKeyboard` since v94, but merely HAVING the API
 *     does NOT mean the layout viewport resizes — that depends on honouring
 *     `interactive-widget=resizes-content` (v108+) OR the pre-108 default, neither
 *     of which the in-the-gap overlay browsers do. So the guard bailed on exactly
 *     the phones that overlay, stranding the composer behind the keyboard. Removing
 *     it lets the formula self-calibrate everywhere; no double-count is possible
 *     because the resize case reads ≈0 by construction.
 *   - No double-count edge from the VirtualKeyboard API's own `overlaysContent`
 *     mode: we never set `navigator.virtualKeyboard.overlaysContent = true`, so it
 *     stays the spec default `false` and the browser keeps resizing the visual
 *     viewport — exactly what this formula measures.
 *
 * ── AND IT PUTS THE PAGE BACK AFTERWARDS (Arthur, 2026-08-07) ──────────────
 * Measuring the keyboard is only half the job. iOS also SCROLLS THE DOCUMENT to
 * bring the focused field into view, and it does that even though the document
 * lock sets `overflow: hidden` on `html` and `body` — that declaration has never
 * reliably stopped iOS, which is the whole reason the "position: fixed body"
 * scroll-lock trick exists. While the keyboard is up that scroll is correct and
 * we must not fight it.
 *
 * The bug is that iOS does not always undo it. Dismiss the keyboard and the
 * document stays offset, so the shell — pinned to the viewport and unable to
 * scroll itself — is drawn with its top cut off: the header, its hamburger and
 * the brand mark all sitting above the visible area, with a scrollbar on a
 * document that is supposed to have none. The reader cannot scroll it back
 * either, because `overflow: hidden` blocks THEM even though it did not block
 * the browser.
 *
 * Reported and photographed by @arthur on an iPhone, 2026-08-07: correct on
 * first load, clipped after opening and closing the keyboard once. It is also
 * the most likely half of the owner's older "the header disappears sometimes",
 * which had resisted diagnosis because nobody connects it to the keyboard.
 *
 * So: whenever the occlusion reads zero — the keyboard is gone — any leftover
 * document scroll is by definition not the reader's and is put back to zero.
 * The reset is deliberately NOT run while the keyboard is up.
 *
 * No `setState` — it only writes a CSS custom property on the document element
 * (React Compiler lint: an effect with listeners + cleanup and no render-phase
 * state is fine). Runs once (empty deps); cleans up its listeners and the
 * property on unmount.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    // SSR / non-DOM guard.
    if (typeof window === 'undefined') return;

    const viewport = window.visualViewport;
    // No visualViewport → nothing to measure. (No capability sniffing beyond this:
    // the occlusion formula below self-calibrates to whatever the browser does with
    // the keyboard — see the BEHAVIOUR MEASUREMENT note above.)
    if (!viewport) return;

    const root = document.documentElement;

    /**
     * Undo a document scroll the browser performed and did not put back.
     *
     * Only ever called with the keyboard gone, so a non-zero offset here cannot
     * be a reader's scroll: the document is locked and they have no way to make
     * one. Both spellings are reset because the scrolling element differs by
     * engine, and both are cheap no-ops when already zero.
     */
    const restoreDocumentScroll = (): void => {
      const scroller = document.scrollingElement;
      if (scroller && scroller.scrollTop !== 0) scroller.scrollTop = 0;
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };

    const update = (): void => {
      // Height occluded at the bottom of the layout viewport (keyboard + any
      // accessory bar). Reads ≈0 when the browser resized the layout viewport
      // (innerHeight shrank in lockstep) and the true keyboard height when it
      // overlaid. Clamp ≥ 0 — rubber-band scrolling can transiently make the raw
      // value negative.
      const occlusion = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      root.style.setProperty('--keyboard-inset', `${occlusion}px`);
      if (occlusion === 0) restoreDocumentScroll();
    };

    /**
     * iOS restores (or fails to restore) its scroll AFTER the blur settles, so a
     * reset fired synchronously on `focusout` lands too early and is overwritten.
     * One frame later is enough, and the occlusion is re-read at that point so a
     * blur that merely moves focus to the NEXT field — keyboard still up — does
     * nothing.
     */
    const onFocusOut = (): void => {
      requestAnimationFrame(update);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    document.addEventListener('focusout', onFocusOut);

    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      document.removeEventListener('focusout', onFocusOut);
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);
}

/**
 * Renders nothing — a mount point for {@link useKeyboardInset}. Dropped into the
 * v2 layout so the keyboard-inset sync is live for the whole v2 tree without
 * turning the server layout into a client component.
 */
export function KeyboardInsetSync(): null {
  useKeyboardInset();
  return null;
}

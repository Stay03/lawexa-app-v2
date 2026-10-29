'use client';

import { useEffect } from 'react';
import { restoreDocumentScroll } from './document-scroll';

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
 * Zero occlusion is only a PROXY for "keyboard gone" and it has one hole, so the
 * viewport path also requires the visual viewport to be unpanned; see `settled`.
 *
 * No `setState` — it only writes a CSS custom property on the document element
 * (React Compiler lint: an effect with listeners + cleanup and no render-phase
 * state is fine). Runs once (empty deps); cleans up its listeners and the
 * property on unmount.
 */
export function useKeyboardInset(): void {
  useEffect(() => syncKeyboardInset(), []);
}

/**
 * The hook's work: measure now, keep measuring on every viewport and window
 * event, and return the cleanup. A plain function so a test can run it against
 * a fake window and step through the order iOS sends its events in.
 */
export function syncKeyboardInset(): () => void {
  // SSR / non-DOM guard.
  if (typeof window === 'undefined') return () => undefined;

  const viewport = window.visualViewport;
  // No visualViewport → nothing to measure. (No capability sniffing beyond this:
  // the occlusion formula below self-calibrates to whatever the browser does with
  // the keyboard — see the BEHAVIOUR MEASUREMENT note above.)
  if (!viewport) return () => undefined;

  const root = document.documentElement;

  /**
   * Has the viewport actually come to rest, or is it panned under a keyboard?
   *
   * ZERO OCCLUSION IS A PROXY FOR "KEYBOARD GONE", AND THE PROXY HAS A HOLE.
   * With the document locked, iOS reveals a focused field by panning the
   * VISUAL viewport inside the layout viewport, which grows `offsetTop`. At
   * full pan `offsetTop` reaches `innerHeight - viewport.height`, so the
   * occlusion arithmetic crosses exactly zero WHILE THE KEYBOARD IS STILL UP.
   * Restoring the scroll at that moment would yank the field the reader is
   * typing in out from under them.
   *
   * Found by an adversarial review of this file on 2026-08-08, hours after it
   * shipped. The window is narrow — it also needs iOS to have left a layout
   * scroll to undo — but "narrow" is not "impossible", and the cost of being
   * wrong is losing your place mid-sentence.
   *
   * ── THE FIRST GUARD WAS A PROXY, AND THE PROXY BROKE THE FIX ────────────
   * That review's hazard was first closed by asking whether anything was
   * FOCUSED. It is the wrong question, and @arthur found out the hard way the
   * same day: edit a message, dismiss the keyboard with Done, and iOS keeps
   * the field focused. Zero occlusion, focus still in a text box, so the
   * restore never ran and the screen stayed shoved up — the exact bug this
   * whole file exists to fix, reintroduced by its own guard. The docblock
   * below already said Done does not reliably blur; I wrote that and then
   * relied on blur anyway one function up.
   *
   * `offsetTop` is the thing itself rather than a proxy for it. A panned
   * visual viewport has a non-zero `offsetTop`; a keyboard that has gone has
   * `offsetTop === 0`, focused field or not. So the hazard stays closed and
   * the fix stays working, and neither depends on where the caret is.
   */
  const settled = (): boolean => viewport.offsetTop === 0;

  /**
   * The tallest the visible viewport has been at this width: the screen
   * with no keyboard. Reset when the width changes, which is a rotation.
   */
  let fullHeight = viewport.height;
  let fullWidth = viewport.width;

  /**
   * The visible rectangle, for a screen fixed to it (the phone case chat).
   *
   * THE TOP IS CLAMPED TO WHERE A VISIBLE RECTANGLE CAN BE. While the
   * keyboard is up, iOS pans the page and `offsetTop` says by how much; the
   * screen must follow it. The pan can never be more than the keyboard
   * takes, `fullHeight - height`, so with the keyboard down the top is 0.
   * iOS breaks that when the keyboard goes down: the resize reports the full
   * height while `offsetTop` still holds the keyboard's pan, and no later
   * event corrects it. Published raw, that stale pan pushed the full-screen
   * chat down the screen with the page's own bar above it (Arthur's iPhone,
   * after 16b19dd).
   *
   * THE LIMIT IS NOT `innerHeight`. That was the first version (6023bb9),
   * and in the iPhone home-screen app `innerHeight` shrinks with the
   * keyboard, so the limit read 0 while iOS had panned the page: the
   * full-height chat sat a keyboard's height above the screen, and only its
   * composer showed, at the top (Arthur's IMG_4108, 12 October 2026). The
   * tallest visible height at this width does not move with the keyboard in
   * either mode, so it is the limit in both.
   *
   * It is also read on `focusin`. The reader's tap on the chat's box is a
   * focus, so the card's first frame is sized from the viewport as it is at
   * the tap, never from whatever a keyboard before it left behind.
   */
  const publishVisible = (): void => {
    if (viewport.width !== fullWidth) {
      fullWidth = viewport.width;
      fullHeight = viewport.height;
    }
    fullHeight = Math.max(fullHeight, viewport.height);
    const top = visibleTop(viewport.offsetTop, viewport.height, fullHeight);
    root.style.setProperty('--visual-height', `${viewport.height}px`);
    root.style.setProperty('--visual-top', `${top}px`);
  };

  const update = (): void => {
    // Height occluded at the bottom of the layout viewport (keyboard + any
    // accessory bar). Reads ≈0 when the browser resized the layout viewport
    // (innerHeight shrank in lockstep) and the true keyboard height when it
    // overlaid. Clamp ≥ 0 — rubber-band scrolling can transiently make the raw
    // value negative.
    const occlusion = keyboardOcclusion(window.innerHeight, viewport.height, viewport.offsetTop);
    root.style.setProperty('--keyboard-inset', `${occlusion}px`);
    // The visible viewport (11 October 2026): its height caps a screen
    // riding the keyboard, so nothing sized from it can grow past the top,
    // and its offset says how far iOS has panned the page under the keyboard.
    publishVisible();
    // Zero occlusion AND an unpanned visual viewport. The second term is what
    // separates "the keyboard has gone" from "the keyboard is up and the pan
    // has run to the bottom" — see `settled`.
    if (occlusion === 0 && settled()) restoreDocumentScroll();
  };

  /**
   * The blur path — a second chance, for the engines that settle late.
   *
   * iOS settles its scroll AFTER the blur, so a reset fired synchronously on
   * `focusout` lands too early and is overwritten. One frame later is enough.
   *
   * It does not take the `settled` check, and that asymmetry is deliberate: a
   * blur means the keyboard is on its way out, so a pan still in progress is
   * a transient to be undone rather than a state to respect. The occlusion
   * re-read is the gate that matters here — a blur that merely moves focus to
   * the NEXT field still measures a keyboard, and does nothing.
   */
  const onFocusOut = (): void => {
    requestAnimationFrame(() => {
      const occlusion = keyboardOcclusion(window.innerHeight, viewport.height, viewport.offsetTop);
      root.style.setProperty('--keyboard-inset', `${occlusion}px`);
      publishVisible();
      if (occlusion === 0) restoreDocumentScroll();
    });
  };

  // THE WINDOW'S OWN RESIZE TOO, NOT ONLY THE VISUAL VIEWPORT'S. The formula
  // reads ≈0 in a resizing browser only if `innerHeight` has already shrunk
  // when it is read. Chrome and Edge on iPhone resize the page for the
  // keyboard, and they can report the visual viewport's new height while
  // `innerHeight` still holds the old one: the inset read the keyboard's
  // height, and since nothing on the visual viewport changed again, it stayed.
  // The shell, `100dvh` minus that inset, then shrank to its content
  // region's padding, and iOS clips the fixed phone case chat, a DOM child of
  // that region, to its box: a black chat with the keyboard up, from the
  // second open on (Arthur's recordings 3 and 5, 16 and 17 October 2026:
  // content h 56 on every black frame, h 337 on every drawn one). The
  // window's resize comes when `innerHeight` changes, so the inset is read
  // again from numbers that agree.
  update();
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  document.addEventListener('focusout', onFocusOut);
  document.addEventListener('focusin', publishVisible);

  return () => {
    viewport.removeEventListener('resize', update);
    viewport.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
    document.removeEventListener('focusout', onFocusOut);
    document.removeEventListener('focusin', publishVisible);
    root.style.removeProperty('--keyboard-inset');
    root.style.removeProperty('--visual-height');
    root.style.removeProperty('--visual-top');
  };
}

/**
 * How much of the layout viewport's bottom the keyboard covers: the space
 * between the visible rectangle's bottom (`offsetTop + height`) and the
 * layout viewport's bottom (`innerHeight`). About 0 in a browser that resizes
 * the page for the keyboard, the keyboard's height in one that overlays it
 * (Safari), and never below 0 (rubber-band scrolling can make the raw value
 * negative). Pure, so the task sheet's keyboard numbers can be pinned in a
 * test (Arthur, 29 October 2026, 21:13Z, thread 7aa0c6d8).
 */
export function keyboardOcclusion(innerHeight: number, height: number, offsetTop: number): number {
  return Math.max(0, innerHeight - height - offsetTop);
}

/**
 * Where the visible rectangle's top sits on the layout viewport: iOS's pan
 * while the keyboard is up, 0 once the visible height is back to full. Pure,
 * so both of iOS's `innerHeight` behaviours can be pinned in a test.
 */
export function visibleTop(offsetTop: number, height: number, fullHeight: number): number {
  return Math.max(0, Math.min(offsetTop, fullHeight - height));
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

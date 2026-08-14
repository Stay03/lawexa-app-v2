'use client';

import { useEffect } from 'react';

/**
 * TouchPress — every tappable thing in v2 answers a finger, from one listener.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Measured on 2026-08-14 across all 591 files under `v2/` and `app/v2/`: of 729
 * tappable sites, 15 had a press state, 72 inherited a focus flash from a Radix
 * menu item, 9 were switches, and 633 (86.8%) did nothing at all when pressed.
 * 464 of those 633 have a `hover:` style, which Tailwind 4 compiles inside
 * `@media (hover: hover)` — so on a phone they are not weakly styled, they are
 * unstyled. Owner, on the mobile overhaul: the app must feel native, and a
 * control that does not answer a finger is the first thing that gives a web app
 * away.
 *
 * `.v2-interactive`, on 135 files, made this worse rather than better: it sets
 * `-webkit-tap-highlight-color: transparent`, which REMOVES the grey flash the
 * browser would have drawn, and the replacement press states its own comment
 * promises were never written for 633 sites.
 *
 * ── WHY A CONTROLLER AND NOT A CSS `:active` RULE ──────────────────────────
 * `:active` matches the pressed element AND EVERY ANCESTOR. A message row holds
 * up to fifteen nested tappables, so one rule would dim the button and the row
 * under it together. This marks the CLOSEST interactive ancestor and nothing
 * above it, which is the behaviour both platforms have and CSS cannot express.
 *
 * Two more things CSS could not do here. iOS emulates mouse events so fast that
 * "the down or active pseudo state of buttons may never occur" (Apple's Safari
 * Web Content Guide), which is why `:active` on iOS has always needed a touch
 * listener to exist at all. And a press must not appear while the reader is
 * SCROLLING, which needs a timer and a cancel, not a selector.
 *
 * ── THE NUMBERS ARE THE PLATFORMS', NOT OURS ───────────────────────────────
 * Android delays the pressed state by `TAP_TIMEOUT` (100ms) when the view is
 * inside a scrolling container and shows it immediately when it is not
 * (`ViewConfiguration.java`, applied by `View.java`'s `isInScrollingContainer`
 * check); iOS does the same thing through `UIScrollView.delaysContentTouches`,
 * whose interval Apple does not publish. Once shown, Android holds it for
 * `PRESSED_STATE_DURATION` (64ms) so a fast tap is still seen. A drag past
 * `TOUCH_SLOP` (8dp) cancels. Material Web's ripple uses the same shape with a
 * 150ms touch delay and a 225ms minimum; Ionic uses 200/200 and is criticised
 * for feeling slow, which is why we take Android's 100ms rather than theirs.
 *
 * The release is eased and the press is not: SwiftUI's default button drops its
 * label to about 0.2 opacity INSTANTLY and fades back with an animation. Our
 * fifteen existing press states all sit on elements with `transition-colors`,
 * so they ease IN over 150ms, which is the opposite grammar. The rule in
 * `shell.css` fixes that for every host this marks.
 *
 * ── WHAT IT DOES NOT DO ────────────────────────────────────────────────────
 * No ripple: that is Android's grammar and this app has one look on both
 * platforms. No haptics: there is no press-weight haptic on the web and
 * `navigator.vibrate` is not one. No scale in the shared rule: a scale change
 * is motion animation under WCAG 2.3.3 and would have to be taken away again
 * for anyone who asks for less motion, while an opacity change is explicitly
 * not motion and stays on for everyone.
 */

/** What counts as a thing you press. Roles are included because Radix renders
 *  its items as `div[role="menuitem"]`, and `TabRow` renders plain
 *  `button[role="tab"]`, so an element-only list would miss both. */
const INTERACTIVE = [
  'button',
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="menuitemcheckbox"]',
  '[role="option"]',
  'a[href]',
  'summary',
].join(',');

/** Opt out, for the few places a press mark is wrong: a drag grip that stays
 *  down for the whole drag is the one in the tree today. Honoured on the
 *  element or any ancestor, so a subtree can be excluded at its root. */
const OPT_OUT = '[data-press="none"]';

/** Controls whose OWN change of state is the feedback. Radix renders a switch
 *  and a checkbox as `button[role="switch"]` / `button[role="checkbox"]`, so
 *  they land in the set above by accident; dimming the track while the thumb is
 *  already travelling reads as two answers to one press. */
const SELF_ANSWERING = '[role="switch"],[role="checkbox"],[role="radio"]';

/** AOSP `ViewConfiguration.TAP_TIMEOUT` — how long Android waits, inside a
 *  scrolling container, to see whether a touch is a tap or the start of a
 *  scroll. */
const SCROLL_WAIT_MS = 100;

/** AOSP `ViewConfiguration.PRESSED_STATE_DURATION` — the floor that keeps a
 *  fast tap visible instead of flashing past the eye. */
const MIN_VISIBLE_MS = 64;

/** AOSP `ViewConfiguration.TOUCH_SLOP`, in CSS pixels. Past this the finger is
 *  scrolling, not pressing. */
const SLOP_PX = 8;

/** Is this element inside something that scrolls? Android asks exactly this
 *  question to decide between an instant press and a delayed one. Walks up from
 *  the element, so the answer accounts for an inner list as well as the shell's
 *  own scroller. */
function insideScroller(element: Element): boolean {
  let node: Element | null = element;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    const scrollsY =
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight;
    const scrollsX =
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      node.scrollWidth > node.clientWidth;
    if (scrollsY || scrollsX) return true;
    node = node.parentElement;
  }
  return false;
}

export function TouchPress(): null {
  useEffect(() => {
    /** The element currently marked, or armed to be marked. */
    let host: HTMLElement | null = null;
    let arm: ReturnType<typeof setTimeout> | null = null;
    let release: ReturnType<typeof setTimeout> | null = null;
    let shownAt = 0;
    let startX = 0;
    let startY = 0;
    let activeId = -1;

    const show = () => {
      if (!host) return;
      arm = null;
      // `data-press-host` is permanent: it is what opts the element into the
      // transition, and re-adding it on every press would restart nothing.
      host.setAttribute('data-press-host', '');
      host.setAttribute('data-pressed', '');
      shownAt = performance.now();
    };

    const clear = () => {
      if (arm) {
        clearTimeout(arm);
        arm = null;
      }
      const marked = host;
      host = null;
      activeId = -1;
      if (!marked || !marked.hasAttribute('data-pressed')) return;
      // Hold the mark to the platform floor, so a tap short enough to beat the
      // eye is still seen. Measured from when it was SHOWN, not from touch
      // down, because the scroll guard may have delayed it.
      const seen = performance.now() - shownAt;
      const left = MIN_VISIBLE_MS - seen;
      if (left <= 0) {
        marked.removeAttribute('data-pressed');
        return;
      }
      if (release) clearTimeout(release);
      release = setTimeout(() => {
        marked.removeAttribute('data-pressed');
        release = null;
      }, left);
    };

    const onDown = (event: PointerEvent) => {
      // A second finger during a press is a gesture, not a press.
      if (host) clear();
      if (!event.isPrimary) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const found = target.closest<HTMLElement>(INTERACTIVE);
      if (!found) return;
      if (found.closest(OPT_OUT)) return;
      if (found.matches(SELF_ANSWERING)) return;
      if (found.hasAttribute('disabled') || found.getAttribute('aria-disabled') === 'true') return;

      host = found;
      activeId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;

      // A mouse cannot start a scroll with a click, so it never waits. A finger
      // waits only where a scroll is possible, which is Android's rule exactly.
      if (event.pointerType === 'mouse' || !insideScroller(found)) {
        show();
        return;
      }
      arm = setTimeout(show, SCROLL_WAIT_MS);
    };

    const onMove = (event: PointerEvent) => {
      if (!host || event.pointerId !== activeId) return;
      if (
        Math.abs(event.clientX - startX) > SLOP_PX ||
        Math.abs(event.clientY - startY) > SLOP_PX
      ) {
        clear();
      }
    };

    const onUp = (event: PointerEvent) => {
      if (!host || event.pointerId !== activeId) return;
      // A tap that finished before the scroll guard elapsed is still a tap, and
      // it must be answered: show the press now and let the floor above hold it
      // long enough to be seen. Material Web's ripple makes the same promise.
      if (arm) show();
      clear();
    };

    // The browser fires `pointercancel` the moment it takes the gesture over
    // for a scroll or a zoom, which is the signal that this was never a press.
    const onCancel = () => clear();

    document.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    document.addEventListener('pointermove', onMove, { capture: true, passive: true });
    document.addEventListener('pointerup', onUp, { capture: true, passive: true });
    document.addEventListener('pointercancel', onCancel, { capture: true, passive: true });
    // A press interrupted by the tab going away must not come back marked.
    window.addEventListener('blur', onCancel);

    return () => {
      document.removeEventListener('pointerdown', onDown, { capture: true });
      document.removeEventListener('pointermove', onMove, { capture: true });
      document.removeEventListener('pointerup', onUp, { capture: true });
      document.removeEventListener('pointercancel', onCancel, { capture: true });
      window.removeEventListener('blur', onCancel);
      if (arm) clearTimeout(arm);
      if (release) clearTimeout(release);
      host?.removeAttribute('data-pressed');
    };
  }, []);

  return null;
}

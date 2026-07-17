'use client';

import { useEffect } from 'react';

/**
 * iOS Safari keyboard-inset fallback (docs/v2-docs/foundation-standards.md §4).
 *
 * The shell height is `calc(100dvh - var(--keyboard-inset, 0px))`. On every
 * platform EXCEPT iOS Safari the keyboard resizes the layout viewport itself
 * (Android/Firefox honour `interactive-widget=resizes-content`; some browsers
 * expose the VirtualKeyboard API), so `dvh` already tracks the keyboard and no
 * JS is needed — `--keyboard-inset` stays 0.
 *
 * iOS Safari does neither: it overlays the keyboard without changing `dvh`, so
 * the dock (composer) would sit BEHIND the keyboard. This hook subscribes to
 * `visualViewport` and writes the occluded height into `--keyboard-inset`,
 * shrinking the shell so the dock rides above the keyboard.
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
    // No visualViewport → nothing to measure. And when the browser exposes the
    // VirtualKeyboard API it resizes the layout viewport for us, so this manual
    // inset would double-count — skip both cases entirely.
    if (!viewport) return;
    if ('virtualKeyboard' in navigator) return;

    const root = document.documentElement;

    const update = (): void => {
      // Height occluded at the bottom of the layout viewport (keyboard + any
      // accessory bar). Clamp ≥ 0 — iOS rubber-band scrolling can transiently
      // make the raw value negative.
      const occlusion = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      root.style.setProperty('--keyboard-inset', `${occlusion}px`);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);

    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
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

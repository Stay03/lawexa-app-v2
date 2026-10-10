'use client';

import { useEffect } from 'react';
import { restoreDocumentScroll } from './document-scroll';

/**
 * Applies the `.v2-document-lock` class to `<html>` while the v2 layout is
 * mounted, and removes it on unmount.
 *
 * Why a lifecycle-managed class instead of bare `html, body` rules in
 * shell.css: React 19 never removes precedence stylesheets from `<head>` once
 * loaded (it only refcounts them), so after a soft client-side navigation from
 * v2 into a v1 route the sheet keeps applying — an unscoped
 * `html { overflow: hidden }` would leave the v1 page unscrollable until a hard
 * reload. Scoping the lock to this class makes the rules follow the v2 shell's
 * actual mount lifecycle in both directions.
 *
 * One-frame nuance: the class lands after hydration, so the very first paint of
 * a v2 page has a briefly scrollable document — invisible in practice because
 * the shell is exactly 100dvh. Pure DOM side-effect; no setState (React
 * Compiler lint safe).
 *
 * THE DOCUMENT MUST ALSO STAY AT ZERO. A document left offset by script or the
 * platform made iOS hit-test the side menu one row above the finger (Arthur,
 * iPhone XS Max, home-screen app, first app opened after the phone started,
 * 10 October 2026). The lock (shell.css) removes the range; this resets any
 * offset at the moments one can appear:
 * - Safari's own scroll restore on launch: `history.scrollRestoration` is
 *   manual while v2 is mounted and put back for v1, which scrolls the document
 *   and relies on it. Next's app router neither reads nor writes it, and the
 *   shell scroller keeps its place through scroll-memory.tsx.
 * - Return to the page (`pageshow`, a tab or home-screen app made visible).
 * - A sheet opening: every Radix dialog sets `data-scroll-locked` on body while
 *   open (react-remove-scroll-bar), so watching that attribute covers the side
 *   menu, the message menu and every other sheet without editing the shared
 *   sheet component (components/ui/sheet.tsx, used by v1).
 * The keyboard's own offset is undone in use-keyboard-inset.ts.
 */
export function DocumentLock(): null {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('v2-document-lock');

    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    restoreDocumentScroll();

    const onPageShow = (): void => restoreDocumentScroll();
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') restoreDocumentScroll();
    };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);

    const sheetOpened = new MutationObserver((records) => {
      if (records.some((record) => record.oldValue === null) && document.body.hasAttribute('data-scroll-locked')) {
        restoreDocumentScroll();
      }
    });
    sheetOpened.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-scroll-locked'],
      attributeOldValue: true,
    });

    return () => {
      html.classList.remove('v2-document-lock');
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
      sheetOpened.disconnect();
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  return null;
}

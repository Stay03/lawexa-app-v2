'use client';

import { useEffect } from 'react';

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
 */
export function DocumentLock(): null {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('v2-document-lock');
    return () => {
      html.classList.remove('v2-document-lock');
    };
  }, []);

  return null;
}

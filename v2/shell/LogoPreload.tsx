'use client';

import { preload } from 'react-dom';

import wordmarkSrc from '@/public/images/logo.png';
import markSrc from '@/public/android-chrome-512x512.png';

/**
 * LogoPreload — warms BOTH brand assets at the v2 layout level so the drawer's
 * logo is already cached before the Sheet ever mounts (owner bug #19: the drawer
 * logo took seconds to appear on first open because the fetch only started when
 * the drawer first opened).
 *
 * React 19's `preload` (from `react-dom`) hoists a `<link rel="preload"
 * as="image">` into <head> during render and dedupes across callers. We preload
 * the STATIC-import `.src` URLs — the exact `/_next/static/media/…` paths that
 * `LogoWordmark` / `LogoMark` request (they render `unoptimized`, so next/image
 * serves the raw static file, no optimizer round-trip). Because this renders in
 * the layout — above every surface — the bytes are in flight from the first
 * paint, so the sidebar header, desktop header, mobile mark, and the not-yet-
 * mounted drawer all hit a warm cache.
 *
 * Rendered inside a Server Component layout; as a Client Component it still runs
 * during SSR (emitting the hint into the streamed HTML) and re-runs idempotently
 * on the client. Renders nothing.
 */
export function LogoPreload() {
  preload(wordmarkSrc.src, { as: 'image', fetchPriority: 'high' });
  preload(markSrc.src, { as: 'image', fetchPriority: 'high' });
  return null;
}

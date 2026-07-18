import Image from 'next/image';

import { cn } from '@/lib/utils';
import wordmarkSrc from '@/public/images/logo.png';
import markSrc from '@/public/android-chrome-512x512.png';

/**
 * Brand logo lockup for the v2 shell chrome — the ONE source for every place the
 * old text "Lawexa" wordmark used to live (sidebar header, drawer header, mobile
 * header). Both marks are the gold-on-transparent brand assets, verified legible
 * in BOTH themes, so there is no per-theme asset swap to maintain.
 *
 * STATIC IMPORTS (not string `src`) are used deliberately: Next infers the
 * intrinsic width/height from the file (543×175 wordmark, 512×512 mark), so the
 * browser reserves the exact box and there is zero CLS — no magic dimension
 * numbers to drift from the asset. Display size is set purely in CSS.
 *
 * INSTANT LOADING (owner bug: the drawer's logo took multiple seconds to appear
 * on first open). Two fixes, both correct for tiny persistent-chrome marks per
 * the Next 16 image guidance:
 *  - `unoptimized` — serve the raw static PNG straight from `/_next/static/…`
 *    instead of routing through the on-demand `/_next/image` optimizer. The
 *    optimizer round-trip (cold-resize on first hit) is exactly what stalled the
 *    drawer logo, which isn't requested until the Sheet first mounts. These marks
 *    are already tiny, so there is nothing to optimize.
 *  - `loading="eager"` — load immediately when mounted regardless of viewport,
 *    the Next 16 replacement for the deprecated `priority` prop for non-LCP art.
 *    We deliberately do NOT `preload`: preload is for the single true LCP hero,
 *    and preloading persistent chrome would only compete with real content.
 *
 * The `h-* w-auto` display pattern is the Next-recommended way to resize while
 * preserving ratio — `width: auto` paired with a fixed height silences the
 * "modified one dimension but not the other" console warning.
 */

/** The full "Lawexa" gold wordmark (≈3.1:1). Defaults to h-8 (32px, v1's scale). */
export function LogoWordmark({
  className,
  alt = 'Lawexa',
}: {
  className?: string;
  /** Set `alt=""` when a sibling already names the brand (decorative use). */
  alt?: string;
}) {
  return (
    <Image
      src={wordmarkSrc}
      alt={alt}
      unoptimized
      loading="eager"
      className={cn('h-8 w-auto select-none', className)}
    />
  );
}

/** The square gold pillar mark. Defaults to size-8 (32px). Use where a compact
 *  1:1 mark reads better than the wordmark (e.g. the tight mobile header). */
export function LogoMark({
  className,
  alt = 'Lawexa',
}: {
  className?: string;
  /** Set `alt=""` when a sibling already names the brand (decorative use). */
  alt?: string;
}) {
  return (
    <Image
      src={markSrc}
      alt={alt}
      unoptimized
      loading="eager"
      className={cn('size-8 rounded-md select-none', className)}
    />
  );
}

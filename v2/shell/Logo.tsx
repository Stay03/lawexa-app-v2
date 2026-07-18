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
 * No `priority` (deprecated in Next 16 in favour of `preload`) and no `preload`:
 * these are small persistent-chrome marks, not the LCP hero, so preloading them
 * would only compete with real content. Default loading is correct here.
 *
 * The `h-* w-auto` display pattern is the Next-recommended way to resize while
 * preserving ratio — `width: auto` paired with a fixed height silences the
 * "modified one dimension but not the other" console warning.
 */

/** The full "Lawexa" gold wordmark (≈3.1:1). Defaults to ~h-8 (32px). */
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
      className={cn('size-8 rounded-md select-none', className)}
    />
  );
}

/**
 * The muted "v2" preview pill that sits beside the logo everywhere. Kept as a
 * shared piece so testers always see the same "this is the preview" marker and
 * its styling can't drift between the three shell surfaces.
 */
export function LogoV2Badge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-primary',
        className,
      )}
    >
      v2
    </span>
  );
}

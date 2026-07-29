'use client';

import 'flag-icons/css/flag-icons.min.css';

import { cn } from '@/lib/utils';

/**
 * FlagIcon — a country flag served from OUR origin, never a CDN and never an
 * emoji.
 *
 * WHY (owner, July 29: "can I have the flag icon show instead of emojis or
 * something cos it's not showing on my device"). The previous renderer
 * (`react-country-flag`) fetched each SVG from jsDelivr at render time, so a
 * device that cannot reach that CDN — blocked network, flaky connection —
 * showed nothing, and the emoji fallback path is exactly what Windows cannot
 * draw (it renders "GH" letters instead of a flag). Both failure modes have the
 * same root: the flag art was not ours.
 *
 * `flag-icons` is the SAME artwork (lipis/flag-icons — the library the CDN
 * served), installed as a dependency. Its CSS maps `fi-{code}` classes to SVG
 * `background-image`s that Next bundles into `/_next/static`, so every flag is
 * a first-party asset: same origin, immutable-cached, no runtime dependency on
 * anyone's uptime. Only flags actually rendered are fetched (a background-image
 * loads lazily per class use), so shipping the full set costs nothing up front.
 *
 * The box is a real 4×3 (the artwork's own ratio) — the old renderer stretched
 * flags into a square. A muted underlay holds the footprint, so a code with no
 * artwork degrades to a quiet neutral block rather than a broken-image glyph.
 */

/** The flag's reserved footprint — 4×3 at chip scale. Both dimensions are
 *  fixed so the slot cannot shift between the underlay and the artwork. */
export const FLAG_W = '1.4em';
export const FLAG_H = '1.05em';

export function FlagIcon({
  code,
  title,
  className,
}: {
  /** ISO 3166-1 alpha-2 code, any case. */
  code: string;
  /** Country name. When given, the flag is announced as an image with this
   *  label (and shows it on hover); without one it is decorative. */
  title?: string;
  className?: string;
}) {
  return (
    <span
      {...(title ? { role: 'img', 'aria-label': title, title } : { 'aria-hidden': true })}
      className={cn(
        'relative inline-block shrink-0 overflow-hidden rounded-[2px] bg-muted align-middle',
        className,
      )}
      style={{ width: FLAG_W, height: FLAG_H }}
    >
      <span
        aria-hidden
        className={cn('fi absolute inset-0', `fi-${code.toLowerCase()}`)}
        // The library sizes `.fi` by em; the reserved box is the authority here.
        style={{ width: '100%', height: '100%' }}
      />
    </span>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { HOME_TABS, homeTabForPath } from './home-tabs';

/**
 * HomeTabs — the Chat | Work | Study control centred in the header (owner #34).
 *
 * ── NOW LINKS, NOT A RADIOGROUP ─────────────────────────────────────────────
 * Each tab became a real route (`v2/shell/home-tabs.ts` carries the full reasoning),
 * so this control's job changed from "write a store" to "navigate". That turns a
 * careful pile of hand-rolled a11y into the platform's own: three `<a>` elements.
 *
 * The old implementation was a `role="radiogroup"` with roving tabindex and
 * arrow-key stepping, chosen because the tab was a persisted device PREFERENCE and
 * nothing was being navigated to. That reasoning was sound then and is simply
 * obsolete now — these ARE destinations. Claiming radio semantics for links would
 * be the same mistake the old docblock rejected `tablist` for: describing the
 * control as something it is not.
 *
 * What we get for free by not hand-rolling it: middle-click and ctrl-click open a
 * tab, the browser shows the target URL on hover, `aria-current="page"` is the exact
 * right semantic, Next prefetches each route, and every keyboard user already knows
 * Tab-then-Enter. Three tab stops instead of one is the honest cost of three links,
 * and it is the standard cost of any nav.
 *
 * ACTIVE STATE comes from the pathname, so it can never disagree with what is on
 * screen — the previous store could, for one render, after hydration.
 *
 * MOTION: the active-segment gold tint cross-fades symmetrically — the outgoing
 * segment fades out while the incoming fades in (`transition-colors` on each,
 * both directions), `motion-reduce`-guarded.
 *
 * 320px: three word-labels are wider than the old A|B, and the header's centre
 * budget between the 88px nav cluster and the 92px actions cluster is tight at
 * 320px — so the control uses COMPACT type there (never icons; the words always
 * show) and steps up to comfortable sizing from 360px and again at `md`. The 44px
 * touch HEIGHT is held on mobile; segment width is space-shared only at the 320px
 * floor (segments are adjacent, so there is no dead gap to mis-tap into).
 */
export function HomeTabs() {
  const pathname = usePathname();
  const active = homeTabForPath(pathname);

  return (
    <nav
      aria-label="Home view"
      className="inline-flex items-center rounded-full bg-muted/50 p-0.5 md:p-1"
    >
      {HOME_TABS.map((option) => {
        const current = option.value === active;
        return (
          <Link
            key={option.value}
            href={option.href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'v2-interactive flex min-h-11 items-center justify-center rounded-full px-1 text-[11px] font-medium leading-none transition-colors outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring min-[360px]:px-2.5 min-[360px]:text-xs motion-reduce:transition-none md:min-h-8 md:px-3.5 md:text-sm',
              current
                ? 'bg-primary/20 text-foreground'
                : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}

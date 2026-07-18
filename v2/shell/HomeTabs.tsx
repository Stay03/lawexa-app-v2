'use client';

import { useRef } from 'react';

import { cn } from '@/lib/utils';
import { setHomeTab, useHomeTabSelection, type HomeTab } from './home-tab';

/**
 * HomeTabs — the Chat | Work | Study control centred in the header (owner #34).
 * This is REAL product chrome, not the old dev A/B pill: it writes the shared
 * `home-tab` store, so the home surface swaps in lockstep (with the store's
 * symmetric fade), and the choice is persisted per device.
 *
 * A11y — WHY radiogroup, NOT tablist (deliberate, per research):
 *   The three surfaces are alternate lenses on the SAME destination ("home"),
 *   selected as a persisted, mutually-exclusive value — Adobe's react-spectrum
 *   guidance maps that (a view-mode selection, applied immediately) to a
 *   radio/toggle group, and reserves `tablist` for a strip physically bound to
 *   its `tabpanel`s. The tablist contract is the wrong fit HERE specifically:
 *   this control lives in the global header, DOM-separated from the home region
 *   it swaps by the rest of the header + the scroll container, so a `tablist`'s
 *   focus model (Tab off the selected tab lands IN its `aria-controls` panel)
 *   cannot honestly hold — Tab would reach the notification bell, not the home.
 *   Claiming tablist semantics we can't fulfil is worse than not claiming them.
 *   Primer's list-of-buttons + `aria-current` pattern was the other candidate,
 *   but it spends three tab stops in the chrome's tab order; radiogroup keeps a
 *   single roving tab stop (cleaner header keyboard flow: trigger → this one
 *   control → bell → menu) and communicates "pick one of these, applied now",
 *   which is exactly what a persisted device preference is. Immediate-apply is
 *   fully within the WAI-ARIA radio pattern (no submit button is implied).
 *
 *   Implementation: `role="radiogroup"` + `role="radio"` children, one roving
 *   tab stop (only the checked option is tabbable), and Left/Right/Up/Down move
 *   focus + selection with wrap-around, per the radio-group authoring pattern.
 *   The visible label IS the accessible name (no redundant `aria-label`).
 *
 * MOTION: the active-segment gold indicator cross-fades symmetrically — the
 * outgoing segment's tint fades out while the incoming segment's fades in (one
 * `transition-colors` per segment, both directions), `motion-reduce`-guarded.
 *
 * 320px: three word-labels are wider than the old A|B, and the header's centre
 * budget between the 88px nav cluster and the 92px actions cluster is tight at
 * 320px — so the control uses COMPACT type there (never icons; the words always
 * show) and steps up to comfortable sizing from 360px and again at `md`. The
 * 44px touch HEIGHT is held on mobile; segment width is space-shared only at the
 * 320px floor (segments are adjacent, so there is no dead gap to mis-tap into).
 */

const TABS: readonly { value: HomeTab; label: string }[] = [
  { value: 'chat', label: 'Chat' },
  { value: 'work', label: 'Work' },
  { value: 'study', label: 'Study' },
];

export function HomeTabs() {
  // The SELECTION (pending fade target when mid-swap) — never the lagging
  // displayed tab: aria-checked, the gold tint, and arrow stepping must reflect
  // the user's choice instantly; only the surface itself fades behind it.
  const tab = useHomeTabSelection();
  const buttonRefs = useRef<Partial<Record<HomeTab, HTMLButtonElement>>>({});

  const move = (direction: -1 | 1) => {
    const index = TABS.findIndex((option) => option.value === tab);
    const next = TABS[(index + direction + TABS.length) % TABS.length];
    setHomeTab(next.value);
    buttonRefs.current[next.value]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Home view"
      onKeyDown={handleKeyDown}
      className="inline-flex items-center rounded-full bg-muted/50 p-0.5 md:p-1"
    >
      {TABS.map((option) => {
        const checked = option.value === tab;
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttonRefs.current[option.value] = element ?? undefined;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => setHomeTab(option.value)}
            className={cn(
              'flex min-h-11 items-center justify-center rounded-full px-1 text-[11px] font-medium leading-none transition-colors outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring min-[360px]:px-2.5 min-[360px]:text-xs motion-reduce:transition-none md:min-h-8 md:px-3.5 md:text-sm',
              checked
                ? 'bg-primary/20 text-foreground'
                : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

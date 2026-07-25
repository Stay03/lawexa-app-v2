'use client';

import { useCallback, useState } from 'react';
import { ArrowUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { V2_SHELL_CONTENT_ID } from './shell-content';

/**
 * NewRowsPill — the shared UI half of the "N new rows" pattern; pair it with the
 * headless `v2/runtime/use-new-rows.ts`. Feature-agnostic: it takes a count, a
 * noun, and an accept callback, so the phase-4 cases / statutes / notes lists
 * reuse it verbatim.
 *
 * LAYOUT — sticky, but STRICTLY OUT OF FLOW. The sticky element is `h-0`, so it
 * reserves no vertical space and appearing/disappearing can never shift the list
 * (zero CLS). The button inside floats over the first rows and pins to the top of
 * the shell scroll region once the page is scrolled.
 *
 * MOTION — symmetric in BOTH directions. The button is ALWAYS mounted and toggles
 * opacity/translate/scale over 200ms, so the exit tween actually plays instead of
 * the element vanishing on unmount (the standing no-abrupt-appear/disappear rule).
 * The label holds its last non-empty value through the exit so it never reads
 * "0 new …" on the way out. `motion-reduce` drops the tween entirely, and the
 * accept scroll falls back to an instant jump under the same preference.
 *
 * A11Y — while hidden the button is `inert` (out of the tab order AND out of the
 * accessibility tree, so nothing focusable sits invisibly over the list). The
 * announcement therefore rides a separate, never-inert `role="status"` live
 * region, and the 44px minimum touch target is enforced by `min-h-11`.
 */

/** The shell's single scroll container (see `shell-content.ts`). */
function shellScrollRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(V2_SHELL_CONTENT_ID);
}

export interface NewRowsPillProps {
  /** How many new rows are being withheld. `0` hides the pill (with a tween). */
  count: number;
  /** Reveal the withheld rows — `useNewRows(...).accept`. */
  onAccept: () => void;
  /** Singular noun for the copy, e.g. `"conversation"`. */
  noun: string;
  /** Plural noun; defaults to `noun + 's'`. Pass it for irregular plurals. */
  nounPlural?: string;
  /** Extra classes for the sticky container (e.g. a different `top-*` offset). */
  className?: string;
}

export function NewRowsPill({
  count,
  onAccept,
  noun,
  nounPlural,
  className,
}: NewRowsPillProps) {
  const visible = count > 0;
  const liveLabel = `${count} new ${count === 1 ? noun : (nounPlural ?? `${noun}s`)}`;

  // Hold the last announced label so the EXIT tween keeps reading correctly
  // instead of flipping to "0 new …". Adjusting state during render in React's
  // sanctioned guarded form (never unconditional, always derived from props).
  const [lastLabel, setLastLabel] = useState('');
  if (visible && liveLabel !== lastLabel) setLastLabel(liveLabel);
  const label = visible ? liveLabel : lastLabel;

  const handleClick = useCallback(() => {
    // Reveal first, then travel — but travel on the NEXT frame (review F4). The
    // splice commits after this handler returns, and starting a smooth scroll in
    // the same tick lets scroll anchoring adjust `scrollTop` by the inserted
    // height mid-animation, landing the user below the top. One rAF puts the
    // scroll after the insertion has committed.
    onAccept();
    const element = shellScrollRoot();
    if (!element) return;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Focus moves with the reveal (review F3): `inert` lands on this button in the
    // same commit, so a keyboard user's focus would otherwise fall to <body> at the
    // exact moment they asked to see the rows. The scroll root is the honest
    // landing spot — it is what the user is about to read.
    element.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      element.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }, [onAccept]);

  return (
    <div
      className={cn(
        'pointer-events-none sticky top-3 z-20 h-0 overflow-visible',
        className,
      )}
    >
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleClick}
          inert={!visible}
          className={cn(
            'v2-interactive inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2',
            'bg-primary text-sm font-medium text-primary-foreground shadow-lg',
            'transition-[opacity,transform,background-color] duration-200 ease-out motion-reduce:transition-none',
            'hover:bg-primary/90 active:scale-[0.98]',
            visible
              ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
              : '-translate-y-2 scale-95 opacity-0',
            FOCUS_RING,
          )}
        >
          <ArrowUp aria-hidden className="size-4" />
          {label}
        </button>
      </div>
      {/* Never inert, so the count is announced when it appears. */}
      <p role="status" aria-live="polite" className="sr-only">
        {visible ? liveLabel : ''}
      </p>
    </div>
  );
}

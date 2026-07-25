'use client';

import { Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * SearchField — the ONE search box every v2 list surface renders, and
 * `SearchFieldShape` is the ONE still reservation every one of their
 * `loading.tsx` files draws in its place.
 *
 * Both live here together on purpose. The loading convention (standards §8i)
 * says a search field is STATIC CHROME: it waits on no request, so a route
 * fallback must reserve its resting geometry rather than pulse a skeleton over
 * it. That only stays true if the two shapes cannot drift — and they drift the
 * moment they are two hand-written class strings in two files. Keeping the live
 * field and its reservation in one module makes the hand-off provably seamless:
 * change the height here and both move.
 *
 * PURELY CONTROLLED — no internal state, no debounce, no props→state effect. All
 * search state lives in `useUrlSearch`; this renders `value` and reports intent.
 * That is what makes the v1 lint defect (syncing local state from props in an
 * effect) structurally impossible here.
 *
 * The 16px base font (from the `Input` primitive) avoids the iOS focus-zoom; the
 * field is `h-11` (44px) and the clear button is a full 44px hit target, both
 * meeting the touch-target floor.
 */

/** The field's resting geometry, shared by the live control and the reservation. */
const FIELD_SHAPE = 'h-11 w-full rounded-4xl';

export function SearchField({
  value,
  onChange,
  onClear,
  placeholder,
  label,
  busy = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  /** Accessible name — the placeholder is not one for a screen reader. */
  label: string;
  /** True while a new search is resolving — softly pulses the leading icon. */
  busy?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-opacity',
          busy && 'motion-safe:animate-pulse',
        )}
      />
      <Input
        type="text"
        inputMode="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn(FIELD_SHAPE, 'pl-10 pr-12')}
      />
      {value ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className={cn(
            'v2-interactive absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
            FOCUS_RING,
          )}
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * The field's RESERVED SHAPE for a route fallback — the same geometry, held
 * perfectly still, with the real leading icon. Not a `Skeleton`: a pulse
 * promises a request is in flight, and there is none behind a search box.
 *
 * Safe to render from a server `loading.tsx` (it is inert markup, and the
 * `'use client'` directive on this module only means it ships to the client
 * bundle — it does not force the fallback to be interactive).
 */
export function SearchFieldShape({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <div className={cn(FIELD_SHAPE, 'border border-input bg-input/30')} />
    </div>
  );
}

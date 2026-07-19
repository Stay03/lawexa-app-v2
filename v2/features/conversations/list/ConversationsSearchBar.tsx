'use client';

import { Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * ConversationsSearchBar — a PURELY controlled search field (no internal state,
 * no debounce, no props→state effect). All search state lives in
 * `useConversationsSearch`; this component only renders `value` and reports
 * intent (`onChange` / `onClear`). That is what makes the v1 lint defect
 * (syncing local state from props in an effect) structurally impossible here.
 *
 * The 16px base font (from the `Input` primitive) avoids the iOS focus-zoom; the
 * field is `h-11` (44px) and the clear button is a full 44px hit target, both
 * meeting the touch-target floor. A subtle `busy` shimmer on the leading icon
 * signals a search is in flight without a jarring skeleton swap (the list keeps
 * its previous results, dimmed, via `keepPreviousData`).
 */
export function ConversationsSearchBar({
  value,
  onChange,
  onClear,
  busy = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
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
        placeholder="Search conversations by title..."
        aria-label="Search conversations by title"
        className="h-11 pl-10 pr-12"
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

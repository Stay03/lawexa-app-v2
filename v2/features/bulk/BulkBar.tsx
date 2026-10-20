'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { countOf } from './model';

/**
 * The bar a list shows while its rows are being ticked (bulk select, Arthur,
 * 20 October 2026): the select-all box for THIS list with its count, how many
 * are ticked, the screen's own actions, and Done. Fixed at the foot of the
 * screen over the list, above a phone's safe area; on a computer a floating
 * bar centred in the content column.
 *
 * The actions are the screen's (`children`): each is a {@link BulkBarAction},
 * off while nothing is ticked.
 */
export function BulkBar({
  count,
  total,
  allState,
  onToggleAll,
  onDone,
  noun,
  children,
}: {
  count: number;
  /** Rows in the current list: what select-all would tick. */
  total: number;
  allState: boolean | 'indeterminate';
  onToggleAll: () => void;
  onDone: () => void;
  noun: { one: string; many: string };
  children: ReactNode;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Selected items"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pointer-events-none md:pb-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
    >
      <div className="pointer-events-auto mx-auto flex max-w-2xl flex-col gap-2 rounded-2xl border border-border bg-popover p-2.5 text-popover-foreground shadow-lg md:flex-row md:items-center">
        <div className="flex min-w-0 items-center gap-2.5 px-1">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allState}
              onCheckedChange={onToggleAll}
              disabled={total === 0}
              aria-label={`Select all ${countOf(total, noun)}`}
            />
            <span className="text-muted-foreground">All {total}</span>
          </label>
          <span aria-live="polite" className="min-w-0 flex-1 truncate text-sm font-medium">
            {count === 0 ? 'None selected' : `${countOf(count, noun)} selected`}
          </span>
          <button
            type="button"
            onClick={onDone}
            aria-label="Stop selecting"
            className={cn(
              'v2-interactive inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:order-last',
              FOCUS_RING,
            )}
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 md:ml-auto md:flex-nowrap">{children}</div>
      </div>
    </div>
  );
}

/** One action in the bar: a small pill, off while nothing is ticked or one is running. */
export function BulkBarAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  destructive = false,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  onClick: () => void;
  disabled: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'v2-interactive inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50',
        destructive && 'text-destructive hover:bg-destructive/10',
        FOCUS_RING,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </button>
  );
}

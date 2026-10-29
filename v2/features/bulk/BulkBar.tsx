'use client';

import type { ComponentType, ReactNode } from 'react';
import { MoreHorizontal, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { countOf } from './model';

/**
 * The bar a list shows while its rows are being ticked (bulk select, Arthur,
 * 20 October 2026). Fixed at the foot of the screen over the list, above a
 * phone's safe area; on a computer a floating bar centred in the content
 * column.
 *
 * ONE QUIET ROW (Stay, 29 October 2026, 01:11Z, on the folder picture: "Look
 * at the bottom now those buttons are horrible"; the techlead's brief after
 * Linear's and Gmail's bars). The select-all box, "1 selected", then the
 * screen's main actions as plain text buttons, then "More" with the rest, and
 * the close. Every label is on one line, never wrapped. Delete is red text
 * only. On a phone the main actions and More show their icons alone, with
 * their words for a screen reader, so the bar fits 390 px.
 *
 * CLEARING IS SAID IN WORDS (Arthur, 29 October 2026, 07:05Z, thread
 * 8aa04be0: "the way to untick all is unintuitive"). The close reads "Clear
 * selection" from `sm:` up, its ✕ alone on a phone with the same name for a
 * screen reader; it clears every tick and ends select mode. Escape does the
 * same (`useBulkSelection`). Where the list's head carries the select-all
 * tick (`selectAllInHead`, the file lists), the bar's own box shows on a
 * phone only, where the head is hidden.
 *
 * The screen decides what is main (`children`, each a {@link BulkBarAction}:
 * Move and Delete where it has them) and what goes in More (`more`, each a
 * {@link BulkBarMenuItem}). Every action is off while nothing is ticked.
 */
export function BulkBar({
  count,
  total,
  allState,
  onToggleAll,
  onDone,
  noun,
  children,
  more,
  selectAllInHead = false,
}: {
  count: number;
  /** Rows in the current list: what select-all would tick. */
  total: number;
  allState: boolean | 'indeterminate';
  onToggleAll: () => void;
  onDone: () => void;
  noun: { one: string; many: string };
  /** The main actions, as buttons. */
  children: ReactNode;
  /** The rest, in the More menu. */
  more?: ReactNode;
  /** The list's head has the select-all tick from `sm:` up (`FileListHead`). */
  selectAllInHead?: boolean;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Selected items"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pointer-events-none md:pb-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
    >
      <div className="pointer-events-auto mx-auto flex max-w-2xl items-center gap-1 rounded-2xl border border-border bg-popover py-1.5 pl-3 pr-1.5 text-popover-foreground shadow-lg">
        <Checkbox
          checked={allState}
          onCheckedChange={onToggleAll}
          disabled={total === 0}
          aria-label={`Select all ${countOf(total, noun)}`}
          className={cn(selectAllInHead && 'sm:hidden')}
        />
        <span
          aria-live="polite"
          className={cn(
            'ml-2 shrink-0 whitespace-nowrap text-sm font-medium tabular-nums',
            selectAllInHead && 'sm:ml-0',
          )}
        >
          {count === 0 ? 'None selected' : `${count} selected`}
        </span>
        <div className="ml-auto flex min-w-0 items-center gap-0.5">
          {children}
          {more ? <BulkBarMore>{more}</BulkBarMore> : null}
        </div>
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
        <button
          type="button"
          onClick={onDone}
          aria-label="Clear selection"
          title="Clear selection (Esc)"
          className={cn(
            'v2-interactive inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:px-2.5',
            FOCUS_RING,
          )}
        >
          <X aria-hidden className="size-4" />
          <span aria-hidden className="max-sm:hidden">
            Clear selection
          </span>
        </button>
      </div>
    </div>
  );
}

type BulkIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

/** The bar's quiet text button: no border, a tint on hover. */
const ACTION =
  'v2-interactive inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-sm font-medium transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40';

/** One main action in the bar: its word from `sm:` up, its icon alone below. */
export function BulkBarAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  destructive = false,
}: {
  icon: BulkIcon;
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
      aria-label={label}
      title={label}
      className={cn(ACTION, destructive ? 'text-destructive hover:bg-destructive/10' : 'text-foreground', FOCUS_RING)}
    >
      <Icon aria-hidden className="size-4 sm:hidden" />
      <span aria-hidden className="max-sm:hidden">
        {label}
      </span>
    </button>
  );
}

/** The More menu: the screen's other actions. */
function BulkBarMore({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="More actions" className={cn(ACTION, 'text-foreground', FOCUS_RING)}>
          <MoreHorizontal aria-hidden className="size-4 sm:hidden" />
          <span aria-hidden className="max-sm:hidden">
            More
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="min-w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One action in the More menu. */
export function BulkBarMenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  destructive = false,
}: {
  icon: BulkIcon;
  label: string;
  onClick: () => void;
  disabled: boolean;
  destructive?: boolean;
}) {
  return (
    <DropdownMenuItem
      onSelect={onClick}
      disabled={disabled}
      className={cn('gap-2 whitespace-nowrap', destructive && 'text-destructive focus:text-destructive')}
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </DropdownMenuItem>
  );
}

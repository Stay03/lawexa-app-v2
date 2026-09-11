'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc';

/** A faint double arrow on a column that is not sorting the table, and the
 *  arrow of the direction on the one that is. */
export function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ArrowUpDown aria-hidden className="size-3.5 opacity-40" />;
  return direction === 'asc' ? (
    <ArrowUp aria-hidden className="size-3.5 text-primary" />
  ) : (
    <ArrowDown aria-hidden className="size-3.5 text-primary" />
  );
}

/**
 * The clickable label at the top of a sortable column, shared by the
 * financials and applications tables so both look and read alike.
 *
 * What a click does belongs to the caller: financials goes down, up, then back
 * to the order the server sent; applications flips between the two directions.
 *
 * `align` pulls the ghost button's padding back so the label lines up with the
 * cells below it: `end` for right-aligned number columns, `start` for text.
 */
export function SortButton({
  label,
  active,
  direction,
  onClick,
  align = 'end',
}: {
  label: string;
  active: boolean;
  /** The table's current direction. Drawn only when `active`. */
  direction: SortDirection;
  onClick: () => void;
  align?: 'start' | 'end';
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(align === 'end' ? '-mr-3' : '-ml-3', 'h-8 gap-1.5 font-semibold')}
      onClick={onClick}
    >
      {label}
      <SortIcon active={active} direction={active ? direction : 'desc'} />
    </Button>
  );
}

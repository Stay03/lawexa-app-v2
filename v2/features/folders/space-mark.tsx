'use client';

import Link from 'next/link';
import { Blocks } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * The mark of a folder that sits in a Space (Arthur picked 2a, 21 October
 * 2026, 13:07Z): the Space glyph (the blocks, as a Space wears everywhere else)
 * in the folder's own yellow, pulled in to sit about half over the folder
 * icon's bottom-right corner. No disc: Arthur, "It doesn't need the gold disc
 * around it". It replaces Stay's C1 of 20 October, a yellow disc with the
 * people glyph, which read as "shared". The yellow keeps the type colour rule
 * ("The colour should be for the types"): the mark adds no new colour.
 *
 * The blocks sit on a small square of the ground behind them, so their lines
 * do not run into the folder's outline where they cross it. `ground` names
 * that ground: a list row (the page, and the row's hover tint under the
 * pointer) or the picker's grey tile.
 *
 * The Space's name costs no row space. A screen reader hears
 * {@link spaceFolderNote} after the folder's name (the row puts it there). With
 * `tooltip`, a computer shows "In <Space>" on hover over the mark; the picker
 * leaves it out, since its rows are options and buttons.
 */
export function SpaceFolderMark({
  spaceName,
  ground,
  tooltip = false,
}: {
  spaceName: string;
  ground: 'row' | 'tile';
  tooltip?: boolean;
}) {
  const glyph = (
    <span
      className={cn(
        'absolute -bottom-0.5 -right-0.5 flex size-[11px] items-center justify-center rounded-[2px] p-px',
        'text-amber-500 dark:text-amber-400',
        ground === 'row'
          ? 'bg-background group-hover:bg-[color-mix(in_oklch,var(--secondary)_50%,var(--background))]'
          : 'bg-secondary',
      )}
    >
      <Blocks aria-hidden className="size-full stroke-[2.6]" />
    </span>
  );
  if (!tooltip) return <span aria-hidden>{glyph}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{glyph}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        In {spaceName}
      </TooltipContent>
    </Tooltip>
  );
}

/** What a screen reader hears after a Space folder's name. */
export function spaceFolderNote(spaceName: string): string {
  return `, in ${spaceName}`;
}

/**
 * A Space folder's page, under its name: "In <Space>", the Space a link. Quiet
 * type, led by the same yellow blocks as the list's mark so the two read as one.
 */
export function SpaceFolderLine({ space, className }: { space: { uuid: string; name: string }; className?: string }) {
  return (
    <p className={cn('-mt-1 mb-3 flex min-w-0 items-center gap-2 text-sm text-muted-foreground', className)}>
      <Blocks aria-hidden className="size-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
      <span className="shrink-0">In</span>
      <Link
        href={`/spaces/${space.uuid}`}
        className={cn(
          'v2-interactive min-w-0 truncate rounded text-foreground/85 underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground/40',
          FOCUS_RING,
        )}
      >
        {space.name}
      </Link>
    </p>
  );
}

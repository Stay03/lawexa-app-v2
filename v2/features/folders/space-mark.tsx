'use client';

import Link from 'next/link';
import { Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * The mark of a folder that sits in a Space (Stay picked C1, 20 October 2026,
 * 14:24Z): a disc in the folder's own yellow, with the people glyph cut out of
 * it, on the bottom right of the folder icon. The yellow keeps the type colour
 * rule ("The colour should be for the types"): the mark says "folder" in the
 * same colour and adds no new one.
 *
 * The disc sits in a ring of the ground behind it, so it reads as cut out of
 * the icon at phone size. `ground` names that ground: a list row (the page, and
 * the row's hover tint under the pointer) or the picker's grey tile.
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
  const disc = (
    <span
      className={cn(
        'absolute -bottom-1 -right-1.5 flex size-3.5 items-center justify-center rounded-full ring-2',
        'bg-amber-500 text-background dark:bg-amber-400',
        ground === 'row'
          ? 'ring-background group-hover:ring-[color-mix(in_oklch,var(--secondary)_50%,var(--background))]'
          : 'ring-secondary',
      )}
    >
      <Users aria-hidden className="size-2.5 stroke-[2.75]" />
    </span>
  );
  if (!tooltip) return <span aria-hidden>{disc}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{disc}</TooltipTrigger>
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
 * type, with the same yellow disc as the list's mark so the two read as one.
 */
export function SpaceFolderLine({ space }: { space: { uuid: string; name: string } }) {
  return (
    <p className="-mt-1 mb-3 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
      <span
        aria-hidden
        className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-background dark:bg-amber-400"
      >
        <Users className="size-2.5 stroke-[2.75]" />
      </span>
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

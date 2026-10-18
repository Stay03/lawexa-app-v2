'use client';

import { Boxes, Copy, FolderOutput, MoreVertical, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SpaceFile } from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/** What a reader may do to a space file; an absent handler is an absent item. */
export interface SpaceFileActions {
  onMove?: (file: SpaceFile) => void;
  onRemoveFromSpace?: (file: SpaceFile) => void;
  onCopyToMine?: (file: SpaceFile) => void;
  onDelete?: (file: SpaceFile) => void;
}

/**
 * SpaceFileMenu — a space file's ⋮ menu (Spaces F3, 12 October 2026), at the
 * top right of its card (`SpaceFileCard`, Stay, 18 October 2026: no row in the
 * list has a "…"; a file's actions are in its card's ⋮). An item appears
 * only when the host passes its handler: "Save a copy to my files" for every
 * member, "Move to space" for the file's uploader (its owner), "Remove from
 * space" for the space's Owner, and "Delete file" for the Owner or the
 * Contributor who uploaded it.
 */
export function SpaceFileMenu({
  file,
  onMove,
  onRemoveFromSpace,
  onCopyToMine,
  onDelete,
}: SpaceFileActions & { file: SpaceFile }) {
  return onMove || onRemoveFromSpace || onCopyToMine || onDelete ? (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'v2-interactive flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground',
          FOCUS_RING,
        )}
        aria-label={`More actions for ${file.original_name}`}
      >
        <MoreVertical aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      {/* 16px off the window's edges, so the last row is never cut at the bottom. */}
      <DropdownMenuContent align="end" collisionPadding={16}>
        {/* A copy the reader keeps, separate from the space's file (Stay,
            15 October 2026: a space file belongs to the space). */}
        {onCopyToMine ? (
          <DropdownMenuItem onSelect={() => onCopyToMine(file)}>
            <Copy />
            Save a copy to my files
          </DropdownMenuItem>
        ) : null}
        {onMove ? (
          <DropdownMenuItem onSelect={() => onMove(file)}>
            <Boxes />
            Move to space
          </DropdownMenuItem>
        ) : null}
        {onRemoveFromSpace ? (
          <DropdownMenuItem onSelect={() => onRemoveFromSpace(file)}>
            <FolderOutput />
            Remove from space
          </DropdownMenuItem>
        ) : null}
        {onDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(file)}>
              <Trash2 />
              Delete file
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;
}

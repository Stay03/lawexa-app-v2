'use client';

import { Boxes, Copy, FolderOutput, MoreHorizontal, Trash2 } from 'lucide-react';

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

/**
 * SpaceFileMenu — a space file's "…" menu (Spaces F3, 12 October 2026), in the
 * right column of its row in the space's list (`feed-rows`). An item appears
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
}: {
  file: SpaceFile;
  onMove?: (file: SpaceFile) => void;
  onRemoveFromSpace?: (file: SpaceFile) => void;
  onCopyToMine?: (file: SpaceFile) => void;
  onDelete?: (file: SpaceFile) => void;
}) {
  return onMove || onRemoveFromSpace || onCopyToMine || onDelete ? (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'v2-interactive flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground',
          FOCUS_RING,
        )}
        aria-label={`Actions for ${file.original_name}`}
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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

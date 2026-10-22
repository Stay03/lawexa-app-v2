'use client';

import { Boxes, Copy, FolderInput, FolderOutput, MoreHorizontal, MoreVertical, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SpaceFile } from '@/types/collab';
import { ROW_MENU_TRIGGER_CLASS } from '@/v2/features/folders/file-list/FileListRow';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/** What a reader may do to a space file; an absent handler is an absent item. */
export interface SpaceFileActions {
  /** File it in one of the space's folders: a file at the space's top level
   *  (Stay, 22 October 2026), for the Owner and Contributors. */
  onMoveToFolder?: (file: SpaceFile) => void;
  onMove?: (file: SpaceFile) => void;
  onRemoveFromSpace?: (file: SpaceFile) => void;
  onCopyToMine?: (file: SpaceFile) => void;
  onDelete?: (file: SpaceFile) => void;
}

/**
 * SpaceFileMenu — a space file's ⋮ menu (Spaces F3, 12 October 2026), at the
 * top right of its card (`SpaceFileCard`, Stay, 18 October 2026: no row in the
 * list has a "…"; a file's actions are in its card's ⋮). An item appears
 * only when the host passes its handler: "Move to folder" for a file in none
 * of the space's folders, for whoever may add to the space (Stay, 22 October
 * 2026), "Save a copy to my files" for every member, "Move to space" for the
 * file's uploader (its owner), "Remove from space" for the space's Owner,
 * and "Delete file" for the Owner or the Contributor who uploaded it.
 */
export function SpaceFileMenu({
  file,
  onMoveToFolder,
  onMove,
  onRemoveFromSpace,
  onCopyToMine,
  onDelete,
  look = 'card',
}: SpaceFileActions & {
  file: SpaceFile;
  /** The trigger: the card's round ⋮, or a file list row's ⋯ (a space's files
   *  in no folder, drawn as the Folders page draws its own; Stay, 22 October
   *  2026: "consistent with folders as is already"). */
  look?: 'card' | 'row';
}) {
  return onMoveToFolder || onMove || onRemoveFromSpace || onCopyToMine || onDelete ? (
    <DropdownMenu>
      {look === 'row' ? (
        <DropdownMenuTrigger
          className={cn(ROW_MENU_TRIGGER_CLASS, FOCUS_RING)}
          aria-label={`Actions for ${file.original_name}`}
        >
          <MoreHorizontal aria-hidden className="size-4" />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          className={cn(
            'v2-interactive flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground',
            FOCUS_RING,
          )}
          aria-label={`More actions for ${file.original_name}`}
        >
          <MoreVertical aria-hidden className="size-4" />
        </DropdownMenuTrigger>
      )}
      {/* 16px off the window's edges, so the last row is never cut at the bottom. */}
      <DropdownMenuContent align="end" collisionPadding={16}>
        {/* The file goes into one of the space's folders, and off the space's
            top level (the Folders page's own words for its loose files). */}
        {onMoveToFolder ? (
          <DropdownMenuItem onSelect={() => onMoveToFolder(file)}>
            <FolderInput />
            Move to folder
          </DropdownMenuItem>
        ) : null}
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

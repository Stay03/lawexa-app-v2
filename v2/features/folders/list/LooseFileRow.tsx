'use client';

import { memo } from 'react';
import { FolderInput, MoreHorizontal, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { formatEntryDate } from '../file-list/entry-look';
import { FileEntryRow } from '../file-list/FileEntryRow';
import { ROW_MENU_TRIGGER_CLASS } from '../file-list/FileListRow';
import type { LooseFileRowModel } from '../loose-file-row-model';

/**
 * LooseFileRow — one of the viewer's files that sits in no folder, on the
 * Folders page under the folders (build 6). One line of the same file list
 * the folders are in (folder page B, Stay, 20 October 2026): the kind's
 * coloured glyph, the name, and on a computer the date it was added.
 *
 * A tap opens the file (`FileEntryRow`, the open a filed file uses): a picture
 * in the list's viewer, a video or a recording in its player, anything else
 * in a new tab (`row.view`, 21 October 2026). The menu holds the two things
 * to do with a loose file: put it in a folder, or delete it. `memo` holds
 * because the callbacks are stable and the rest are values.
 */
export const LooseFileRow = memo(function LooseFileRow({
  row,
  index,
  now,
  onView,
  onMove,
  onDelete,
  selected,
  onToggleSelect,
}: {
  row: LooseFileRowModel;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  /** Frozen clock for the date column, so no `Date.now()` runs in render. */
  now: number;
  /** Open a row whose `view` is set, here. */
  onView: (row: LooseFileRowModel) => void;
  onMove: (row: LooseFileRowModel) => void;
  onDelete: (row: LooseFileRowModel) => void;
  /** Bulk select: the row ticks instead of opening. `onToggleSelect` must be stable. */
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
}) {
  return (
    <FileEntryRow
      fileId={row.id}
      kind={row.kind}
      name={row.title}
      named={row.hasTitle}
      date={formatEntryDate(row.createdAt, now)}
      index={index}
      select={onToggleSelect ? { checked: selected === true, onToggle: () => onToggleSelect(row.id) } : undefined}
      onView={row.view ? () => onView(row) : undefined}
      menu={
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(ROW_MENU_TRIGGER_CLASS, FOCUS_RING)}
            aria-label={`Actions for ${row.title}`}
          >
            <MoreHorizontal aria-hidden className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onMove(row)}>
              <FolderInput />
              Move to folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(row)}>
              <Trash2 />
              Delete file
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
});

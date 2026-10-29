'use client';

import { memo } from 'react';
import Link from 'next/link';
import { FolderInput, FolderMinus, MoreHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useRemoveFolderItem } from '../item-mutations';
import type { FolderItemFileRow, FolderItemRowModel } from '../item-row-model';
import { entryLook, formatEntryDate } from '../file-list/entry-look';
import { FileEntryRow } from '../file-list/FileEntryRow';
import { FileListRow, ROW_MENU_TRIGGER_CLASS } from '../file-list/FileListRow';

/**
 * FolderItemRow — one thing filed in this folder, whatever kind it is, as one
 * line of the folder's file list (folder page B, Stay, 20 October 2026, 00:49
 * UTC): the type's coloured glyph, the name, and on a computer the date it was
 * added. A case's citation, a statute's status, a note's author and a file's
 * size are on their own pages; the list is for finding the thing.
 *
 * A FILE OPENS IN A NEW TAB with a fresh link (`FileEntryRow`). v1 linked it to
 * `#`, and the payload's own `url` is presigned and expires within the hour.
 * A picture, a video or a recording opens HERE instead, in the folder's own
 * viewer or player (`row.view`, Stay, 21 October 2026: "should work in
 * folders and space folders").
 *
 * THE VERB IS "REMOVE FROM THIS FOLDER", NEVER "DELETE". Taking a case out of a
 * folder leaves the case where it was, so nothing here (icon, label or toast)
 * may suggest otherwise. The glyph is a folder losing something, not a bin.
 *
 * A FILE ALSO MOVES TO ANOTHER FOLDER (Stay, 22 October 2026): its menu
 * opens the picker, which files it there and takes it out of this folder,
 * for whoever may take items out. The other kinds sit in as many folders as
 * they are added to, so they keep the one verb.
 *
 * `memo` holds because every prop is a value and the callbacks are stable.
 */
export const FolderItemRow = memo(function FolderItemRow({
  row,
  folderUuid,
  canRemove,
  index,
  now,
  onView,
  selected,
  onToggleSelect,
  onStartSelect,
  onMoveToFolder,
}: {
  row: FolderItemRowModel;
  /** The folder this row is filed in — what the removal addresses. */
  folderUuid: string;
  /** Who may take items out (`FolderService::canManageItems`): anyone else's
   *  removal is refused with a 403, so they are not offered one. */
  canRemove: boolean;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  /** Frozen clock for the date column, so no `Date.now()` runs in render. */
  now: number;
  /** Open a file row whose `view` is set, here. */
  onView: (row: FolderItemFileRow) => void;
  /** Bulk select: the row ticks instead of opening (in a tab or in the
   *  viewer). `onToggleSelect` must be stable. */
  selected?: boolean;
  onToggleSelect?: (row: FolderItemRowModel) => void;
  /** Not selecting yet: the row's tick, on hover, starts it with this item
   *  ticked (computers only, `FileListRow`). Must be stable. */
  onStartSelect?: (row: FolderItemRowModel) => void;
  /** Move a file to another folder: opens the picker. Must be stable. */
  onMoveToFolder?: (row: FolderItemRowModel) => void;
}) {
  const date = formatEntryDate(row.addedAt, now);
  const menu = canRemove ? (
    <ItemMenu row={row} folderUuid={folderUuid} onMoveToFolder={onMoveToFolder} />
  ) : undefined;
  const select = onToggleSelect ? { checked: selected === true, onToggle: () => onToggleSelect(row) } : undefined;
  const startSelect = onStartSelect ? () => onStartSelect(row) : undefined;

  if (row.type === 'file') {
    return (
      <FileEntryRow
        fileId={row.contentId}
        kind={row.kind}
        name={row.title}
        named={row.hasTitle}
        date={date}
        index={index}
        menu={menu}
        select={select}
        onStartSelect={startSelect}
        onView={row.view ? () => onView(row) : undefined}
      />
    );
  }

  const href = row.href;
  return (
    <FileListRow
      look={entryLook({ type: row.type })}
      name={row.title}
      named={row.hasTitle}
      date={date}
      index={index}
      menu={menu}
      select={select}
      onStartSelect={startSelect}
      renderOpen={(className, content) =>
        href ? (
          <Link href={href} className={className}>
            {content}
          </Link>
        ) : (
          // A row with no destination records what is filed here and offers
          // nothing false.
          <div className={className}>{content}</div>
        )
      }
    />
  );
});

/**
 * The row's "⋯": take this one thing out of this one folder, or, for a file,
 * move it to another.
 *
 * ONE HOOK PER ROW: the mutation is scoped by the CONTENT
 * (`folder-item-case-11837`), so a removal, its undo and anything else touching
 * that item's folder membership are serialised, while two rows leave in
 * parallel.
 *
 * The press does not wait: the row is out of the list in the same frame (the
 * screen filters through `usePendingFolderItemRemovals`), and the hook raises
 * the undo toast that re-files it. The guard only stops a second press from
 * sending a second DELETE, which the server answers 404.
 */
function ItemMenu({
  row,
  folderUuid,
  onMoveToFolder,
}: {
  row: FolderItemRowModel;
  folderUuid: string;
  onMoveToFolder?: (row: FolderItemRowModel) => void;
}) {
  const remove = useRemoveFolderItem({ type: row.type, contentId: row.contentId });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(ROW_MENU_TRIGGER_CLASS, FOCUS_RING)}
        // Names the ROW, so moving down a column of these is not five
        // identical announcements.
        aria-label={`Actions for ${row.title}`}
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* The picker, which files it there and takes it out of here. */}
        {row.type === 'file' && onMoveToFolder ? (
          <DropdownMenuItem onSelect={() => onMoveToFolder(row)}>
            <FolderInput />
            Move to folder
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onSelect={() => {
            if (remove.isPending) return;
            remove.mutate({
              folderUuid,
              type: row.type,
              contentId: row.contentId,
              // What the undo toast names. `null` when the payload carried no
              // name, so the toast says so in words rather than print an empty
              // pair of quotes around the fallback.
              label: row.hasTitle ? row.title : null,
            });
          }}
        >
          <FolderMinus />
          Remove from this folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

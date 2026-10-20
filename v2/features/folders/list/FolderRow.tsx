'use client';

import { memo } from 'react';
import Link from 'next/link';

import { FolderActionsMenu } from '../FolderActionsMenu';
import type { FolderRowModel } from '../folder-row-model';
import { rememberFolderPeek } from '../folder-peek';
import { entryLook, formatEntryDate } from '../file-list/entry-look';
import { FileListRow } from '../file-list/FileListRow';
import { SpaceFolderMark, spaceFolderNote } from '../space-mark';

/**
 * FolderRow — one folder, as one line of a file list (folder page B, Stay, 20
 * October 2026, 00:49 UTC; "make it look like a clean file system", 00:54
 * UTC): the folder glyph, the name, and on a computer the date. No counts and
 * no Public mark under it; what a folder holds shows when it opens.
 *
 * The glyph is the one folder colour every folder shares: colour says the
 * type, on every list (Stay, 20 October 2026: "The colour should be for the
 * types. So there's consistency."). A folder's own legacy colour is not shown.
 *
 * The link wraps the line and the menu is its SIBLING, a control with its own
 * accessible name rather than a click the row has to swallow. The menu carries
 * the actions its host passes: `onRename` (Rename and Delete), `onMove` (the
 * folder's owner) and `onRemoveFromSpace`. No actions, no menu.
 *
 * `markSpace` (the personal Folders page): a folder in a Space wears the C1
 * mark, "In <Space>" on hover over it on a computer, and ", in <Space>" for a
 * screen reader (Stay picked C1, 20 October 2026). Inside a Space, or a Space
 * folder's own page, every folder is the Space's, so the mark would say nothing
 * and those lists leave it off.
 *
 * `memo` holds because every prop is a value or a callback the list memoises.
 */
export const FolderRow = memo(function FolderRow({
  row,
  index,
  now,
  onRename,
  onMove,
  onRemoveFromSpace,
  markSpace = false,
  selected,
  onToggleSelect,
}: {
  row: FolderRowModel;
  /** Mark a folder that sits in a Space (the personal Folders page). */
  markSpace?: boolean;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  /** Frozen clock for the date column — threaded from the browser's lazy
   *  `useState` so no `Date.now()` runs in render (React Compiler lint). */
  now: number;
  /** Opens the list's rename dialog for this folder. MUST be stable, or the
   *  `memo` above stops holding. Present = Rename and Delete in the menu. */
  onRename?: (row: FolderRowModel) => void;
  /** Opens the move-to-space dialog for this folder. Stable, like `onRename`. */
  onMove?: (row: FolderRowModel) => void;
  /** Opens the Remove from Space confirm. Stable, like `onRename`. */
  onRemoveFromSpace?: (row: FolderRowModel) => void;
  /** Bulk select: the row ticks instead of opening. `onToggleSelect` must be stable. */
  selected?: boolean;
  onToggleSelect?: (uuid: string) => void;
}) {
  const hasMenu =
    onRename !== undefined || onMove !== undefined || onRemoveFromSpace !== undefined;
  const space = markSpace ? row.spaceName : null;

  return (
    <FileListRow
      look={entryLook({ type: 'folder' })}
      name={row.name}
      named={row.hasName}
      date={formatEntryDate(row.trailAt, now)}
      index={index}
      iconMark={space ? <SpaceFolderMark spaceName={space} ground="row" tooltip /> : undefined}
      srNote={space ? spaceFolderNote(space) : undefined}
      select={onToggleSelect ? { checked: selected === true, onToggle: () => onToggleSelect(row.uuid) } : undefined}
      // The folder page draws this row's name at once, before any request
      // answers (`folder-peek.ts`, speed step 5).
      renderOpen={(className, content) => (
        <Link href={row.href} onClick={() => rememberFolderPeek(row)} className={className}>
          {content}
        </Link>
      )}
      menu={
        hasMenu ? (
          <FolderActionsMenu
            folder={{
              uuid: row.uuid,
              name: row.name,
              itemsCount: row.itemsCount,
              childrenCount: row.childrenCount,
            }}
            onRename={onRename ? () => onRename(row) : undefined}
            onMove={onMove ? () => onMove(row) : undefined}
            onRemoveFromSpace={onRemoveFromSpace ? () => onRemoveFromSpace(row) : undefined}
          />
        ) : undefined
      }
    />
  );
});

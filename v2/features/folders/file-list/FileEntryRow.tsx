'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useShowFileInNewTab } from '@/v2/features/channels/feed/use-file-url';
import { entryLook } from './entry-look';
import { FileListRow } from './FileListRow';

/**
 * A file's line in a folder list. A tap opens it in a new tab (v2 Stage 1,
 * item 4: "today the row opens nothing"). The tab opens inside the tap and the
 * fresh link follows, so an iPhone home-screen app lets it through
 * (`useShowFileInNewTab`, the open a file in a space uses, asking for a link
 * that shows the file).
 *
 * A FILE THAT SHOWS HERE OPENS HERE (Stay, 21 October 2026: "images should
 * open a gallery, videos should open gallery with 'play'"). The host passes
 * `onView` for a picture, a video or a recording, and the tap runs that
 * instead: the list's own viewer or player, over the list. Every other file
 * keeps its tab.
 *
 * Its refusals are the one line a file row may carry under its name: a file
 * that no longer exists says so, a refused open offers to try again.
 *
 * Shared by a folder's filed files and the Folders page's loose files, so a
 * file opens the same way in both.
 */
export function FileEntryRow({
  fileId,
  kind,
  name,
  named,
  date,
  index,
  menu,
  select,
  onStartSelect,
  onView,
}: {
  fileId: number;
  /** `fileKind`'s word ("PDF", "Word"), which picks the glyph's colour. */
  kind: string | null;
  name: string;
  named: boolean;
  date: string;
  index: number;
  menu?: ReactNode;
  /** Bulk select (`FileListRow`): the row is its tick box and a tap ticks it,
   *  so neither the tab nor `onView` runs while the list is being ticked. */
  select?: { checked: boolean; onToggle: () => void };
  /** Not selecting yet: the row's tick, on hover, starts it with this file ticked. */
  onStartSelect?: () => void;
  /** Open the file here (a viewer or a player over the list) instead of in a
   *  new tab; absent for a file that only a tab can show. */
  onView?: () => void;
}) {
  const { open, opening, failed, gone } = useShowFileInNewTab();
  return (
    <FileListRow
      look={entryLook({ type: 'file', kind })}
      name={name}
      named={named}
      date={date}
      index={index}
      menu={menu}
      select={select}
      onStartSelect={onStartSelect}
      renderOpen={(className, content) => (
        <button
          type="button"
          onClick={onView ?? (() => open(fileId))}
          aria-haspopup={onView ? 'dialog' : undefined}
          disabled={opening || gone}
          aria-busy={opening || undefined}
          className={cn(className, 'disabled:cursor-progress', gone && 'disabled:cursor-default')}
        >
          {content}
        </button>
      )}
      // The line under the name starts where the name does: past the tick
      // column too where the pointer can hover.
      below={
        gone ? (
          <p role="status" className="px-2 pb-2 pl-[2.375rem] [@media(hover:hover)]:pl-[4.625rem] text-xs text-muted-foreground">
            This file is no longer available.
          </p>
        ) : failed ? (
          <p role="status" className="px-2 pb-2 pl-[2.375rem] [@media(hover:hover)]:pl-[4.625rem] text-xs text-muted-foreground">
            Couldn&rsquo;t open it.{' '}
            <button
              type="button"
              onClick={() => open(fileId)}
              className={cn('rounded font-medium text-foreground underline underline-offset-2', FOCUS_RING)}
            >
              Try again
            </button>
          </p>
        ) : null
      }
    />
  );
}

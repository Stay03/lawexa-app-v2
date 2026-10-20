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
}: {
  fileId: number;
  /** `fileKind`'s word ("PDF", "Word"), which picks the glyph's colour. */
  kind: string | null;
  name: string;
  named: boolean;
  date: string;
  index: number;
  menu?: ReactNode;
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
      renderOpen={(className, content) => (
        <button
          type="button"
          onClick={() => open(fileId)}
          disabled={opening || gone}
          aria-busy={opening || undefined}
          className={cn(className, 'disabled:cursor-progress', gone && 'disabled:cursor-default')}
        >
          {content}
        </button>
      )}
      below={
        gone ? (
          <p role="status" className="px-2 pb-2 pl-[2.375rem] text-xs text-muted-foreground">
            This file is no longer available.
          </p>
        ) : failed ? (
          <p role="status" className="px-2 pb-2 pl-[2.375rem] text-xs text-muted-foreground">
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

'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useShowFileInNewTab } from '@/v2/features/channels/feed/use-file-url';

/**
 * A file's row opens it on tap, in a new tab (v2 Stage 1, item 4: "today the
 * row opens nothing"). The tab opens inside the tap and the fresh link follows,
 * so an iPhone home-screen app lets it through (`useShowFileInNewTab`, the
 * open a file in a space uses, asking for a link that shows the file). Its
 * refusals read under the name: a file that no longer exists says so, a
 * refused open offers to try again.
 *
 * Its own file so the Folders page's loose files (build 6) and a folder's
 * filed files open the same way, and the list does not load the folder page's
 * case and statute rows.
 */
export function FileOpenRow({ fileId, children }: { fileId: number; children: ReactNode }) {
  const { open, opening, failed, gone } = useShowFileInNewTab();
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <button
        type="button"
        onClick={() => open(fileId)}
        disabled={opening || gone}
        aria-busy={opening || undefined}
        className={cn(
          'v2-interactive flex min-w-0 flex-1 items-start gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-secondary/50 disabled:cursor-progress',
          gone && 'disabled:cursor-default',
          FOCUS_RING,
        )}
      >
        {children}
      </button>
      {gone ? (
        <p role="status" className="px-2 pb-2 pl-14 text-xs text-muted-foreground">
          This file is no longer available.
        </p>
      ) : failed ? (
        <p role="status" className="px-2 pb-2 pl-14 text-xs text-muted-foreground">
          Couldn&rsquo;t open it.{' '}
          <button
            type="button"
            onClick={() => open(fileId)}
            className={cn('rounded font-medium text-foreground underline underline-offset-2', FOCUS_RING)}
          >
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}

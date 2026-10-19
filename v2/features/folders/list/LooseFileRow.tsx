'use client';

import { memo } from 'react';
import { FileText, FolderInput, MoreHorizontal, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FOCUS_RING, formatRelativeTime } from '@/v2/shell/designs/modules';
import { FileOpenRow } from '../FileOpenRow';
import type { LooseFileRowModel } from '../loose-file-row-model';

/**
 * LooseFileRow — one of the viewer's files that sits in no folder, under the
 * folders on the Folders page (build 6, picture 6). The folder row's geometry
 * (the tile, the name, a meta line with a right-anchored trail, the "⋯" on
 * the tile's baseline), so the two lists read as one page.
 *
 * A tap opens the file (`FileOpenRow`, the open a filed file uses). The menu
 * holds the two things to do with a loose file: put it in a folder, or delete
 * it. `memo` holds because the callbacks are stable and the rest are values.
 */
export const LooseFileRow = memo(function LooseFileRow({
  row,
  index,
  now,
  onMove,
  onDelete,
}: {
  row: LooseFileRowModel;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  /** Frozen clock for "added N ago", so no `Date.now()` runs in render. */
  now: number;
  onMove: (row: LooseFileRowModel) => void;
  onDelete: (row: LooseFileRowModel) => void;
}) {
  const added = formatRelativeTime(row.createdAt, now);

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <div className="group relative flex min-w-0 items-start gap-2">
        <FileOpenRow fileId={row.id}>
          <span
            aria-hidden
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors group-hover:text-foreground"
          >
            <FileText className="size-[18px]" />
          </span>

          <span className="min-w-0 flex-1">
            <span
              className={cn(
                'block truncate text-[15px] font-medium transition-colors group-hover:text-primary',
                row.hasTitle ? 'text-foreground' : 'italic text-muted-foreground',
              )}
              title={row.title}
            >
              {row.title}
            </span>

            <span className="mt-1 flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {row.kind ? <span className="min-w-0 truncate">{row.kind}</span> : null}
                {row.kind && row.size ? (
                  <span aria-hidden className="shrink-0 text-muted-foreground/40">
                    ·
                  </span>
                ) : null}
                {row.size ? <span className="shrink-0 tabular-nums">{row.size}</span> : null}
              </span>
              {added ? <span className="shrink-0 tabular-nums">added {added}</span> : null}
            </span>
          </span>
        </FileOpenRow>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              // `mt-3.5` = the button's `py-3` plus the tile's `mt-0.5`, the
              // folder row's arithmetic, so the trigger sits on the tile's line.
              'v2-interactive mt-3.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground',
              FOCUS_RING,
            )}
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
      </div>
    </li>
  );
});

'use client';

import type { ReactNode } from 'react';
import { Download, FileText, Loader2, MoreHorizontal, Pencil, RotateCw, Trash2 } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { TemplateStatus } from '@/types/private-items';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { templateDetail, templateStatusLine } from './model';

export interface TemplateRowData {
  uuid: string;
  name: string;
  status: TemplateStatus;
  error: string | null;
  file: { original_name: string; size: number } | null;
  blanks_count: number | null;
}

/**
 * One template in a list: its name, how far Lawexa got reading it, the file
 * behind it, and its actions. Shared by My templates and Firm templates; a
 * firm member who may not manage sees Download only.
 */
export function TemplateRow({
  row,
  manage,
  onRename,
  onDownload,
  onRetry,
  onDelete,
  below,
}: {
  row: TemplateRowData;
  /** False for a firm member who is not an owner or admin. */
  manage: boolean;
  onRename: () => void;
  onDownload: () => void;
  onRetry: () => void;
  onDelete: () => void;
  /** Under the detail line (My templates: the "Always used in" chips; Firm: who added it). */
  below?: ReactNode;
}) {
  const reading = row.status === 'processing';
  const failed = row.status === 'failed';
  return (
    <li className="flex min-h-16 items-start gap-3.5 px-4 py-3">
      <FileText aria-hidden className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] leading-snug font-medium text-foreground">{row.name}</span>
        <span
          className={cn(
            'flex items-center gap-1.5 text-[13px] leading-snug',
            failed ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {reading ? <Loader2 aria-hidden className="size-3 animate-spin motion-reduce:animate-none" /> : null}
          <span className="min-w-0 truncate">
            {templateStatusLine(row.status, row.error)}
            {failed || !templateDetail(row.file, row.blanks_count) ? null : ` · ${templateDetail(row.file, row.blanks_count)}`}
          </span>
        </span>
        {below}
      </span>
      {/* No file and no right to manage: nothing to offer, so no menu. */}
      {row.file || manage ? (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${row.name}`}
          className={cn(
            'v2-interactive -mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
            FOCUS_RING,
          )}
        >
          <MoreHorizontal aria-hidden className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {row.file ? (
            <DropdownMenuItem onSelect={onDownload}>
              <Download />
              Download
            </DropdownMenuItem>
          ) : null}
          {manage ? (
            <>
              <DropdownMenuItem onSelect={onRename}>
                <Pencil />
                Rename
              </DropdownMenuItem>
              {failed ? (
                <DropdownMenuItem onSelect={onRetry}>
                  <RotateCw />
                  Try reading again
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      ) : null}
    </li>
  );
}

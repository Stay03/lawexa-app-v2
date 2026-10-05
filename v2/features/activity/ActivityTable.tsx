import Link from 'next/link';
import { ClipboardPaste, Paperclip, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { formatCount } from '@/v2/shell/pager-model';
import type { ActivityRow, AttachmentMark } from './model';

/**
 * The row heights, shared with the skeleton (`states.tsx`) so a loading page
 * and a loaded one stand exactly as tall: nothing below the table moves when
 * the rows land.
 */
export const TABLE_ROW_HEIGHT = 'h-14';
export const STACKED_ROW_HEIGHT = 'h-[4.25rem]';

/**
 * The column widths, shared with the skeleton. The row number a narrow fixed
 * width that fits "35,115"; the question takes what is left; the chat a fixed
 * share; the date and time a fixed width that fits "31 Dec 2025, 12:39 pm".
 */
export const TABLE_COLUMNS = (
  <colgroup>
    <col className="w-16" />
    <col />
    <col className="w-[30%]" />
    <col className="w-44" />
  </colgroup>
);

/** The icon for each kind of attachment mark. */
const MARK_ICON: Record<AttachmentMark['kind'], LucideIcon> = {
  pastes: ClipboardPaste,
  files: Paperclip,
};

/**
 * ActivityTable — one page of the reader's questions, newest first.
 *
 * TWO LAYOUTS OF THE SAME ROWS. From `md:` a real table: the question, the
 * chat it was asked in, and when. Below `md:` a three-column table squeezed
 * into 390px would cut every question to a few words, so each row stacks
 * instead: the question on its own line, the chat and the time under it. Both
 * render and CSS shows one; `hidden` removes the other from the accessibility
 * tree too, so a screen reader meets the rows once.
 *
 * The first column numbers the rows over the whole list, newest first, so
 * the numbers carry on across pages (21 to 30 on page 3): `firstNumber` is
 * the first row's number (`firstRowNumber`). On a phone the number leads the
 * question's line.
 *
 * Every question and every chat title links to the conversation. There is no
 * per-message anchor in the conversation screen yet, so a question opens its
 * chat at the bottom, where the conversation screen always opens.
 *
 * Rows fade in on mount only (`motion-safe`), keyed by message id: a new page
 * fades its rows in, a refetch that keeps a row does not replay it.
 */
export function ActivityTable({ rows, firstNumber }: { rows: readonly ActivityRow[]; firstNumber: number }) {
  return (
    <>
      <Table className="hidden table-fixed md:table">
        {TABLE_COLUMNS}
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <NumberHead />
            <TableHead className="h-10 text-xs font-medium text-muted-foreground">Question</TableHead>
            <TableHead className="h-10 text-xs font-medium text-muted-foreground">Chat</TableHead>
            <TableHead className="h-10 text-right text-xs font-medium text-muted-foreground">Asked</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={row.id}
              className={cn(
                TABLE_ROW_HEIGHT,
                'border-border/70 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
              )}
            >
              <TableCell className="py-0 pr-4 text-right text-xs text-muted-foreground tabular-nums">
                {formatCount(firstNumber + index)}
              </TableCell>
              <TableCell className="py-0">
                <Link
                  href={`/c/${row.conversationId}`}
                  className={cn('flex min-w-0 items-center gap-2 rounded-md', FOCUS_RING)}
                >
                  <QuestionLine row={row} />
                </Link>
              </TableCell>
              <TableCell className="py-0">
                <Link
                  href={`/c/${row.conversationId}`}
                  className={cn(
                    'block truncate rounded-md text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline',
                    FOCUS_RING,
                  )}
                >
                  {row.chatTitle}
                </Link>
              </TableCell>
              <TableCell className="py-0 text-right">
                <AskedAt row={row} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ul className="flex flex-col divide-y divide-border/70 border-y border-border/70 md:hidden">
        {rows.map((row, index) => (
          <li key={row.id} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            <Link
              href={`/c/${row.conversationId}`}
              className={cn(
                STACKED_ROW_HEIGHT,
                'v2-interactive flex flex-col justify-center gap-1 px-1 transition-colors active:bg-secondary/60',
                FOCUS_RING,
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatCount(firstNumber + index)}
                </span>
                <QuestionLine row={row} />
              </span>
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className="min-w-0 truncate">{row.chatTitle}</span>
                <span aria-hidden className="shrink-0">&middot;</span>
                <AskedAt row={row} className="shrink-0" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The question on one line, cut with an ellipsis, with what the reader
 * attached counted after it. A question that was only a paste or a file has
 * no words to print, so its marks read in full ("Pasted text"); one with
 * nothing left at all (only machinery tags) says so rather than leaving a
 * blank cell.
 */
function QuestionLine({ row }: { row: ActivityRow }) {
  const { preview, marks } = row;
  if (!preview.text) {
    return marks.length === 0 ? (
      <span className="truncate text-sm text-muted-foreground">Empty message</span>
    ) : (
      <span className="flex min-w-0 items-center gap-3 text-sm text-muted-foreground">
        {marks.map(({ kind, label }) => {
          const Icon = MARK_ICON[kind];
          return (
            <span key={kind} className="inline-flex shrink-0 items-center gap-1.5">
              <Icon aria-hidden className="size-3.5" />
              {label}
            </span>
          );
        })}
      </span>
    );
  }
  return (
    <>
      <span className="min-w-0 truncate text-sm text-foreground">{preview.text}</span>
      {marks.map(({ kind, label }) => {
        const Icon = MARK_ICON[kind];
        const count = kind === 'pastes' ? preview.pastes : preview.files;
        return (
          <span
            key={kind}
            title={label}
            className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground tabular-nums"
          >
            <Icon aria-hidden className="size-3.5" />
            {count > 1 ? count : null}
            <span className="sr-only">{label}</span>
          </span>
        );
      })}
    </>
  );
}

/** "28 Sep, 2:05 pm": the date, then the time in a quieter tone. */
function AskedAt({ row, className }: { row: ActivityRow; className?: string }) {
  return (
    <time dateTime={row.createdAt} className={cn('text-xs tabular-nums whitespace-nowrap', className)}>
      <span className="text-foreground/80">{row.date}</span>
      {row.date && row.time ? ', ' : null}
      <span className="text-muted-foreground">{row.time}</span>
    </time>
  );
}

/** The row-number column's head: "#" on screen, "Number" to a screen reader. */
export function NumberHead() {
  return (
    <TableHead className="h-10 pr-4 text-right text-xs font-medium text-muted-foreground">
      <span aria-hidden>#</span>
      <span className="sr-only">Number</span>
    </TableHead>
  );
}

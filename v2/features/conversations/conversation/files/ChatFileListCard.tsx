'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { ToolMessage } from '@/types/chat';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useSidePanel } from '../side-panel/SidePanelContext';
import { useToolResult } from '../tools/use-tool-result';
import { FileMark } from './FileMark';
import {
  FILE_LIST_VISIBLE,
  chatFileLine,
  chatFileList,
  fileCountLabel,
  fileListFoot,
  type ChatFileRow,
} from './chat-files';

/**
 * ChatFileListCard — the files a Lawexa step listed (list_files, search_files,
 * list_space_contents), as one compact card after the step chain (the file
 * list in chat, piece a; Stay, 23 October 2026). The reader sees what was
 * found without opening the step: each file's mark, name and "PDF · 1.2 MB ·
 * Ada", the first five, then "Show N more".
 *
 * A tap opens the file in the chat's side panel (`?side=file:ID`), beside the
 * chat on a computer and as the sheet below xl: the same panel and address
 * rules as a draft (SidePanelContext.tsx). The open file's row is marked.
 *
 * A chat loaded with lazy results carries no result data until it is asked
 * for, so the card asks (`useToolResult`), the read the quiz card makes.
 */
export function ChatFileListCard({ message }: { message: ToolMessage }) {
  const panel = useSidePanel();
  const loaded = useToolResult(message, message.toolStatus === 'complete');
  const list = chatFileList(loaded.message, panel?.space ?? null);
  const [expanded, setExpanded] = useState(false);

  if (loaded.status === 'loading') {
    return (
      <div aria-hidden className="my-2 space-y-2.5 rounded-2xl border border-border/60 p-3.5">
        <Skeleton className="h-3.5 w-1/3 rounded" />
        <Skeleton className="h-9 w-full rounded-xl" />
        <Skeleton className="h-9 w-full rounded-xl" />
      </div>
    );
  }
  if (!list) return null;

  const rows = expanded ? list.rows : list.rows.slice(0, FILE_LIST_VISIBLE);
  const foot = fileListFoot(list, expanded);
  const openId = panel?.target?.kind === 'file' && !panel.closing ? panel.target.id : null;

  return (
    <section
      aria-label={`${fileCountLabel(list.total)}${list.place ? ` in ${list.place}` : ''}`}
      className="my-2 overflow-hidden rounded-2xl border border-border bg-card motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
    >
      <header className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5 text-[13px]">
        <p className="min-w-0 flex-1 truncate text-muted-foreground">
          <span className="font-semibold text-foreground">{fileCountLabel(list.total)}</span>
          {list.place ? <> in {list.place}</> : null}
        </p>
        {list.space ? (
          <Link
            href={`/spaces/${list.space.uuid}`}
            className={cn('v2-interactive shrink-0 rounded font-semibold text-primary hover:underline', FOCUS_RING)}
          >
            Go to Space
          </Link>
        ) : null}
      </header>
      <ul className="divide-y divide-border/60">
        {rows.map((row) => (
          <li key={row.id}>
            <FileRow row={row} open={openId === row.id} onOpen={panel ? () => panel.open({ kind: 'file', id: row.id }) : null} />
          </li>
        ))}
      </ul>
      {foot.more > 0 || foot.unlisted > 0 ? (
        <div className="flex items-center gap-3 border-t border-border/60 px-3.5 py-2.5 text-[13px]">
          {foot.more > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className={cn('v2-interactive rounded font-semibold text-primary hover:underline', FOCUS_RING)}
            >
              Show {foot.more} more
            </button>
          ) : (
            <p className="text-muted-foreground">
              and {foot.unlisted} more {foot.unlisted === 1 ? 'file' : 'files'} Lawexa did not list
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** One file: its mark, name and type line. A button when the chat has the panel. */
function FileRow({ row, open, onOpen }: { row: ChatFileRow; open: boolean; onOpen: (() => void) | null }) {
  const body = (
    <>
      <FileMark kind={row.kind} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-snug font-semibold text-foreground">{row.name}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground tabular-nums">{chatFileLine(row)}</span>
      </span>
    </>
  );
  if (!onOpen) return <div className="flex items-center gap-3 px-3.5 py-2.5">{body}</div>;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={open}
      className={cn(
        'v2-interactive relative flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors',
        open ? 'bg-primary/[0.07]' : 'hover:bg-secondary/60',
        FOCUS_RING,
      )}
    >
      {open ? <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" /> : null}
      {body}
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground/60" />
    </button>
  );
}

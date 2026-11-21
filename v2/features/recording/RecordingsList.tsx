'use client';

import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { FileText, Loader2, Mic } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { recordingsApi } from '@/lib/api/recordings';
import { cn } from '@/lib/utils';
import type { Recording, RecordingListPage } from '@/types/recording';
import { useOpenFileInNewTab } from '@/v2/features/channels/feed/use-file-url';
import { formatEntryDate } from '@/v2/features/folders/file-list/entry-look';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { clock } from './recording-model';

const PAGE_SIZE = 20;

/** The person's recordings, newest first (GET /recordings). */
export const recordingsListQuery = {
  queryKey: ['recordings', 'list'] as const,
  queryFn: ({ pageParam }: { pageParam: number }): Promise<RecordingListPage> =>
    recordingsApi.list({ page: pageParam, per_page: PAGE_SIZE }),
  initialPageParam: 1,
  getNextPageParam: (last: RecordingListPage | undefined) =>
    last && last.pagination.current_page < last.pagination.last_page ? last.pagination.current_page + 1 : undefined,
};

/** Where a recording was made, as its row says it. */
function whereLine(recording: Recording): string | null {
  if (!recording.target) return null;
  return `${recording.target.type === 'space' ? 'Space' : 'Chat'}: ${recording.target.name}`;
}

/** The length, unless the title already ends with it ("Recording 21 Nov 2026, 04:46 UTC (0:46)"). */
function lengthWord(recording: Recording): string | null {
  if (recording.duration_seconds === null) return null;
  const length = clock(recording.duration_seconds);
  return recording.title.endsWith(`(${length})`) ? null : length;
}

/** Still being finished, or failed: said on the row instead of the transcript. */
function stageWord(recording: Recording): string | null {
  if (recording.stage === 'done') return null;
  if (recording.stage === 'failed') return 'Finishing failed';
  return 'Finishing';
}

function TranscriptButton({ recording }: { recording: Recording }) {
  const openInTab = useOpenFileInNewTab();
  const file = recording.transcript_file;
  if (!file) return null;
  const speakers = recording.speaker_count;
  return (
    <button
      type="button"
      onClick={() => (openInTab.ready ? openInTab.save() : openInTab.open(file.id, { name: file.name }))}
      disabled={openInTab.opening}
      className={cn(
        'v2-interactive hidden shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary sm:inline-flex',
        FOCUS_RING,
      )}
    >
      <FileText aria-hidden className="size-3.5 text-blue-600 dark:text-blue-400" />
      {openInTab.opening ? 'Opening…' : openInTab.ready ? 'Save transcript' : 'Transcript'}
      {speakers ? <span className="text-muted-foreground">· {speakers === 1 ? '1 speaker' : `${speakers} speakers`}</span> : null}
    </button>
  );
}

/**
 * The Files page's Recordings tab (thread ac47b1df; the design Stay OK'd on
 * 20 November 2026). One row per recording, not one per file: its title,
 * length, where it was recorded (a link there), its transcript and its date.
 */
export function RecordingsList({ now }: { now: number }) {
  const list = useInfiniteQuery(recordingsListQuery);
  const rows = list.data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  if (list.isPending) {
    return (
      <ul aria-busy className="mt-1 flex flex-col gap-3 py-3">
        {[0, 1, 2].map((key) => (
          <li key={key} className="flex items-center gap-3.5">
            <Skeleton className="size-10 rounded-xl" />
            <span className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (list.isError) {
    return (
      <div className="flex flex-col items-start gap-2 py-6 text-sm text-muted-foreground">
        Your recordings didn&rsquo;t load.
        <Button type="button" size="sm" variant="outline" onClick={() => void list.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <span aria-hidden className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Mic className="size-5" />
        </span>
        <p className="text-sm font-medium text-foreground">No recordings yet</p>
        <p className="max-w-xs text-[13px] text-muted-foreground">Record a meeting with the microphone beside Send in a chat. It appears here with its transcript.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="mt-1 flex flex-col divide-y divide-border/50">
        {rows.map((recording) => {
          const where = whereLine(recording);
          const stage = stageWord(recording);
          const details = [lengthWord(recording), where, stage].filter(Boolean).join(' · ');
          const title = (
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] leading-snug font-medium text-foreground">{recording.title}</span>
              <span className={cn('truncate text-[13px] leading-snug', recording.stage === 'failed' ? 'text-destructive' : 'text-muted-foreground')}>{details}</span>
            </span>
          );
          return (
            <li key={recording.uuid} className="flex items-center gap-3.5 py-3">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Mic className="size-[18px]" />
              </span>
              {recording.target ? (
                <Link href={recording.target.url} className={cn('flex min-w-0 flex-1 rounded-md', FOCUS_RING)}>
                  {title}
                </Link>
              ) : (
                title
              )}
              <TranscriptButton recording={recording} />
              <span className="hidden w-20 shrink-0 text-right text-[13px] text-muted-foreground md:block">{formatEntryDate(recording.created_at, now)}</span>
            </li>
          );
        })}
      </ul>
      {list.hasNextPage ? (
        <div className="flex justify-center py-4">
          <Button type="button" size="sm" variant="outline" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            {list.isFetchingNextPage ? <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : null}
            Load more
          </Button>
        </div>
      ) : null}
    </>
  );
}

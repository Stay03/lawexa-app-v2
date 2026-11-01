'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { PlansLink } from './PlansLink';
import { filesQueries } from './queries';
import { isReadingPages, SCAN_POLL_MS, scanLines } from './scan-reading';

/**
 * ScanReadingStatus — a scanned PDF's pages being read into text, under the
 * PDF reader's bar in both its hosts (the PDF dialog and the chat's side
 * panel). "Reading pages… 40 of 250" while the server reads them, asked again
 * every few seconds while the reader is open; the pages past the plan with the
 * way to the plans; and a line when some pages could not be read (Lawexa can
 * still look at those as pictures). A file with no scanned pages shows
 * nothing. The lines come from `scan-reading.ts`.
 *
 * It reads the file's own answer (`GET /files/{id}`, `filesQueries.detail`),
 * the entry the chat's side panel also holds, and ASKS AGAIN EACH TIME THE
 * READER OPENS: a fresh upload can answer before its reading has begun, and
 * an upgrade reads pages a cached "past your plan" still counts, so a kept
 * answer of up to 5 minutes would show neither (techlead's review,
 * 1 November 2026).
 *
 * A screen reader hears the start and the end (`announce`), not each count:
 * the live region stays mounted and the counting text sits outside it.
 */
export function ScanReadingStatus({ fileId, className }: { fileId: number; className?: string }) {
  const detail = useQuery({
    ...filesQueries.detail(fileId),
    select: (response) => response.data ?? null,
    refetchOnMount: 'always',
    refetchInterval: (query) => (isReadingPages(query.state.data?.data) ? SCAN_POLL_MS : false),
  });
  const lines = scanLines(detail.data);
  const shown = Boolean(lines.reading || lines.pastPlan || lines.unread);

  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {lines.announce}
      </span>
      {shown ? (
        <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground', className)}>
          {lines.reading ? (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Loader2 aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
              {lines.reading}
            </span>
          ) : null}
          {lines.pastPlan ? (
            <span>
              {lines.pastPlan}.{lines.plansLink ? (
                <>
                  {' '}
                  <PlansLink />
                </>
              ) : null}
            </span>
          ) : null}
          {lines.unread ? <span>{lines.unread}</span> : null}
        </div>
      ) : null}
    </>
  );
}

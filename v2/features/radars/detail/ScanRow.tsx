'use client';

import { memo } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Flag, Globe, Loader2, MoreHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatScanDuration } from '@/lib/utils/duration';
import type { RadarScan } from '@/types/radar';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { SCAN_STATUS, agoLabel, exactTime } from '../model';
import { ScanTriageMenuItems } from './triage-actions';

/**
 * ScanRow — THE scan row (decision D3's requirement: one component). Two
 * contexts of the same row, not two components:
 *
 *  `workflow`  the Inbox / Completed / Archived tabs — completed reports
 *              only, with unread weight, the priority flag, the shared badge,
 *              and the triage menu.
 *  `activity`  the All-activity view (the folded-in scan log) — EVERY
 *              attempt, so the status word leads, failures show their error
 *              in place, and a no-balance skip offers the top-up path. One
 *              duration format (`formatScanDuration`) in both contexts kills
 *              v1's scan-log drift.
 *
 * `memo` for the same reason as the list row: triage patches fan out across
 * cached lists.
 */
export const ScanRow = memo(function ScanRow({
  radarUuid,
  scan,
  context,
  now,
}: {
  radarUuid: string;
  scan: RadarScan;
  context: 'workflow' | 'activity';
  /** Frozen clock from the screen root. */
  now: number;
}) {
  const isUnread = scan.read_at === null;
  const readable = scan.status === 'completed';
  const timestamp =
    context === 'activity'
      ? (scan.started_at ?? scan.created_at)
      : (scan.completed_at ?? scan.created_at);
  const when = agoLabel(timestamp, now);
  const showError =
    context === 'activity' &&
    (scan.status === 'failed' || scan.status === 'skipped_no_balance') &&
    scan.error;

  const title = scan.title?.trim() || (readable ? 'Untitled report' : null);
  // An in-flight scan has no title YET — that is progress, not missing data,
  // so the title slot says so (the em-dash stays only for terminal rows that
  // genuinely never got one). The status chip remains the state carrier;
  // this copy matches `ScanInProgressRow`'s voice.
  const pendingLabel =
    scan.status === 'queued'
      ? 'Scan queued'
      : scan.status === 'running'
        ? 'Scan running…'
        : null;

  const body = (
    <>
      <span className="flex items-center gap-2">
        {context === 'workflow' ? (
          <>
            <span
              aria-hidden
              className={cn(
                'size-2 shrink-0 rounded-full',
                isUnread ? 'bg-primary' : 'bg-transparent',
              )}
            />
            {isUnread ? <span className="sr-only">Unread:</span> : null}
          </>
        ) : (
          <ScanStatusBadge status={scan.status} />
        )}
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-sm',
            context === 'workflow' && isUnread
              ? 'font-semibold text-foreground'
              : 'text-foreground',
            context === 'workflow' && !scan.has_findings &&
              'text-muted-foreground',
            context === 'activity' && !title && 'text-muted-foreground',
          )}
          title={scan.title ?? undefined}
        >
          {title ?? pendingLabel ?? '—'}
        </span>
        {context === 'workflow' && !scan.has_findings ? (
          <span className="inline-flex min-h-5 shrink-0 items-center rounded-full bg-secondary px-2 text-[11px] font-medium text-muted-foreground">
            No change
          </span>
        ) : null}
        {context === 'workflow' && !scan.is_private ? (
          <span className="inline-flex min-h-5 shrink-0 items-center gap-1 rounded-full border border-border px-2 text-[11px] font-medium text-muted-foreground">
            <Globe aria-hidden className="size-3" />
            Shared
          </span>
        ) : null}
        {scan.priority ? (
          <Flag
            aria-label="Priority"
            className="size-4 shrink-0 fill-amber-500 text-amber-500"
          />
        ) : null}
      </span>

      <span
        className={cn(
          'mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground',
          context === 'workflow' && 'pl-4',
        )}
      >
        {when ? <span title={exactTime(timestamp)}>{when}</span> : null}
        {scan.triggered_by === 'manual' ? (
          <MetaBadge>Manual</MetaBadge>
        ) : context === 'activity' ? (
          <MetaBadge>Schedule</MetaBadge>
        ) : null}
        {scan.duration_ms !== null ? (
          <span className="tabular-nums">
            {formatScanDuration(scan.duration_ms)}
          </span>
        ) : null}
      </span>

      {showError ? (
        <span className="mt-1 block text-xs text-destructive">
          {scan.error}
        </span>
      ) : null}
    </>
  );

  return (
    <li className="group relative flex items-start gap-2">
      {readable ? (
        <Link
          href={`/radars/${radarUuid}/scans/${scan.uuid}`}
          className={cn(
            'v2-interactive min-w-0 flex-1 rounded-lg px-2 py-3 transition-colors hover:bg-secondary/50',
            FOCUS_RING,
          )}
        >
          {body}
        </Link>
      ) : (
        <span className="min-w-0 flex-1 px-2 py-3">{body}</span>
      )}

      {/* A no-balance skip's one useful action, in the row that reports it. */}
      {context === 'activity' && scan.status === 'skipped_no_balance' ? (
        <Link
          href="/settings/message-packs"
          className={cn(
            'v2-interactive mt-3 inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10',
            FOCUS_RING,
          )}
        >
          Get messages
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      ) : null}

      {context === 'workflow' ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="mt-2 size-8 shrink-0 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 max-sm:opacity-100 motion-reduce:transition-none"
              aria-label={`Actions for ${title ?? 'this report'}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ScanTriageMenuItems radarUuid={radarUuid} scan={scan} />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
});

function MetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-5 items-center rounded-full border border-border px-1.5 text-[10px] font-medium">
      {children}
    </span>
  );
}

/** The activity view's status mark — the word carries the meaning. */
function ScanStatusBadge({ status }: { status: RadarScan['status'] }) {
  const config = SCAN_STATUS[status];
  return (
    <span
      className={cn(
        'inline-flex min-h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium',
        config.tone === 'neutral' && 'bg-secondary text-muted-foreground',
        config.tone === 'running' && 'bg-primary/10 text-primary',
        config.tone === 'positive' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        config.tone === 'negative' && 'bg-destructive/10 text-destructive',
      )}
    >
      {config.tone === 'running' ? (
        <Loader2 aria-hidden className="size-3 animate-spin" />
      ) : null}
      {config.label}
    </span>
  );
}

/**
 * A live inbox row for a queued/running scan — rendered WHERE its report will
 * land, so the in-flight state is part of the list rather than a floating
 * banner (v1's proven shape).
 */
export function ScanInProgressRow({ firstScan = false }: { firstScan?: boolean }) {
  return (
    <li className="flex items-center gap-3 px-2 py-3">
      <span aria-hidden className="relative flex size-2 shrink-0">
        <span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {firstScan ? 'Running the first scan…' : 'Scanning…'}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Checking updates from verified sources. Your report will be ready
          shortly.
        </span>
      </span>
      <Loader2
        aria-hidden
        className="size-4 shrink-0 animate-spin text-muted-foreground"
      />
    </li>
  );
}

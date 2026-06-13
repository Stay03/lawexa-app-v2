'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Flag, MoreHorizontal } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScanTriageActions } from './ScanTriageActions';
import { cn } from '@/lib/utils';
import { formatScanDuration } from '@/lib/utils/duration';
import type { RadarScan } from '@/types/radar';

interface ScanRowProps {
  radarUuid: string;
  scan: RadarScan;
}

/**
 * One inbox row: unread rows are bold with a dot, no-findings rows are muted
 * "no change" reports, priority rows carry an amber flag.
 */
function ScanRow({ radarUuid, scan }: ScanRowProps) {
  const isUnread = scan.read_at === null;
  const timestamp = scan.completed_at ?? scan.created_at;

  return (
    <div className="group relative flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/40">
      <span
        className={cn(
          'size-2 shrink-0 rounded-full',
          isUnread ? 'bg-primary' : 'bg-transparent'
        )}
        aria-hidden
      />

      <Link
        href={`/radars/${radarUuid}/scans/${scan.uuid}`}
        className="min-w-0 flex-1"
      >
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'truncate text-sm',
              isUnread ? 'font-semibold text-foreground' : 'font-normal',
              !scan.has_findings && 'text-muted-foreground'
            )}
          >
            {scan.title ?? 'Untitled report'}
          </p>
          {!scan.has_findings && (
            <Badge variant="ghost" className="shrink-0">
              No change
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
          </span>
          {scan.triggered_by === 'manual' && (
            <Badge variant="outline">Manual</Badge>
          )}
          {scan.duration_ms !== null && (
            <span>{formatScanDuration(scan.duration_ms)}</span>
          )}
        </div>
      </Link>

      {scan.priority && (
        <Flag
          className="size-4 shrink-0 fill-amber-500 text-amber-500"
          aria-label="Priority"
        />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 max-sm:opacity-100"
            aria-label="Report actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <ScanTriageActions radarUuid={radarUuid} scan={scan} variant="menu" />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { ScanRow };

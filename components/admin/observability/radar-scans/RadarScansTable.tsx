'use client';

import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ObservabilityTable,
  StatusBadge,
  TimeAgoCell,
  ErrorCell,
  type ObservabilityColumn,
} from '@/components/admin/observability';
import { radarScanStatusMeta, formatDuration } from './radar-scan-status';
import type { RadarScan } from '@/types/admin-radar-scans';

const COLUMNS: ObservabilityColumn[] = [
  { key: 'radar', label: 'Radar', className: 'w-[280px]' },
  { key: 'status', label: 'Status', className: 'w-[130px]' },
  { key: 'trigger', label: 'Trigger', className: 'w-[100px]' },
  { key: 'result', label: 'Result' },
  { key: 'duration', label: 'Duration', className: 'w-[100px]' },
  { key: 'created', label: 'Started', className: 'w-[140px]' },
];

function RadarCell({ scan }: { scan: RadarScan }) {
  if (!scan.radar) {
    return <span className="text-sm text-muted-foreground italic">Radar removed</span>;
  }
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="truncate text-sm font-medium">{scan.radar.name}</span>
        {scan.radar.deleted_at && (
          <Badge
            variant="outline"
            className="shrink-0 border-transparent bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
          >
            radar deleted
          </Badge>
        )}
      </div>
      {scan.radar.user && (
        <p className="truncate text-xs text-muted-foreground">
          {scan.radar.user.name} · {scan.radar.user.email}
        </p>
      )}
    </div>
  );
}

function ResultCell({ scan }: { scan: RadarScan }) {
  if (scan.status === 'completed') {
    return scan.has_findings ? (
      <Badge
        variant="outline"
        className="border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
      >
        Findings
      </Badge>
    ) : (
      <span className="text-sm text-muted-foreground">No findings</span>
    );
  }
  if (scan.status === 'failed') return <ErrorCell error={scan.error} />;
  if (scan.status === 'skipped_no_balance')
    return <span className="text-sm text-muted-foreground">Owner had no message balance</span>;
  return <span className="text-sm text-muted-foreground">—</span>;
}

interface RadarScansTableProps {
  scans: RadarScan[];
  isLoading: boolean;
}

export function RadarScansTable({ scans, isLoading }: RadarScansTableProps) {
  return (
    <ObservabilityTable
      columns={COLUMNS}
      isLoading={isLoading}
      isEmpty={scans.length === 0}
      emptyText="No scans found"
    >
      {scans.map((scan, index) => (
        <TableRow key={scan.id} className={cn(index % 2 === 1 && 'bg-muted/20')}>
          <TableCell className="max-w-[280px]">
            <RadarCell scan={scan} />
          </TableCell>
          <TableCell>
            <StatusBadge meta={radarScanStatusMeta(scan.status)} />
          </TableCell>
          <TableCell>
            <Badge variant="secondary" className="font-normal capitalize">
              {scan.triggered_by}
            </Badge>
          </TableCell>
          <TableCell className="max-w-[320px]">
            <ResultCell scan={scan} />
          </TableCell>
          <TableCell>
            <span className="text-sm tabular-nums text-muted-foreground">
              {formatDuration(scan.duration_ms)}
            </span>
          </TableCell>
          <TableCell>
            <TimeAgoCell value={scan.started_at ?? scan.created_at} />
          </TableCell>
        </TableRow>
      ))}
    </ObservabilityTable>
  );
}

'use client';

import Link from 'next/link';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { makeStatusMeta } from '@/lib/utils/observability';
import {
  ObservabilityTable,
  StatusBadge,
  UserCell,
  TimeAgoCell,
  ErrorCell,
  type ObservabilityColumn,
} from '@/components/admin/observability';
import type { StatuteImport, StatuteImportStatus } from '@/types/admin-statute-imports';

const importStatusMeta = makeStatusMeta<StatuteImportStatus>({
  pending: { label: 'Pending', tone: 'neutral' },
  processing: { label: 'Processing', tone: 'info', spinning: true },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
});

const COLUMNS: ObservabilityColumn[] = [
  { key: 'file', label: 'File', className: 'w-[240px]' },
  { key: 'creator', label: 'Creator', className: 'w-[190px]' },
  { key: 'status', label: 'Status', className: 'w-[130px]' },
  { key: 'progress', label: 'Progress / Result' },
  { key: 'updated', label: 'Updated', className: 'w-[140px]' },
];

function WarningsBadge({ warnings }: { warnings: string[] | null }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className="cursor-help gap-1 border-transparent bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
        >
          <AlertCircle className="h-3 w-3" />
          {warnings.length} warning{warnings.length === 1 ? '' : 's'}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[400px]">
        <ul className="list-disc space-y-0.5 pl-4 text-xs">
          {warnings.slice(0, 8).map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function ProgressCell({ imp }: { imp: StatuteImport }) {
  if (imp.status === 'processing') {
    const total = imp.total_nodes ?? 0;
    const done = imp.processed_nodes ?? 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
      <div className="max-w-[280px] space-y-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {done.toLocaleString()} / {total.toLocaleString()} nodes ({pct}%)
        </p>
      </div>
    );
  }
  if (imp.status === 'completed') {
    return (
      <div className="flex items-center gap-2">
        {imp.statute ? (
          <Link
            href={`/admin/statutes/${imp.statute.slug}`}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {imp.statute.title}
            <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">Done</span>
        )}
        <WarningsBadge warnings={imp.warnings} />
      </div>
    );
  }
  if (imp.status === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <ErrorCell error={imp.error_message} />
        <WarningsBadge warnings={imp.warnings} />
      </div>
    );
  }
  return <span className="text-sm text-muted-foreground">—</span>;
}

interface StatuteImportsTableProps {
  imports: StatuteImport[];
  isLoading: boolean;
}

export function StatuteImportsTable({ imports, isLoading }: StatuteImportsTableProps) {
  return (
    <ObservabilityTable
      columns={COLUMNS}
      isLoading={isLoading}
      isEmpty={imports.length === 0}
      emptyText="No imports found"
    >
      {imports.map((imp, index) => (
        <TableRow key={imp.id} className={cn(index % 2 === 1 && 'bg-muted/20')}>
          <TableCell className="max-w-[240px]">
            <span className="block truncate text-sm font-medium">
              {imp.original_filename ?? '—'}
            </span>
          </TableCell>
          <TableCell>
            <UserCell user={imp.creator} />
          </TableCell>
          <TableCell>
            <StatusBadge meta={importStatusMeta(imp.status)} />
          </TableCell>
          <TableCell>
            <ProgressCell imp={imp} />
          </TableCell>
          <TableCell>
            <TimeAgoCell value={imp.updated_at} />
          </TableCell>
        </TableRow>
      ))}
    </ObservabilityTable>
  );
}

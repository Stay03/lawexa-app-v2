'use client';

import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { Eye } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { EnrichmentStatusBadge, EnrichmentTriggerBadge } from './EnrichmentBadges';
import type { CaseEnrichmentRun, EnrichmentStats } from '@/types/admin-case-enrichments';

interface EnrichmentRunsTableProps {
  runs: CaseEnrichmentRun[];
  isLoading: boolean;
  onView: (run: CaseEnrichmentRun) => void;
}

/** Human summary of what a run wrote, e.g. "3 principles · 2 statutes". */
export function summarizeStats(stats: EnrichmentStats | null, status: string): string {
  if (!stats) return '—';
  if (status === 'skipped') {
    if (stats.reason === 'already_enriched') return 'Already enriched';
    if (stats.reason === 'no_full_report') return 'No full report';
    return 'Skipped';
  }
  const parts: string[] = [];
  const push = (n: number | undefined, singular: string) => {
    if (n && n > 0) parts.push(`${n} ${n === 1 ? singular : `${singular}s`}`);
  };
  push(stats.principles, 'principle');
  push(stats.citations, 'citation');
  push(stats.statutes, 'statute');
  push(stats.histories, 'history');
  if (stats.scalars && stats.scalars.length > 0) {
    parts.push(`${stats.scalars.length} scalar${stats.scalars.length === 1 ? '' : 's'}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Nothing new';
}

export function EnrichmentRunsTable({ runs, isLoading, onView }: EnrichmentRunsTableProps) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-semibold">Case</TableHead>
              <TableHead className="w-[110px] font-semibold">Trigger</TableHead>
              <TableHead className="w-[130px] font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Result</TableHead>
              <TableHead className="w-[150px] font-semibold">Finished</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} style={{ opacity: [1, 0.8, 0.5, 0.25, 0.1][i] ?? 0.1 }}>
                {Array.from({ length: 6 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No enrichment runs found
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="font-semibold">Case</TableHead>
            <TableHead className="w-[110px] font-semibold">Trigger</TableHead>
            <TableHead className="w-[130px] font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Result</TableHead>
            <TableHead className="w-[150px] font-semibold">Finished</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run, index) => (
            <TableRow key={run.id} className={cn(index % 2 === 1 && 'bg-muted/20')}>
              {/* Case */}
              <TableCell className="max-w-[280px]">
                {run.case ? (
                  <Link
                    href={`/admin/cases/${run.case.slug}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {run.case.title}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">Deleted case</span>
                )}
              </TableCell>

              {/* Trigger */}
              <TableCell>
                <EnrichmentTriggerBadge trigger={run.trigger} />
              </TableCell>

              {/* Status */}
              <TableCell>
                <EnrichmentStatusBadge status={run.status} />
              </TableCell>

              {/* Result: stats or error */}
              <TableCell className="max-w-[320px]">
                {run.status === 'failed' && run.error ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block truncate text-sm text-destructive cursor-help">
                        {run.error}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[400px]">
                      <p className="whitespace-pre-wrap text-xs">{run.error}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">
                      {summarizeStats(run.stats, run.status)}
                    </span>
                    {run.outcome_raw && (
                      <Badge
                        variant="outline"
                        className="border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                      >
                        Unmapped outcome
                      </Badge>
                    )}
                  </div>
                )}
              </TableCell>

              {/* Finished */}
              <TableCell>
                {run.finished_at ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm text-muted-foreground cursor-help">
                        {formatDistanceToNow(new Date(run.finished_at), { addSuffix: true })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{format(new Date(run.finished_at), 'PPpp')}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>

              {/* Actions */}
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onView(run)}
                  aria-label="View run details"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

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
import { partsProgress } from './chunks';
import type { CaseEnrichmentRun, EnrichmentStats } from '@/types/admin-case-enrichments';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';

interface EnrichmentRunsTableProps {
  runs: CaseEnrichmentRun[];
  isLoading: boolean;
  onView: (run: CaseEnrichmentRun) => void;
  /**
   * Link each row to every run of its case. On the stopped list a row is the
   * partial run the sweep read, and the failed runs behind the stop are not in
   * that list.
   */
  showCaseRunsLink?: boolean;
}

/** Human summary of what a run wrote, e.g. "3 principles · 2 statutes". */
export function summarizeStats(stats: EnrichmentStats | null, status: string): string {
  // A running run carries only its plan; what it wrote arrives when it ends.
  if (!stats || status === 'running') return '—';
  if (status === 'skipped') {
    if (stats.reason === 'already_enriched') return 'Already enriched';
    if (stats.reason === 'no_full_report') return 'No full report';
    if (stats.reason === 'already_running') return 'Already running';
    if (stats.reason === 'superseded') return 'Overtaken by another run';
    return 'Skipped';
  }
  const parts: string[] = [];
  const push = (n: number | undefined, singular: string, plural = `${singular}s`) => {
    if (n && n > 0) parts.push(`${n} ${n === 1 ? singular : plural}`);
  };
  push(stats.principles, 'principle');
  push(stats.citations, 'citation');
  push(stats.statutes, 'statute');
  push(stats.histories, 'history', 'histories');
  if (stats.scalars && stats.scalars.length > 0) {
    parts.push(`${stats.scalars.length} scalar${stats.scalars.length === 1 ? '' : 's'}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Nothing new';
}

/**
 * The result column: for a partial run, how much of the report has been read,
 * then what the run wrote. Only a partial run says it. A failed or running run
 * has no list of parts read, where "0 of 3 parts read" would look like
 * progress, and a completed run has read every part.
 */
function resultSummary(run: CaseEnrichmentRun): string {
  const written = summarizeStats(run.stats, run.status);
  const progress = run.status === 'partial' ? partsProgress(run.stats) : null;
  if (!progress || progress.read === null || progress.read >= progress.total) return written;
  return `${progress.read} of ${progress.total} parts read · ${written}`;
}

export function EnrichmentRunsTable({
  runs,
  isLoading,
  onView,
  showCaseRunsLink = false,
}: EnrichmentRunsTableProps) {
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
                  <>
                    <Link
                      href={`/admin/cases/${run.case.slug}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {getCaseDisplayTitle(run.case)}
                    </Link>
                    {showCaseRunsLink && (
                      <Link
                        href={`/admin/cases/enrichments?case_id=${run.case.id}`}
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        All runs of this case
                      </Link>
                    )}
                  </>
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

              {/* Result: stats or error. It wraps, because a partial run's
                  summary is longer than the column and would run into Finished. */}
              <TableCell className="max-w-[320px] whitespace-normal">
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
                      {resultSummary(run)}
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

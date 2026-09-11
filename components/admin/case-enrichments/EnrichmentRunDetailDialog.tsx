'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { EnrichmentStatusBadge, EnrichmentTriggerBadge } from './EnrichmentBadges';
import { summarizeStats } from './EnrichmentRunsTable';
import {
  chunkRecord,
  partErrors,
  partLabel,
  partsProgress,
  withheldScalars,
  withheldText,
} from './chunks';
import type { CaseEnrichmentRun } from '@/types/admin-case-enrichments';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';

interface EnrichmentRunDetailDialogProps {
  run: CaseEnrichmentRun | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm">{children}</dd>
    </div>
  );
}

export function EnrichmentRunDetailDialog({
  run,
  open,
  onOpenChange,
}: EnrichmentRunDetailDialogProps) {
  const record = run ? chunkRecord(run.stats) : null;
  const progress = run ? partsProgress(run.stats) : null;
  const errors = record ? partErrors(record) : [];
  const withheld = record ? withheldScalars(record) : [];
  // A first read asks for every part; only a resume asks for some of them.
  const askedForSome =
    progress !== null &&
    progress.requested.length > 0 &&
    progress.requested.length < progress.total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enrichment run #{run?.id}</DialogTitle>
          <DialogDescription>
            One AI enrichment attempt and what it wrote.
          </DialogDescription>
        </DialogHeader>

        {run && (
          <dl className="divide-y divide-border">
            <Row label="Case">
              {run.case ? (
                <Link
                  href={`/admin/cases/${run.case.slug}`}
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                >
                  {getCaseDisplayTitle(run.case)}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                <span className="text-muted-foreground">Deleted case</span>
              )}
            </Row>
            <Row label="Status">
              <EnrichmentStatusBadge status={run.status} />
            </Row>
            <Row label="Trigger">
              <EnrichmentTriggerBadge trigger={run.trigger} />
            </Row>
            {progress && progress.resumes !== null && (
              <Row label="Continues">Run #{progress.resumes}</Row>
            )}
            <Row label="Result">{summarizeStats(run.stats, run.status)}</Row>
            {run.stats?.scalars && run.stats.scalars.length > 0 && (
              <Row label="Scalars written">
                <div className="flex flex-wrap gap-1">
                  {run.stats.scalars.map((s) => (
                    <Badge key={s} variant="secondary" className="font-mono text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </Row>
            )}
            {progress && (
              <Row label="Parts read">
                {progress.read} of {progress.total}
              </Row>
            )}
            {progress && askedForSome && (
              <Row label="Asked for">{progress.requested.map(partLabel).join(', ')}</Row>
            )}
            {progress && progress.missing.length > 0 && (
              <Row label="Missing parts">
                <div className="flex flex-wrap gap-1">
                  {progress.missing.map((index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border-transparent bg-amber-100 font-normal text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    >
                      {partLabel(index)}
                    </Badge>
                  ))}
                </div>
              </Row>
            )}
            {errors.length > 0 && (
              <Row label="Part errors">
                <ul className="space-y-1.5">
                  {errors.map((entry, i) => (
                    <li key={`${entry.chunk}-${i}`} className="whitespace-pre-wrap text-destructive">
                      <span className="font-medium">{partLabel(entry.chunk)}:</span>{' '}
                      {String(entry.error)}
                    </li>
                  ))}
                </ul>
              </Row>
            )}
            {withheld.length > 0 && (
              <Row label="Withheld values">
                <ul className="space-y-1.5">
                  {withheld.map(([field, held]) => (
                    <li key={field}>
                      <span className="font-mono text-xs">{field}</span>{' '}
                      {withheldText(held.value)}
                      <span className="text-muted-foreground">
                        {' '}
                        · from {partLabel(held.chunk).toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Each waits until the parts before it are read.
                </p>
              </Row>
            )}
            {run.outcome_raw && (
              <Row label="Unmapped outcome">
                <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  {run.outcome_raw}
                </span>
              </Row>
            )}
            {run.error && (
              <Row label="Error">
                <p className="whitespace-pre-wrap text-destructive">{run.error}</p>
              </Row>
            )}
            <Row label="Started">
              {run.started_at ? format(new Date(run.started_at), 'PPpp') : '—'}
            </Row>
            <Row label="Finished">
              {run.finished_at ? format(new Date(run.finished_at), 'PPpp') : '—'}
            </Row>
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}

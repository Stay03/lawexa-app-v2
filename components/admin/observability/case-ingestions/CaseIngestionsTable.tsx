'use client';

import Link from 'next/link';
import { Eye, ExternalLink, Copy } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ObservabilityTable,
  StatusBadge,
  UserCell,
  TimeAgoCell,
  ErrorCell,
  type ObservabilityColumn,
} from '@/components/admin/observability';
import { ingestionStatusMeta } from './ingestion-status';
import { sourceFormatLabel, isProviderFetch } from './source-format';
import { duplicateRefs } from './duplicates';
import type { CaseIngestion } from '@/types/admin-case-ingestions';

/* ONE "Source" COLUMN RATHER THAN TWO NEW ONES.
   A provider fetch has no file and an upload has no provider id, so a `file`
   column plus a `provider case id` column would each be empty on half the rows
   and push an already-scrolling table two columns wider. One column carries
   whichever identifier the row actually has, under a badge naming where it came
   from — which is also the thing being filtered on just above the table.
   `Uploader` is now `Requested by`: every job has a user, but on a provider
   fetch that person asked for an import rather than uploading anything. */
const COLUMNS: ObservabilityColumn[] = [
  { key: 'source', label: 'Source' },
  { key: 'user', label: 'Requested by', className: 'w-[200px]' },
  { key: 'country', label: 'Country', className: 'w-[110px]' },
  { key: 'status', label: 'Status', className: 'w-[130px]' },
  { key: 'result', label: 'Result', className: 'w-[240px]' },
  { key: 'created', label: 'Created', className: 'w-[140px]' },
  { key: 'actions', label: '', className: 'w-[52px]' },
];

interface CaseIngestionsTableProps {
  ingestions: CaseIngestion[];
  isLoading: boolean;
  onView: (ingestion: CaseIngestion) => void;
}

/** The held case a duplicate job stopped for, linked when there is a slug. */
function DuplicateOf({ job }: { job: CaseIngestion }) {
  const ref = job.result?.duplicate_of;
  if (!ref) return <span className="text-sm text-muted-foreground">already held</span>;
  const label = ref.case_title ?? `case ${ref.case_id}`;
  return ref.case_slug ? (
    <Link
      href={`/admin/cases/${ref.case_slug}`}
      className="inline-flex items-center gap-1 truncate text-sm text-primary hover:underline"
    >
      {label}
      <ExternalLink className="h-3 w-3 shrink-0" />
    </Link>
  ) : (
    <span className="truncate text-sm">{label}</span>
  );
}

export function CaseIngestionsTable({
  ingestions,
  isLoading,
  onView,
}: CaseIngestionsTableProps) {
  return (
    <ObservabilityTable
      columns={COLUMNS}
      isLoading={isLoading}
      isEmpty={ingestions.length === 0}
      emptyText="No ingestion jobs found"
    >
      {ingestions.map((job, index) => (
        <TableRow key={job.id} className={cn(index % 2 === 1 && 'bg-muted/20')}>
          <TableCell className="max-w-[280px]">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="shrink-0 font-normal">
                {sourceFormatLabel(job.source_format)}
              </Badge>
              {/* The identifier the row actually has. A provider fetch is only
                  identifiable by its provider id until the case exists, so that
                  is shown verbatim and in mono — it is a key someone copies. */}
              {isProviderFetch(job.source_format) ? (
                job.provider_case_id ? (
                  <span className="block truncate font-mono text-xs">{job.provider_case_id}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">no provider id</span>
                )
              ) : (
                <span className="block truncate text-sm font-medium">
                  {job.report_file_name ?? '—'}
                </span>
              )}
            </div>
          </TableCell>
          <TableCell>
            <UserCell user={job.user} />
          </TableCell>
          <TableCell>
            <span className="text-sm">{job.country?.name ?? '—'}</span>
          </TableCell>
          <TableCell>
            <StatusBadge meta={ingestionStatusMeta(job.status)} />
          </TableCell>
          <TableCell className="max-w-[240px]">
            {job.status === 'duplicate' ? (
              /* No case was created, so there is nothing to link to but the
                 case we already hold. Naming it here saves opening the row to
                 find out what the job decided. */
              <DuplicateOf job={job} />
            ) : job.status === 'completed' && job.result?.case_slug ? (
              <div className="space-y-1">
                <Link
                  href={`/admin/cases/${job.result.case_slug}`}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  View case
                  <ExternalLink className="h-3 w-3" />
                </Link>
                {/* The case WAS created and the ingest still thinks we hold it
                    already. Nothing refused it, so the only thing standing
                    between that and a duplicate in the library is somebody
                    seeing this line. */}
                {duplicateRefs(job).length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                    <Copy className="h-3 w-3 shrink-0" />
                    {duplicateRefs(job).length === 1
                      ? 'may already be held'
                      : `may already be held, ${duplicateRefs(job).length} matches`}
                  </span>
                )}
              </div>
            ) : job.status === 'failed' ? (
              <div className="flex items-center gap-1.5">
                {job.status_code != null && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {job.status_code}
                  </Badge>
                )}
                <ErrorCell error={job.error} />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </TableCell>
          <TableCell>
            <TimeAgoCell value={job.created_at} />
          </TableCell>
          <TableCell>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onView(job)}
              aria-label="View ingestion details"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </ObservabilityTable>
  );
}

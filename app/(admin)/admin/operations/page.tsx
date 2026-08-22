'use client';

import Link from 'next/link';
import { Activity, FileText, FileSearch, Radar, FileCode2, ArrowRight } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import {
  JobHealthCard,
  SystemHealthPanel,
  type JobHealthCount,
} from '@/components/admin/observability';
import { useSystemHealth } from '@/lib/hooks/useSystemHealth';
import { useCaseIngestionSummary } from '@/lib/hooks/useAdminCaseIngestions';
import { useFileExtractionSummary } from '@/lib/hooks/useAdminFileExtractions';
import { useRadarScanSummary } from '@/lib/hooks/useAdminRadarScans';
import { useStatuteImportSummary } from '@/lib/hooks/useAdminStatuteImports';
import { failureRate } from '@/types/admin-radar-scans';

const SIBLING_LINKS = [
  /* Listed here rather than as a health card above, deliberately: the cards
     are driven by a summary endpoint that says how a job type is doing, and
     case maintenance has no such endpoint. A card showing nothing would look
     like a job type with no activity rather than one that cannot be summarised
     yet. */
  { title: 'Case Maintenance', href: '/admin/operations/case-maintenance' },
  { title: 'Case Enrichment', href: '/admin/cases/enrichments' },
  { title: 'Principle Review', href: '/admin/cases/principle-review' },
  { title: 'Quiz Generation', href: '/admin/quiz/generation' },
  { title: 'Scheduled Tasks', href: '/admin/operations/scheduled-tasks' },
];

export default function OperationsDashboardPage() {
  const health = useSystemHealth();
  const ingestions = useCaseIngestionSummary();
  const extractions = useFileExtractionSummary();
  const scans = useRadarScanSummary();
  const imports = useStatuteImportSummary();

  const ing = ingestions.data?.data;
  const ext = extractions.data?.data;
  const scan = scans.data?.data;
  const imp = imports.data?.data;

  const scanRate = scan ? failureRate(scan.last_7_days) : 0;
  const scanRatePct = Math.round(scanRate * 100);

  const ingestionCounts: JobHealthCount[] = ing
    ? [
        { label: 'Running', value: ing.jobs.running, tone: 'info' },
        { label: 'Failed', value: ing.jobs.failed, tone: ing.jobs.failed > 0 ? 'danger' : 'neutral' },
        { label: 'Failed (7d)', value: ing.failed_last_7_days, tone: ing.failed_last_7_days > 0 ? 'warning' : 'neutral' },
      ]
    : [];

  const extractionCounts: JobHealthCount[] = ext
    ? [
        { label: 'Failed', value: ext.files.failed, tone: ext.files.failed > 0 ? 'danger' : 'neutral' },
        { label: 'Empty', value: ext.files.empty, tone: ext.files.empty > 0 ? 'warning' : 'neutral' },
        { label: 'Failed (7d)', value: ext.failed_last_7_days, tone: ext.failed_last_7_days > 0 ? 'warning' : 'neutral' },
      ]
    : [];

  const scanCounts: JobHealthCount[] = scan
    ? [
        { label: 'Running', value: scan.scans.running, tone: 'info' },
        { label: 'Failed (all)', value: scan.scans.failed, tone: scan.scans.failed > 0 ? 'danger' : 'neutral' },
        { label: 'No balance', value: scan.scans.skipped_no_balance, tone: scan.scans.skipped_no_balance > 0 ? 'warning' : 'neutral' },
      ]
    : [];

  const importCounts: JobHealthCount[] = imp
    ? [
        { label: 'Processing', value: imp.imports.processing, tone: 'info' },
        { label: 'Failed', value: imp.imports.failed, tone: imp.imports.failed > 0 ? 'danger' : 'neutral' },
        { label: 'Stuck', value: imp.stuck_processing, tone: imp.stuck_processing > 0 ? 'danger' : 'neutral' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Activity className="h-6 w-6 text-primary" />
          Background Jobs
        </h1>
        <p className="text-sm text-muted-foreground">
          Health of the async job families at a glance. Red cards need a look.
        </p>
      </div>

      {/* Above the job families, because mail and the queue are what all four
          of them run on: if the workers are stopped, every card below is
          reporting on work that is not moving. */}
      <SystemHealthPanel
        health={health.data?.data}
        message={health.data?.message}
        isLoading={health.isPending}
        isError={health.isError}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <JobHealthCard
          title="Case PDF ingestions"
          icon={FileText}
          href="/admin/operations/case-ingestions"
          isLoading={ingestions.isLoading || !ing}
          counts={ingestionCounts}
          redFlag={{
            active: !!ing && (ing.stuck_running > 0 || ing.failed_last_7_days > 0),
            message:
              ing && ing.stuck_running > 0
                ? `${ing.stuck_running} stuck running (worker died)`
                : `${ing?.failed_last_7_days ?? 0} failed in the last 7 days`,
          }}
        />

        <JobHealthCard
          title="File text extractions"
          icon={FileSearch}
          href="/admin/operations/file-extractions"
          isLoading={extractions.isLoading || !ext}
          counts={extractionCounts}
          redFlag={{
            active: !!ext && ext.failed_last_7_days > 0,
            message: `${ext?.failed_last_7_days ?? 0} document(s) failed extraction this week`,
          }}
        />

        <JobHealthCard
          title="Radar scans"
          icon={Radar}
          href="/admin/operations/radar-scans"
          isLoading={scans.isLoading || !scan}
          counts={scanCounts}
          redFlag={{
            active: !!scan && (scanRate > 0.05 || scan.stuck_in_flight > 0),
            message:
              scan && scan.stuck_in_flight > 0
                ? `${scan.stuck_in_flight} stuck in-flight (sweeper broken)`
                : `${scanRatePct}% 7-day failure rate (alert > 5%)`,
          }}
          footer={scan ? `7-day failure rate: ${scanRatePct}%` : undefined}
        />

        <JobHealthCard
          title="Statute imports"
          icon={FileCode2}
          href="/admin/operations/statute-imports"
          isLoading={imports.isLoading || !imp}
          counts={importCounts}
          redFlag={{
            active: !!imp && (imp.stuck_processing > 0 || imp.failed_last_7_days > 0),
            message:
              imp && imp.stuck_processing > 0
                ? `${imp.stuck_processing} stuck processing`
                : `${imp?.failed_last_7_days ?? 0} failed in the last 7 days`,
          }}
        />
      </div>

      {/* Related observability surfaces */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <span className="mr-1 text-sm font-medium text-muted-foreground">Related:</span>
          {SIBLING_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
            >
              {link.title}
              <ArrowRight className="h-3 w-3" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

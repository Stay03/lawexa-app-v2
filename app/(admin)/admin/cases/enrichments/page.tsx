'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { EnrichmentSummaryCards } from '@/components/admin/case-enrichments/EnrichmentSummaryCards';
import { EnrichmentFilters } from '@/components/admin/case-enrichments/EnrichmentFilters';
import { EnrichmentRunsTable } from '@/components/admin/case-enrichments/EnrichmentRunsTable';
import { EnrichmentRunDetailDialog } from '@/components/admin/case-enrichments/EnrichmentRunDetailDialog';

import {
  useCaseEnrichments,
  useCaseEnrichmentSummary,
} from '@/lib/hooks/useAdminCaseEnrichments';
import type {
  CaseEnrichmentRun,
  CaseEnrichmentsParams,
  EnrichmentStatus,
  EnrichmentSweep,
  EnrichmentTrigger,
} from '@/types/admin-case-enrichments';

/** The sweep values the API can accept. Anything else in the URL is dropped. */
const SWEEPS: readonly EnrichmentSweep[] = ['stopped', 'text_changed'];

/** The summary field whose presence says the API accepts that sweep value. */
const SWEEP_COUNT_FIELD = {
  stopped: 'partial_stopped_cases',
  text_changed: 'partial_text_changed_cases',
} as const satisfies Record<EnrichmentSweep, string>;

/** How a sweep list names its rows, which are cases rather than runs. */
const SWEEP_ROWS: Record<EnrichmentSweep, { plural: string; empty: string }> = {
  stopped: { plural: 'stopped cases', empty: 'No stopped cases' },
  text_changed: { plural: 'changed cases', empty: 'No cases with a changed report' },
};

const isSweep = (value: string | null): value is EnrichmentSweep =>
  value !== null && (SWEEPS as readonly string[]).includes(value);

/******************************************************************************
                                Page Content
******************************************************************************/

function EnrichmentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedRun, setSelectedRun] = useState<CaseEnrichmentRun | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: summaryData, isLoading: summaryLoading } = useCaseEnrichmentSummary();
  const summary = summaryData?.data;

  // The API has a sweep filter when its summary carries that sweep's count.
  // Null until the summary arrives, when nothing is known yet.
  const availableSweeps = useMemo<EnrichmentSweep[] | null>(
    () => (summary ? SWEEPS.filter((sweep) => summary[SWEEP_COUNT_FIELD[sweep]] !== undefined) : null),
    [summary]
  );

  const params = useMemo<CaseEnrichmentsParams>(() => {
    const status = searchParams.get('status') as EnrichmentStatus | null;
    const trigger = searchParams.get('trigger') as EnrichmentTrigger | null;
    const sweepParam = searchParams.get('sweep');
    const caseIdParam = searchParams.get('case_id');
    // Kept while the summary is unknown, dropped once it shows the API lacks
    // it. Any other value would be a 422, so it never leaves the page.
    const sweep =
      isSweep(sweepParam) && (availableSweeps === null || availableSweeps.includes(sweepParam))
        ? sweepParam
        : undefined;
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 15,
      // A sweep list holds partial runs only, so a status beside it could only
      // empty the list. The status control is disabled while a sweep is on.
      status: sweep ? undefined : (status ?? undefined),
      trigger: trigger ?? undefined,
      unmapped_outcomes: searchParams.get('unmapped_outcomes') === '1' || undefined,
      sweep,
      case_id: caseIdParam !== null && /^[1-9][0-9]*$/.test(caseIdParam) ? Number(caseIdParam) : undefined,
    };
  }, [searchParams, availableSweeps]);

  const { data, isLoading } = useCaseEnrichments(params);

  const updateParams = useCallback(
    (updates: Partial<CaseEnrichmentsParams>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === false) {
          next.delete(key);
        } else if (key === 'unmapped_outcomes') {
          next.set(key, '1');
        } else {
          next.set(key, String(value));
        }
      });
      const qs = next.toString();
      router.push(qs ? `/admin/cases/enrichments?${qs}` : '/admin/cases/enrichments');
    },
    [router, searchParams]
  );

  const handleView = useCallback((run: CaseEnrichmentRun) => {
    setSelectedRun(run);
    setDetailOpen(true);
  }, []);

  const sweepRows = params.sweep ? SWEEP_ROWS[params.sweep] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sparkles className="h-6 w-6 text-primary" />
          Case Enrichment
        </h1>
        <p className="text-sm text-muted-foreground">
          AI extraction of structured content from case reports — coverage, runs, and failures.
        </p>
      </div>

      <EnrichmentSummaryCards summary={summary} isLoading={summaryLoading} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Enrichment runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <EnrichmentFilters
            params={params}
            availableSweeps={availableSweeps ?? []}
            onParamsChange={updateParams}
          />

          <EnrichmentRunsTable
            runs={data?.data || []}
            isLoading={isLoading}
            onView={handleView}
            showCaseRunsLink={params.sweep !== undefined}
            emptyMessage={sweepRows?.empty}
          />

          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={(page) => updateParams({ page })}
              itemLabel={sweepRows?.plural ?? 'runs'}
            />
          )}
        </CardContent>
      </Card>

      <EnrichmentRunDetailDialog
        run={selectedRun}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

/******************************************************************************
                                Main Page
******************************************************************************/

export default function CaseEnrichmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] w-full" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <EnrichmentsPageContent />
    </Suspense>
  );
}

'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { EnrichmentSummaryCards } from '@/components/admin/case-enrichments/EnrichmentSummaryCards';
import { EnrichmentFilters } from '@/components/admin/case-enrichments/EnrichmentFilters';
import { EnrichmentRunsTable } from '@/components/admin/case-enrichments/EnrichmentRunsTable';
import { EnrichmentRunDetailDialog } from '@/components/admin/case-enrichments/EnrichmentRunDetailDialog';
import { LoadFailed } from '@/components/admin/case-enrichments/LoadFailed';
import { isSweep, SWEEP_META, sweepsIn } from '@/components/admin/case-enrichments/sweeps';

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

/******************************************************************************
                                Page Content
******************************************************************************/

function EnrichmentsPageContent() {
  const searchParams = useSearchParams();

  const [selectedRun, setSelectedRun] = useState<CaseEnrichmentRun | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const summaryQuery = useCaseEnrichmentSummary();
  const summary = summaryQuery.data?.data;

  // The sweep filters the API has, from its summary. Null until the summary
  // request settles; a failed summary counts as an API with none.
  const availableSweeps = useMemo<EnrichmentSweep[] | null>(() => {
    if (summary) return sweepsIn(summary);
    return summaryQuery.isPending ? null : [];
  }, [summary, summaryQuery.isPending]);

  const sweepParam = searchParams.get('sweep');
  // A sweep in the URL holds the list until the summary settles. Loading it
  // earlier would filter by a sweep the page cannot yet show, with its toggle,
  // note and Clear hidden.
  const waitingForSummary = isSweep(sweepParam) && availableSweeps === null;

  const params = useMemo<CaseEnrichmentsParams>(() => {
    const status = searchParams.get('status') as EnrichmentStatus | null;
    const trigger = searchParams.get('trigger') as EnrichmentTrigger | null;
    const caseIdParam = searchParams.get('case_id');
    const caseId = caseIdParam !== null && /^[1-9][0-9]*$/.test(caseIdParam) ? Number(caseIdParam) : NaN;
    // Any sweep the API does not accept is a 422, so it never leaves the page.
    const sweep = isSweep(sweepParam) && availableSweeps?.includes(sweepParam) ? sweepParam : undefined;
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 15,
      // A sweep list holds partial runs only, so a status beside it could only
      // empty the list. The status control reads Partial while a sweep is on.
      status: sweep ? undefined : (status ?? undefined),
      trigger: trigger ?? undefined,
      // The API lists no sweep beside unmapped outcomes, and the pair could read
      // "No stopped cases" next to a Stopped count of 1. The toggle is disabled
      // while a sweep is on, so only a hand-edited URL would send both.
      unmapped_outcomes: sweep ? undefined : (searchParams.get('unmapped_outcomes') === '1' || undefined),
      sweep,
      // "99999999999999999999" passes the pattern and becomes 1e20.
      case_id: Number.isSafeInteger(caseId) ? caseId : undefined,
    };
  }, [searchParams, sweepParam, availableSweeps]);

  const listQuery = useCaseEnrichments(params, { enabled: !waitingForSummary });

  // The URL is written with history.pushState, not router.push. In next
  // 16.2.12 a router.push to this page is dropped when the page was opened with
  // a query string and Next has already prefetched the route: Next answers with
  // a replaceState of the old URL, and the filter change never happens
  // (measured 11 Sep 2026, lost 10 of 10 times after a fresh ?sweep=stopped).
  // The App Router syncs usePathname and useSearchParams with a native
  // pushState, and Back still returns to the previous list. The query is read
  // from window.location, as lib/utils/url-params.ts does, so a second change
  // before the first has synced builds on the real URL.
  const updateParams = useCallback(
    (updates: Partial<CaseEnrichmentsParams>) => {
      const next = new URLSearchParams(window.location.search);
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
      window.history.pushState(
        // MUST be `null`; the reason is in lib/utils/url-params.ts.
        null,
        '',
        qs ? `/admin/cases/enrichments?${qs}` : '/admin/cases/enrichments'
      );
    },
    []
  );

  const handleView = useCallback((run: CaseEnrichmentRun) => {
    setSelectedRun(run);
    setDetailOpen(true);
  }, []);

  const sweepRows = params.sweep ? SWEEP_META[params.sweep] : null;
  // A failed request with nothing to show says so, rather than staying a
  // skeleton or reading as an empty list. A failed background refetch keeps
  // what is already on screen.
  const summaryFailed = summaryQuery.isError && summary === undefined;
  const listFailed = listQuery.isError && listQuery.data === undefined;

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

      {summaryFailed ? (
        <LoadFailed
          message="The enrichment summary could not be loaded."
          onRetry={() => summaryQuery.refetch()}
          retrying={summaryQuery.isFetching}
        />
      ) : (
        <EnrichmentSummaryCards summary={summary} isLoading={summaryQuery.isLoading} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Enrichment runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <EnrichmentFilters
            params={params}
            availableSweeps={availableSweeps ?? []}
            disabled={waitingForSummary}
            onParamsChange={updateParams}
          />

          {/* isPending, not isLoading: a list held for the summary is pending
              without fetching, and shows the skeleton rather than "no runs". */}
          {listFailed ? (
            <LoadFailed
              message={`The ${sweepRows?.plural ?? 'enrichment runs'} could not be loaded.`}
              onRetry={() => listQuery.refetch()}
              retrying={listQuery.isFetching}
            />
          ) : (
            <EnrichmentRunsTable
              runs={listQuery.data?.data || []}
              isLoading={listQuery.isPending}
              onView={handleView}
              showCaseRunsLink={params.sweep !== undefined}
              emptyMessage={sweepRows?.empty}
            />
          )}

          {listQuery.data?.pagination && (
            <AdminPagination
              pagination={listQuery.data.pagination}
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] w-full" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 2xl:grid-cols-4">
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

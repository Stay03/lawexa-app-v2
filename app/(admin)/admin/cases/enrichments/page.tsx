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
  EnrichmentTrigger,
} from '@/types/admin-case-enrichments';

/******************************************************************************
                                Page Content
******************************************************************************/

function EnrichmentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedRun, setSelectedRun] = useState<CaseEnrichmentRun | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const params = useMemo<CaseEnrichmentsParams>(() => {
    const status = searchParams.get('status') as EnrichmentStatus | null;
    const trigger = searchParams.get('trigger') as EnrichmentTrigger | null;
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 15,
      status: status ?? undefined,
      trigger: trigger ?? undefined,
      unmapped_outcomes: searchParams.get('unmapped_outcomes') === '1' || undefined,
      case_id: searchParams.get('case_id')
        ? Number(searchParams.get('case_id'))
        : undefined,
    };
  }, [searchParams]);

  const { data: summaryData, isLoading: summaryLoading } = useCaseEnrichmentSummary();
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

      <EnrichmentSummaryCards summary={summaryData?.data} isLoading={summaryLoading} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Enrichment runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <EnrichmentFilters params={params} onParamsChange={updateParams} />

          <EnrichmentRunsTable
            runs={data?.data || []}
            isLoading={isLoading}
            onView={handleView}
          />

          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={(page) => updateParams({ page })}
              itemLabel="runs"
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

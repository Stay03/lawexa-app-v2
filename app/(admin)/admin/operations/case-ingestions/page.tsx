'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, CircleDashed, CheckCircle2, XCircle, CalendarX, AlertTriangle, X } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import {
  SummaryStatCard,
  SummaryStatCardSkeleton,
  EnumFilterSelect,
} from '@/components/admin/observability';
import { CaseIngestionsTable } from '@/components/admin/observability/case-ingestions/CaseIngestionsTable';
import { CaseIngestionDetailDialog } from '@/components/admin/observability/case-ingestions/CaseIngestionDetailDialog';
import {
  useCaseIngestions,
  useCaseIngestionSummary,
} from '@/lib/hooks/useAdminCaseIngestions';
import {
  CASE_INGESTION_STATUSES,
  type CaseIngestion,
  type CaseIngestionStatus,
  type CaseIngestionsParams,
} from '@/types/admin-case-ingestions';

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<CaseIngestion | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const params = useMemo<CaseIngestionsParams>(() => {
    const status = searchParams.get('status') as CaseIngestionStatus | null;
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 15,
      status: status ?? undefined,
      user_id: searchParams.get('user_id') ? Number(searchParams.get('user_id')) : undefined,
    };
  }, [searchParams]);

  const { data: summaryData, isLoading: summaryLoading } = useCaseIngestionSummary();
  const { data, isLoading } = useCaseIngestions(params);
  const summary = summaryData?.data;

  const updateParams = useCallback(
    (updates: Partial<CaseIngestionsParams>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined) next.delete(key);
        else next.set(key, String(value));
      });
      const qs = next.toString();
      router.push(qs ? `/admin/operations/case-ingestions?${qs}` : '/admin/operations/case-ingestions');
    },
    [router, searchParams]
  );

  const handleView = useCallback((job: CaseIngestion) => {
    setSelected(job);
    setDetailOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FileText className="h-6 w-6 text-primary" />
          Case PDF Ingestions
        </h1>
        <p className="text-sm text-muted-foreground">
          Async judgment-PDF extraction jobs — health, failures, and the cases they created.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {summaryLoading || !summary ? (
          Array.from({ length: 5 }).map((_, i) => <SummaryStatCardSkeleton key={i} />)
        ) : (
          <>
            <SummaryStatCard icon={CircleDashed} label="Running" value={summary.jobs.running} />
            <SummaryStatCard icon={CheckCircle2} label="Completed" value={summary.jobs.completed} />
            <SummaryStatCard
              icon={XCircle}
              label="Failed"
              value={summary.jobs.failed}
              tone={summary.jobs.failed > 0 ? 'danger' : 'default'}
            />
            <SummaryStatCard
              icon={CalendarX}
              label="Failed (7d)"
              value={summary.failed_last_7_days}
              tone={summary.failed_last_7_days > 0 ? 'warning' : 'default'}
            />
            <SummaryStatCard
              icon={AlertTriangle}
              label="Stuck running"
              value={summary.stuck_running}
              hint="Worker died mid-run"
              tone={summary.stuck_running > 0 ? 'danger' : 'default'}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-lg">Ingestion jobs</CardTitle>
          <div className="flex items-center gap-2">
            <EnumFilterSelect
              value={params.status}
              options={CASE_INGESTION_STATUSES}
              onChange={(v) => updateParams({ status: v as CaseIngestionStatus | undefined, page: 1 })}
              placeholder="Status"
              allLabel="All statuses"
            />
            {params.user_id != null && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1 text-muted-foreground"
                onClick={() => updateParams({ user_id: undefined, page: 1 })}
              >
                <X className="h-4 w-4" />
                Clear user filter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CaseIngestionsTable
            ingestions={data?.data || []}
            isLoading={isLoading}
            onView={handleView}
          />
          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={(page) => updateParams({ page })}
              itemLabel="jobs"
            />
          )}
        </CardContent>
      </Card>

      <CaseIngestionDetailDialog
        ingestion={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

export default function CaseIngestionsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <PageContent />
    </Suspense>
  );
}

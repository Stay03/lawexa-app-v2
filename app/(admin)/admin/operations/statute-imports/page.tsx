'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileCode2, CircleDashed, CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import {
  SummaryStatCard,
  SummaryStatCardSkeleton,
  EnumFilterSelect,
} from '@/components/admin/observability';
import { StatuteImportsTable } from '@/components/admin/observability/statute-imports/StatuteImportsTable';
import { useStatuteImports, useStatuteImportSummary } from '@/lib/hooks/useAdminStatuteImports';
import {
  STATUTE_IMPORT_STATUSES,
  type StatuteImportsParams,
  type StatuteImportStatus,
} from '@/types/admin-statute-imports';

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = useMemo<StatuteImportsParams>(() => {
    const status = searchParams.get('status') as StatuteImportStatus | null;
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 15,
      status: status ?? undefined,
      user_id: searchParams.get('user_id') ? Number(searchParams.get('user_id')) : undefined,
    };
  }, [searchParams]);

  const { data: summaryData, isLoading: summaryLoading } = useStatuteImportSummary();
  const { data, isLoading } = useStatuteImports(params);
  const summary = summaryData?.data;

  const updateParams = useCallback(
    (updates: Partial<StatuteImportsParams>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined) next.delete(key);
        else next.set(key, String(value));
      });
      const qs = next.toString();
      router.push(qs ? `/admin/operations/statute-imports?${qs}` : '/admin/operations/statute-imports');
    },
    [router, searchParams]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FileCode2 className="h-6 w-6 text-primary" />
          Statute Imports
        </h1>
        <p className="text-sm text-muted-foreground">
          Akoma Ntoso XML imports — live node progress, failures, and the statutes they built.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryLoading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => <SummaryStatCardSkeleton key={i} />)
        ) : (
          <>
            <SummaryStatCard icon={CircleDashed} label="Processing" value={summary.imports.processing} />
            <SummaryStatCard icon={CheckCircle2} label="Completed" value={summary.imports.completed} />
            <SummaryStatCard
              icon={XCircle}
              label="Failed"
              value={summary.imports.failed}
              tone={summary.imports.failed > 0 ? 'danger' : 'default'}
            />
            <SummaryStatCard
              icon={AlertTriangle}
              label="Stuck processing"
              value={summary.stuck_processing}
              hint="No progress > 30 min"
              tone={summary.stuck_processing > 0 ? 'danger' : 'default'}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-lg">Imports</CardTitle>
          <div className="flex items-center gap-2">
            <EnumFilterSelect
              value={params.status}
              options={STATUTE_IMPORT_STATUSES}
              onChange={(v) => updateParams({ status: v as StatuteImportStatus | undefined, page: 1 })}
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
                Clear user
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatuteImportsTable imports={data?.data || []} isLoading={isLoading} />
          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={(page) => updateParams({ page })}
              itemLabel="imports"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function StatuteImportsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <PageContent />
    </Suspense>
  );
}

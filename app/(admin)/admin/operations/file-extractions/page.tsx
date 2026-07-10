'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileSearch, XCircle, FileX2, CheckCircle2, Clock, CalendarX, X } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import {
  SummaryStatCard,
  SummaryStatCardSkeleton,
  SegmentedControl,
} from '@/components/admin/observability';
import { FileExtractionsTable } from '@/components/admin/observability/file-extractions/FileExtractionsTable';
import {
  useFileExtractions,
  useFileExtractionSummary,
} from '@/lib/hooks/useAdminFileExtractions';
import type {
  FileExtractionsParams,
  FileExtractionStatus,
} from '@/types/admin-file-extractions';

const STATUS_TABS = [
  { value: 'failed' as const, label: 'Failed' },
  { value: 'empty' as const, label: 'Empty' },
  { value: 'pending' as const, label: 'Pending' },
  { value: 'done' as const, label: 'Done' },
];

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = useMemo<FileExtractionsParams>(() => {
    const status = (searchParams.get('status') as FileExtractionStatus | null) ?? 'failed';
    return {
      status,
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 15,
      user_id: searchParams.get('user_id') ? Number(searchParams.get('user_id')) : undefined,
    };
  }, [searchParams]);

  const { data: summaryData, isLoading: summaryLoading } = useFileExtractionSummary();
  const { data, isLoading } = useFileExtractions(params);
  const summary = summaryData?.data;

  const updateParams = useCallback(
    (updates: Partial<FileExtractionsParams>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined) next.delete(key);
        else next.set(key, String(value));
      });
      const qs = next.toString();
      router.push(qs ? `/admin/operations/file-extractions?${qs}` : '/admin/operations/file-extractions');
    },
    [router, searchParams]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FileSearch className="h-6 w-6 text-primary" />
          File Text Extractions
        </h1>
        <p className="text-sm text-muted-foreground">
          Text-extraction health of uploaded files. Watch <strong>failed</strong> and{' '}
          <strong>empty</strong> (usually scanned PDFs) — <em>pending</em> is not a backlog.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {summaryLoading || !summary ? (
          Array.from({ length: 5 }).map((_, i) => <SummaryStatCardSkeleton key={i} />)
        ) : (
          <>
            <SummaryStatCard
              icon={XCircle}
              label="Failed"
              value={summary.files.failed}
              tone={summary.files.failed > 0 ? 'danger' : 'default'}
            />
            <SummaryStatCard
              icon={FileX2}
              label="Empty"
              value={summary.files.empty}
              hint="Likely scanned PDFs"
              tone={summary.files.empty > 0 ? 'warning' : 'default'}
            />
            <SummaryStatCard icon={CheckCircle2} label="Done" value={summary.files.done} />
            <SummaryStatCard
              icon={Clock}
              label="Pending"
              value={summary.files.pending}
              hint="Not a backlog gauge"
            />
            <SummaryStatCard
              icon={CalendarX}
              label="Failed (7d)"
              value={summary.failed_last_7_days}
              tone={summary.failed_last_7_days > 0 ? 'warning' : 'default'}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle className="text-lg">Extractions</CardTitle>
          <div className="flex items-center gap-2">
            <SegmentedControl
              value={params.status}
              options={STATUS_TABS}
              onChange={(status) => updateParams({ status, page: 1 })}
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
          <FileExtractionsTable files={data?.data || []} isLoading={isLoading} />
          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={(page) => updateParams({ page })}
              itemLabel="files"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function FileExtractionsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <PageContent />
    </Suspense>
  );
}

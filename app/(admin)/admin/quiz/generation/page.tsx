'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminQuizGenerationSummary } from '@/components/admin/quiz/AdminQuizGenerationSummary';
import { AdminQuizBatchesFilters } from '@/components/admin/quiz/AdminQuizBatchesFilters';
import { AdminQuizBatchesTable } from '@/components/admin/quiz/AdminQuizBatchesTable';
import { useAdminQuizBatches } from '@/lib/hooks/useAdminQuiz';
import type {
  AdminQuizBatchListParams,
  QuizBatchStatus,
} from '@/types/admin-quiz';

const BATCH_STATUSES: QuizBatchStatus[] = [
  'queued',
  'running',
  'completed',
  'failed',
  'skipped',
];

export default function AdminQuizGenerationPage() {
  return (
    <Suspense fallback={null}>
      <AdminQuizGenerationContent />
    </Suspense>
  );
}

function AdminQuizGenerationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = useMemo<AdminQuizBatchListParams>(() => {
    const statusParam = searchParams.get('status');
    const sourceParam = searchParams.get('source_mode');
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 15,
      status:
        statusParam && (BATCH_STATUSES as string[]).includes(statusParam)
          ? (statusParam as QuizBatchStatus)
          : undefined,
      source_mode:
        sourceParam === 'content' || sourceParam === 'transcript'
          ? sourceParam
          : undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
    };
  }, [searchParams]);

  const query = useAdminQuizBatches(params);

  const updateParams = useCallback(
    (
      updates: Record<string, string | number | boolean | undefined>,
      resetPage = true
    ) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '' || value === false) next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage) next.delete('page');
      const qs = next.toString();
      router.push(qs ? `/admin/quiz/generation?${qs}` : '/admin/quiz/generation');
    },
    [router, searchParams]
  );

  const handleFilterChange = useCallback(
    (updates: Partial<AdminQuizBatchListParams>) => {
      updateParams(updates as Record<string, string | number | boolean | undefined>);
    },
    [updateParams]
  );

  return (
    <div className="space-y-6">
      <AdminQuizGenerationSummary />

      <Card>
        <CardHeader>
          <CardTitle>Batches</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminQuizBatchesFilters params={params} onChange={handleFilterChange} />
          <AdminQuizBatchesTable
            batches={query.data?.data ?? []}
            isLoading={query.isLoading}
          />
          {query.data && query.data.data.length > 0 && (
            <AdminPagination
              pagination={query.data.pagination}
              itemLabel="batches"
              onPageChange={(page) => updateParams({ page }, false)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

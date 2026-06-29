'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminQuizSessionsTable } from '@/components/admin/quiz/AdminQuizSessionsTable';
import { useAdminQuizSessions } from '@/lib/hooks/useAdminQuiz';
import type { AdminQuizSessionListParams } from '@/types/admin-quiz';
import type { QuizSessionStatus } from '@/types/quiz';

const STATUSES: QuizSessionStatus[] = ['active', 'completed', 'abandoned'];

export default function AdminQuizSessionsPage() {
  return (
    <Suspense fallback={null}>
      <AdminQuizSessionsContent />
    </Suspense>
  );
}

function AdminQuizSessionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = useMemo<AdminQuizSessionListParams>(() => {
    const status = searchParams.get('status');
    const userId = searchParams.get('user_id');
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 15,
      status:
        status === 'active' || status === 'completed' || status === 'abandoned'
          ? status
          : undefined,
      user_id: userId ? Number(userId) || undefined : undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
    };
  }, [searchParams]);

  const query = useAdminQuizSessions(params);

  const updateParams = useCallback(
    (
      updates: Record<string, string | number | undefined>,
      resetPage = true
    ) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage) next.delete('page');
      const qs = next.toString();
      router.push(qs ? `/admin/quiz/sessions?${qs}` : '/admin/quiz/sessions');
    },
    [router, searchParams]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quiz sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="User ID"
              aria-label="Filter by user ID"
              className="h-9 w-full sm:w-[140px]"
              value={params.user_id ?? ''}
              onChange={(e) =>
                updateParams({ user_id: e.target.value || undefined })
              }
            />
            <Select
              value={params.status ?? 'all'}
              onValueChange={(v) =>
                updateParams({ status: v === 'all' ? undefined : v })
              }
            >
              <SelectTrigger className="h-9 w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              aria-label="Started from"
              className="h-9 w-full sm:w-[150px]"
              value={params.date_from ?? ''}
              onChange={(e) =>
                updateParams({ date_from: e.target.value || undefined })
              }
            />
            <Input
              type="date"
              aria-label="Started to"
              className="h-9 w-full sm:w-[150px]"
              value={params.date_to ?? ''}
              onChange={(e) =>
                updateParams({ date_to: e.target.value || undefined })
              }
            />
          </div>

          <AdminQuizSessionsTable
            sessions={query.data?.data ?? []}
            isLoading={query.isLoading}
            showUser
          />

          {query.data && query.data.data.length > 0 && (
            <AdminPagination
              pagination={query.data.pagination}
              itemLabel="sessions"
              perPage={params.per_page}
              onPageChange={(page) => updateParams({ page }, false)}
              onPerPageChange={(perPage) => updateParams({ per_page: perPage })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminQuizSessionsTable } from './AdminQuizSessionsTable';
import { useAdminUserQuizSessions } from '@/lib/hooks/useAdminQuiz';
import type { AdminQuizSessionListParams } from '@/types/admin-quiz';
import type { QuizSessionStatus } from '@/types/quiz';

const STATUSES: QuizSessionStatus[] = ['active', 'completed', 'abandoned'];

/** One user's quiz sessions — a paginated, filterable list for the Quiz tab. */
export function AdminUserQuizSessions({ uuid }: { uuid: string }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [status, setStatus] = useState<QuizSessionStatus | 'all'>('all');

  const params: AdminQuizSessionListParams = {
    page,
    per_page: perPage,
    status: status === 'all' ? undefined : status,
  };
  const query = useAdminUserQuizSessions(uuid, params);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Sessions</CardTitle>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as QuizSessionStatus | 'all');
            setPage(1);
          }}
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
      </CardHeader>
      <CardContent className="space-y-4">
        <AdminQuizSessionsTable
          sessions={query.data?.data ?? []}
          isLoading={query.isLoading}
        />
        {query.data && query.data.data.length > 0 && (
          <AdminPagination
            pagination={query.data.pagination}
            itemLabel="sessions"
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={(pp) => {
              setPerPage(pp);
              setPage(1);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

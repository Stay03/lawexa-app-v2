'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { useAdminUserChannelQuizAttempts } from '@/lib/hooks/useAdminChannelQuizzes';
import type { AdminChannelQuizAttemptListParams } from '@/types/admin-channel-quizzes';
import { AdminChannelQuizPlaysTable } from './AdminChannelQuizPlaysTable';
import { AdminChannelQuizError } from './AdminChannelQuizStates';
import { percentLabel, type PlayStatusFilter } from './model';

/**
 * One person's plays of the new quizzes, on the admin user page's Quiz tab
 * under the old study sessions (option A, thread e80a3d30): a summary, then
 * the plays, as the old per-user sessions card lists them.
 */
export function AdminUserChannelQuizPlays({ uuid }: { uuid: string }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [status, setStatus] = useState<PlayStatusFilter | 'all'>('all');

  const params: AdminChannelQuizAttemptListParams = {
    page,
    per_page: perPage,
    status: status === 'all' ? undefined : status,
  };
  const query = useAdminUserChannelQuizAttempts(uuid, params);
  const summary = query.data?.summary;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">Explore quizzes (new)</CardTitle>
          {summary ? (
            <CardDescription>
              {summary.plays} plays · {summary.finished_plays} finished · average {percentLabel(summary.average_score_percent)} ·{' '}
              {summary.quizzes_made} quizzes made
            </CardDescription>
          ) : null}
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as PlayStatusFilter | 'all');
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-full sm:w-[150px]" aria-label="Finished or not">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plays</SelectItem>
            <SelectItem value="finished">Finished</SelectItem>
            <SelectItem value="unfinished">Not finished</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isError ? (
          <AdminChannelQuizError error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <AdminChannelQuizPlaysTable
            plays={query.data?.data ?? []}
            isLoading={query.isPending}
            showPlayer={false}
            emptyText="No plays of the new quizzes yet."
          />
        )}
        {query.data && query.data.data.length > 0 && (
          <AdminPagination
            pagination={query.data.pagination}
            itemLabel="plays"
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

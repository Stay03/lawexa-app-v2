'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminChannelQuizPlaysTable } from '@/components/admin/channel-quiz/AdminChannelQuizPlaysTable';
import { AdminChannelQuizError, AdminChannelQuizFilterChip } from '@/components/admin/channel-quiz/AdminChannelQuizStates';
import { EXPLORE_BASE, nextSearch, parsePlayParams, playQuery } from '@/components/admin/channel-quiz/model';
import { useAdminChannelQuizAttempts } from '@/lib/hooks/useAdminChannelQuizzes';

/** Explore quizzes (new) › Plays: every play of the new quizzes, newest first. */
export default function AdminExplorePlaysPage() {
  return (
    <Suspense fallback={null}>
      <AdminExplorePlaysContent />
    </Suspense>
  );
}

function AdminExplorePlaysContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useMemo(() => parsePlayParams(new URLSearchParams(searchParams.toString())), [searchParams]);
  const query = useAdminChannelQuizAttempts(playQuery(params));

  const updateParams = useCallback(
    (updates: Record<string, string | number | boolean | undefined>, resetPage = true) => {
      const qs = nextSearch(new URLSearchParams(searchParams.toString()), updates, resetPage);
      router.push(qs ? `${EXPLORE_BASE}?${qs}` : EXPLORE_BASE);
    },
    [router, searchParams],
  );

  const rows = query.data?.data ?? [];
  // A chip names what its link filtered to; every row then holds that quiz or player.
  const quizLabel = params.quiz ? `Quiz: ${rows[0]?.quiz?.title ?? 'one quiz'}` : null;
  const playerLabel = params.user ? `Player: ${rows[0]?.player?.name ?? 'one person'}` : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plays</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={params.status ?? 'all'} onValueChange={(v) => updateParams({ status: v === 'all' ? undefined : v })}>
            <SelectTrigger className="h-9 w-full sm:w-[150px]" aria-label="Finished or not">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plays</SelectItem>
              <SelectItem value="finished">Finished</SelectItem>
              <SelectItem value="unfinished">Not finished</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={params.counts_for_board === undefined ? 'all' : params.counts_for_board ? '1' : '0'}
            onValueChange={(v) => updateParams({ counts_for_board: v === 'all' ? undefined : v === '1' })}
          >
            <SelectTrigger className="h-9 w-full sm:w-[190px]" aria-label="Counts for the board">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Board and practice</SelectItem>
              <SelectItem value="1">Counts for the board</SelectItem>
              <SelectItem value="0">Practice only</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            aria-label="Started from"
            className="h-9 w-full sm:w-[150px]"
            value={params.date_from ?? ''}
            onChange={(e) => updateParams({ date_from: e.target.value || undefined })}
          />
          <Input
            type="date"
            aria-label="Started to"
            className="h-9 w-full sm:w-[150px]"
            value={params.date_to ?? ''}
            onChange={(e) => updateParams({ date_to: e.target.value || undefined })}
          />
          {quizLabel ? <AdminChannelQuizFilterChip label={quizLabel} onClear={() => updateParams({ quiz: undefined })} /> : null}
          {playerLabel ? <AdminChannelQuizFilterChip label={playerLabel} onClear={() => updateParams({ user: undefined })} /> : null}
        </div>

        {query.isError ? (
          <AdminChannelQuizError error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <AdminChannelQuizPlaysTable plays={rows} isLoading={query.isPending} />
        )}

        {query.data && rows.length > 0 && (
          <AdminPagination
            pagination={query.data.pagination}
            itemLabel="plays"
            perPage={params.per_page}
            onPageChange={(page) => updateParams({ page }, false)}
            onPerPageChange={(perPage) => updateParams({ per_page: perPage })}
          />
        )}
      </CardContent>
    </Card>
  );
}

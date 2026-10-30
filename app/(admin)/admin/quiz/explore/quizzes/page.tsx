'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminChannelQuizzesTable } from '@/components/admin/channel-quiz/AdminChannelQuizzesTable';
import { AdminChannelQuizError } from '@/components/admin/channel-quiz/AdminChannelQuizStates';
import { DEFAULT_QUIZ_SORT, EXPLORE_BASE, QUIZ_SORTS, nextSearch, parseQuizParams, quizQuery } from '@/components/admin/channel-quiz/model';
import { useAdminChannelQuizzes } from '@/lib/hooks/useAdminChannelQuizzes';

const QUIZZES_PATH = `${EXPLORE_BASE}/quizzes`;

/** Explore quizzes (new) › Quizzes: every new quiz with its plays, players, finished share and average score. */
export default function AdminExploreQuizzesPage() {
  return (
    <Suspense fallback={null}>
      <AdminExploreQuizzesContent />
    </Suspense>
  );
}

function AdminExploreQuizzesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useMemo(() => parseQuizParams(new URLSearchParams(searchParams.toString())), [searchParams]);
  const query = useAdminChannelQuizzes(quizQuery(params));
  // The search box keeps its own text and goes into the URL on Enter, so each key press is not a request.
  const [search, setSearch] = useState(params.search ?? '');

  const updateParams = useCallback(
    (updates: Record<string, string | number | boolean | undefined>, resetPage = true) => {
      const qs = nextSearch(new URLSearchParams(searchParams.toString()), updates, resetPage);
      router.push(qs ? `${QUIZZES_PATH}?${qs}` : QUIZZES_PATH);
    },
    [router, searchParams],
  );

  const rows = query.data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quizzes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <form
            className="w-full sm:w-[240px]"
            onSubmit={(event) => {
              event.preventDefault();
              updateParams({ search: search.trim() || undefined });
            }}
          >
            <Input
              type="search"
              placeholder="Search titles"
              aria-label="Search quiz titles"
              className="h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => {
                if ((search.trim() || undefined) !== params.search) updateParams({ search: search.trim() || undefined });
              }}
            />
          </form>
          <Select value={params.visibility ?? 'all'} onValueChange={(v) => updateParams({ visibility: v === 'all' ? undefined : v })}>
            <SelectTrigger className="h-9 w-full sm:w-[150px]" aria-label="Visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any visibility</SelectItem>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="shared">Shared</SelectItem>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="link">Link only</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Year"
            aria-label="Year"
            className="h-9 w-full sm:w-[110px]"
            value={params.year ?? ''}
            onChange={(e) => updateParams({ year: e.target.value || undefined })}
          />
          <Select value={params.sort ?? DEFAULT_QUIZ_SORT} onValueChange={(v) => updateParams({ sort: v === DEFAULT_QUIZ_SORT ? undefined : v })}>
            <SelectTrigger className="h-9 w-full sm:w-[160px]" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUIZ_SORTS.map((sort) => (
                <SelectItem key={sort.id} value={sort.id}>
                  {sort.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label className="flex h-9 items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={params.include_deleted === true}
              onCheckedChange={(checked) => updateParams({ include_deleted: checked === true ? true : undefined })}
            />
            Show deleted
          </Label>
        </div>

        {query.isError ? (
          <AdminChannelQuizError error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <AdminChannelQuizzesTable quizzes={rows} isLoading={query.isPending} />
        )}

        {query.data && rows.length > 0 && (
          <AdminPagination
            pagination={query.data.pagination}
            itemLabel="quizzes"
            perPage={params.per_page}
            onPageChange={(page) => updateParams({ page }, false)}
            onPerPageChange={(perPage) => updateParams({ per_page: perPage })}
          />
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminQuizQuestionFilters } from '@/components/admin/quiz/AdminQuizQuestionFilters';
import { AdminQuizQuestionsTable } from '@/components/admin/quiz/AdminQuizQuestionsTable';
import { useAdminQuizQuestions } from '@/lib/hooks/useAdminQuiz';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type {
  AdminQuizQuestionListParams,
  AdminQuizQuestionSort,
} from '@/types/admin-quiz';
import type { QuizDifficulty } from '@/types/quiz';

const QUESTION_SORTS: AdminQuizQuestionSort[] = [
  'served',
  'answered',
  'correct',
  'difficulty',
  'created_at',
  'reviewed_at',
];

const SORT_LABELS: Record<AdminQuizQuestionSort, string> = {
  served: 'Served',
  answered: 'Answered',
  correct: 'Correct',
  difficulty: 'Difficulty',
  created_at: 'Created',
  reviewed_at: 'Reviewed',
};

export default function AdminQuizQuestionsPage() {
  return (
    <Suspense fallback={null}>
      <AdminQuizQuestionsContent />
    </Suspense>
  );
}

function AdminQuizQuestionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 400);

  const params = useMemo<AdminQuizQuestionListParams>(() => {
    const status = searchParams.get('status');
    const difficulty = searchParams.get('difficulty');
    const sourceMode = searchParams.get('source_mode');
    const sortParam = searchParams.get('sort');
    const directionParam = searchParams.get('direction');
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 15,
      status: status === 'approved' || status === 'archived' ? status : undefined,
      difficulty: difficulty ? (Number(difficulty) as QuizDifficulty) : undefined,
      source_mode:
        sourceMode === 'content' || sourceMode === 'transcript' ? sourceMode : undefined,
      with_trashed: searchParams.get('with_trashed') === 'true' ? true : undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      sort:
        sortParam && (QUESTION_SORTS as string[]).includes(sortParam)
          ? (sortParam as AdminQuizQuestionSort)
          : undefined,
      direction:
        directionParam === 'asc' || directionParam === 'desc'
          ? directionParam
          : undefined,
      topic_key: debouncedSearch || undefined,
    };
  }, [searchParams, debouncedSearch]);

  const query = useAdminQuizQuestions(params);

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
      router.push(qs ? `/admin/quiz/questions?${qs}` : '/admin/quiz/questions');
    },
    [router, searchParams]
  );

  const handleFilterChange = useCallback(
    (updates: Partial<AdminQuizQuestionListParams>) => {
      updateParams(updates as Record<string, string | number | boolean | undefined>);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (column: AdminQuizQuestionSort) => {
      const currentDir = params.direction ?? 'desc';
      const nextDir =
        params.sort === column ? (currentDir === 'desc' ? 'asc' : 'desc') : 'desc';
      updateParams({ sort: column, direction: nextDir });
    },
    [params.sort, params.direction, updateParams]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quiz Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Filter by topic key (e.g. criminal-law)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <AdminQuizQuestionFilters params={params} onChange={handleFilterChange} />

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort</span>
              <Select
                value={params.sort ?? 'newest'}
                onValueChange={(v) =>
                  v === 'newest'
                    ? updateParams({ sort: undefined, direction: undefined })
                    : updateParams({
                        sort: v,
                        direction: params.direction ?? 'desc',
                      })
                }
              >
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  {QUESTION_SORTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SORT_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {params.sort && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateParams({
                      sort: params.sort,
                      direction: params.direction === 'asc' ? 'desc' : 'asc',
                    })
                  }
                  aria-label={`Sort ${params.direction === 'asc' ? 'descending' : 'ascending'}`}
                >
                  {params.direction === 'asc' ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>

          <AdminQuizQuestionsTable
            questions={query.data?.data ?? []}
            isLoading={query.isLoading}
            sort={params.sort}
            direction={params.direction}
            onSort={handleSort}
          />

          {query.data && query.data.data.length > 0 && (
            <AdminPagination
              pagination={query.data.pagination}
              itemLabel="questions"
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

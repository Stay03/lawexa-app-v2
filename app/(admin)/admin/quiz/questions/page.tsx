'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminQuizQuestionFilters } from '@/components/admin/quiz/AdminQuizQuestionFilters';
import { AdminQuizQuestionsTable } from '@/components/admin/quiz/AdminQuizQuestionsTable';
import { useAdminQuizQuestions } from '@/lib/hooks/useAdminQuiz';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { AdminQuizQuestionListParams } from '@/types/admin-quiz';
import type { QuizDifficulty } from '@/types/quiz';

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

          <AdminQuizQuestionsTable
            questions={query.data?.data ?? []}
            isLoading={query.isLoading}
          />

          {query.data && query.data.data.length > 0 && (
            <AdminPagination
              pagination={query.data.pagination}
              itemLabel="questions"
              onPageChange={(page) => updateParams({ page }, false)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

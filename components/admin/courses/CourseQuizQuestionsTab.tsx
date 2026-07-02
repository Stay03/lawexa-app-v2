'use client';

import { useCallback, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { AdminPagination } from '@/components/admin';
import { AdminQuizQuestionFilters } from '@/components/admin/quiz/AdminQuizQuestionFilters';
import { AdminQuizQuestionsTable } from '@/components/admin/quiz/AdminQuizQuestionsTable';

import { useCourseQuizQuestions } from '@/lib/hooks/useAdminQuiz';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type {
  AdminQuizQuestionListParams,
  AdminQuizQuestionSort,
} from '@/types/admin-quiz';

interface CourseQuizQuestionsTabProps {
  courseSlug: string;
}

/**
 * Quiz questions generated for a course. Reuses the global quiz-questions
 * table + filters (moderation actions included). Note: this endpoint validates
 * per_page (1–100), so paging stays within the standard 10/15/25/50 options.
 */
export function CourseQuizQuestionsTab({
  courseSlug,
}: CourseQuizQuestionsTabProps) {
  const [params, setParams] = useState<AdminQuizQuestionListParams>({
    page: 1,
    per_page: 15,
  });
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 400);

  const queryParams = useMemo<AdminQuizQuestionListParams>(
    () => ({ ...params, topic_key: debouncedSearch || undefined }),
    [params, debouncedSearch]
  );

  const { data, isLoading } = useCourseQuizQuestions(courseSlug, queryParams);

  const handleFilterChange = useCallback(
    (updates: Partial<AdminQuizQuestionListParams>) => {
      setParams((prev) => ({ ...prev, ...updates, page: 1 }));
    },
    []
  );

  const handleSort = useCallback((column: AdminQuizQuestionSort) => {
    setParams((prev) => ({
      ...prev,
      sort: column,
      direction:
        prev.sort === column && prev.direction === 'desc' ? 'asc' : 'desc',
      page: 1,
    }));
  }, []);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by topic..."
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setParams((prev) => ({ ...prev, page: 1 }));
          }}
          className="pl-9"
        />
      </div>

      <AdminQuizQuestionFilters
        params={queryParams}
        onChange={handleFilterChange}
      />

      <AdminQuizQuestionsTable
        questions={data?.data || []}
        isLoading={isLoading}
        sort={queryParams.sort}
        direction={queryParams.direction}
        onSort={handleSort}
      />

      {data?.pagination && data.data.length > 0 && (
        <AdminPagination
          pagination={data.pagination}
          onPageChange={(page) => setParams((prev) => ({ ...prev, page }))}
          onPerPageChange={(per_page) =>
            setParams((prev) => ({ ...prev, per_page, page: 1 }))
          }
          perPage={queryParams.per_page}
          itemLabel="questions"
        />
      )}
    </div>
  );
}

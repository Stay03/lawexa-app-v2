'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { AdminPagination } from '@/components/admin';
import { CaseFilters } from '@/components/admin/cases/CaseFilters';
import { CasesTable } from '@/components/admin/cases/CasesTable';
import { CaseDeleteDialog } from '@/components/admin/cases/CaseDeleteDialog';

import { useCourseCases, adminCasesKeys } from '@/lib/hooks/useAdminCases';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { AdminCasesParams, CaseSummary } from '@/types/admin-cases';

interface CourseCasesTabProps {
  courseSlug: string;
}

/**
 * Cases classified under a course. Reuses the global cases table + filters
 * (with the course selector hidden since scope is fixed). State is local so it
 * does not collide with the sibling tabs' paging on the shared detail URL.
 */
export function CourseCasesTab({ courseSlug }: CourseCasesTabProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [params, setParams] = useState<AdminCasesParams>({
    page: 1,
    per_page: 15,
    sort: 'created_at',
    order: 'desc',
  });
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 500);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingCase, setDeletingCase] = useState<CaseSummary | null>(null);

  const queryParams = useMemo<AdminCasesParams>(
    () => ({ ...params, search: debouncedSearch || undefined }),
    [params, debouncedSearch]
  );

  const { data, isLoading } = useCourseCases(courseSlug, queryParams);

  const updateParams = useCallback((updates: Partial<AdminCasesParams>) => {
    setParams((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSort = useCallback(
    (sortBy: 'title' | 'judgment_date' | 'created_at') => {
      setParams((prev) => ({
        ...prev,
        sort: sortBy,
        order: prev.sort === sortBy && prev.order === 'asc' ? 'desc' : 'asc',
        page: 1,
      }));
    },
    []
  );

  const handleEdit = useCallback(
    (caseData: CaseSummary) => router.push(`/admin/cases/${caseData.slug}/edit`),
    [router]
  );

  const handleDelete = useCallback((caseData: CaseSummary) => {
    setDeletingCase(caseData);
    setDeleteOpen(true);
  }, []);

  const handleDeleteSuccess = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: adminCasesKeys.courseCases(courseSlug),
    });
  }, [queryClient, courseSlug]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search cases by title, body, or citation..."
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setParams((prev) => ({ ...prev, page: 1 }));
          }}
          className="pl-9"
        />
      </div>

      <CaseFilters
        params={queryParams}
        onParamsChange={updateParams}
        hideCourseFilter
      />

      <CasesTable
        cases={data?.data || []}
        isLoading={isLoading}
        params={queryParams}
        onSort={handleSort}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {data?.pagination && (
        <AdminPagination
          pagination={data.pagination}
          onPageChange={(page) => updateParams({ page })}
          onPerPageChange={(per_page) => updateParams({ per_page, page: 1 })}
          perPage={queryParams.per_page}
          itemLabel="cases"
        />
      )}

      <CaseDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        case={deletingCase}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}

'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';

import { CoursesTable } from '@/components/admin/courses/CoursesTable';
import { CourseFormDialog } from '@/components/admin/courses/CourseFormDialog';
import { CourseDeleteDialog } from '@/components/admin/courses/CourseDeleteDialog';

import { useCourses, useRestoreCourse } from '@/lib/hooks/useAdminCases';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { extractApiError } from '@/lib/utils/api-error';
import type { Course, CoursesParams } from '@/types/admin-cases';

function CoursesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(
    searchParams.get('search') || ''
  );
  const debouncedSearch = useDebounce(searchInput, 500);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);

  const restoreMutation = useRestoreCourse();

  const params = useMemo<CoursesParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort = searchParams.get('sort') || 'name';
    const order = (searchParams.get('order') as 'asc' | 'desc') || 'asc';
    const with_trashed =
      searchParams.get('with_trashed') === 'true' ? true : undefined;

    return {
      page,
      per_page,
      sort,
      order,
      search: debouncedSearch || undefined,
      with_trashed,
    };
  }, [searchParams, debouncedSearch]);

  const { data, isLoading } = useCourses(params);

  const updateParams = useCallback(
    (updates: Partial<CoursesParams>) => {
      const newParams = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === false) {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });
      const queryString = newParams.toString();
      router.push(queryString ? `/admin/courses?${queryString}` : '/admin/courses');
    },
    [router, searchParams]
  );

  const handleSort = useCallback(
    (sortBy: 'name' | 'created_at') => {
      updateParams({
        sort: sortBy,
        order:
          params.sort === sortBy && params.order === 'asc' ? 'desc' : 'asc',
        page: 1,
      });
    },
    [updateParams, params.sort, params.order]
  );

  const handlePageChange = useCallback(
    (page: number) => updateParams({ page }),
    [updateParams]
  );

  const handlePerPageChange = useCallback(
    (per_page: number) => updateParams({ per_page, page: 1 }),
    [updateParams]
  );

  const handleAdd = useCallback(() => {
    setEditingCourse(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((course: Course) => {
    setEditingCourse(course);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback((course: Course) => {
    setDeletingCourse(course);
    setDeleteOpen(true);
  }, []);

  const handleRestore = useCallback(
    (course: Course) => {
      restoreMutation.mutate(course.id, {
        onSuccess: (response) =>
          toast.success(response.message || 'Course restored'),
        onError: (error) => toast.error(extractApiError(error).message),
      });
    },
    [restoreMutation]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Courses</CardTitle>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Course
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search + show-deleted toggle */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search courses by name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-deleted"
                checked={params.with_trashed === true}
                onCheckedChange={(checked) =>
                  updateParams({ with_trashed: checked || undefined, page: 1 })
                }
              />
              <Label
                htmlFor="show-deleted"
                className="cursor-pointer text-sm text-muted-foreground"
              >
                Show deleted
              </Label>
            </div>
          </div>

          <CoursesTable
            courses={data?.data || []}
            isLoading={isLoading}
            params={params}
            onSort={handleSort}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
          />

          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={handlePageChange}
              onPerPageChange={handlePerPageChange}
              perPage={params.per_page}
              itemLabel="courses"
            />
          )}
        </CardContent>
      </Card>

      <CourseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        course={editingCourse}
      />
      <CourseDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        course={deletingCourse}
      />
    </div>
  );
}

export default function CoursesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Courses</CardTitle>
              <Skeleton className="h-10 w-[130px]" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <CoursesPageContent />
    </Suspense>
  );
}

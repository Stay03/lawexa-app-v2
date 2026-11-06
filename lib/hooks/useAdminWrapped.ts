// Admin Lawexa Wrapped: view tracking numbers. TanStack Query hooks.

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { adminWrappedApi } from '@/lib/api/admin-wrapped';
import type { WrappedAdminStudentQuery } from '@/types/wrapped-admin';

export const adminWrappedKeys = {
  all: ['admin', 'wrapped'] as const,
  summary: () => [...adminWrappedKeys.all, 'summary'] as const,
  students: (query: WrappedAdminStudentQuery) => [...adminWrappedKeys.all, 'students', query] as const,
};

/** The funnel and the splits. One read: the counts are a handful of numbers. */
export function useWrappedSummary() {
  return useQuery({
    queryKey: adminWrappedKeys.summary(),
    queryFn: () => adminWrappedApi.summary(),
  });
}

/**
 * One page of students, filtered by the server. The previous page stays on
 * screen while the next loads, so the table does not blank between pages.
 */
export function useWrappedStudents(query: WrappedAdminStudentQuery) {
  return useQuery({
    queryKey: adminWrappedKeys.students(query),
    queryFn: () => adminWrappedApi.students(query),
    placeholderData: keepPreviousData,
  });
}

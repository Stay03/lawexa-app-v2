import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type { WrappedAdminStudentPage, WrappedAdminStudentQuery, WrappedAdminSummary } from '@/types/wrapped-admin';

/** Drops the empty filters, so the request names only what the admin chose. */
export function studentParams(query: WrappedAdminStudentQuery): Record<string, string | number> {
  const params: Record<string, string | number> = { page: query.page, per_page: query.per_page };
  if (query.status) params.status = query.status;
  if (query.persona) params.persona = query.persona;
  if (query.campus) params.campus = query.campus;
  const search = query.search.trim();
  if (search) params.search = search;
  return params;
}

/**
 * The admin side of Wrapped view tracking (Backend's contract, thread 384c,
 * e717a1af, 6 November 2026). Both calls need role:admin and read the current
 * edition. The student's own calls stay in `wrapped.ts`.
 */
export const adminWrappedApi = {
  summary: async (): Promise<WrappedAdminSummary> => {
    const response = await apiClient.get<ApiResponse<WrappedAdminSummary>>('/admin/wrapped/summary');
    if (!response.data.data) throw new Error('The Wrapped summary came back empty.');
    return response.data.data;
  },

  students: async (query: WrappedAdminStudentQuery): Promise<WrappedAdminStudentPage> => {
    const response = await apiClient.get<ApiResponse<WrappedAdminStudentPage>>('/admin/wrapped/students', {
      params: studentParams(query),
    });
    if (!response.data.data) throw new Error('The Wrapped student list came back empty.');
    return response.data.data;
  },
};

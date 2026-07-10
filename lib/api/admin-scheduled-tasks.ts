// Admin Scheduled Tasks — API service (role:superadmin)
import { apiClient } from './client';
import type { ApiResponse, PaginatedResponse } from '@/types/admin-cases';
import type { ScheduledTask, ScheduledTasksParams } from '@/types/admin-scheduled-tasks';

async function getTasks(
  params: ScheduledTasksParams = {}
): Promise<PaginatedResponse<ScheduledTask>> {
  const { failed_only, ...rest } = params;
  const response = await apiClient.get<PaginatedResponse<ScheduledTask>>(
    '/admin/scheduled-tasks',
    {
      params: {
        ...rest,
        failed_only: failed_only ? 1 : undefined,
      },
    }
  );
  return response.data;
}

async function getTask(uuid: string): Promise<ApiResponse<ScheduledTask>> {
  const response = await apiClient.get<ApiResponse<ScheduledTask>>(
    `/admin/scheduled-tasks/${uuid}`
  );
  return response.data;
}

/** Diagnostic fire-and-forget run; schedule state unchanged. */
async function forceRun(uuid: string): Promise<ApiResponse<null>> {
  const response = await apiClient.post<ApiResponse<null>>(
    `/admin/scheduled-tasks/${uuid}/force-run`
  );
  return response.data;
}

export const adminScheduledTasksApi = {
  getTasks,
  getTask,
  forceRun,
};

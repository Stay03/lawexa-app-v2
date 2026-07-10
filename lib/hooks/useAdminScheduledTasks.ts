'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminScheduledTasksApi } from '@/lib/api/admin-scheduled-tasks';
import type { ScheduledTasksParams } from '@/types/admin-scheduled-tasks';

export const scheduledTaskKeys = {
  all: ['admin', 'scheduled-tasks'] as const,
  lists: () => [...scheduledTaskKeys.all, 'list'] as const,
  list: (params: ScheduledTasksParams) => [...scheduledTaskKeys.lists(), params] as const,
  detail: (uuid: string) => [...scheduledTaskKeys.all, 'detail', uuid] as const,
};

export function useScheduledTasks(
  params: ScheduledTasksParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: scheduledTaskKeys.list(params),
    queryFn: () => adminScheduledTasksApi.getTasks(params),
    staleTime: 30 * 1000,
    enabled: options?.enabled !== false,
  });
}

/**
 * Force-run a task. Fire-and-forget on the backend — we invalidate the list so
 * the row's last_run_at / last_error refresh shortly after.
 */
export function useForceRunScheduledTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => adminScheduledTasksApi.forceRun(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduledTaskKeys.lists() });
    },
  });
}

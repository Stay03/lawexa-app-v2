'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AdminPagination } from '@/components/admin';
import { EnumFilterSelect } from '@/components/admin/observability';
import { ScheduledTasksTable } from '@/components/admin/observability/scheduled-tasks/ScheduledTasksTable';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  useForceRunScheduledTask,
  useScheduledTasks,
} from '@/lib/hooks/useAdminScheduledTasks';
import { extractApiError } from '@/lib/utils/api-error';
import {
  SCHEDULED_TASK_KINDS,
  SCHEDULED_TASK_KIND_LABELS,
  SCHEDULED_TASK_STATUSES,
  type ScheduledTask,
  type ScheduledTaskKind,
  type ScheduledTasksParams,
  type ScheduledTaskStatus,
} from '@/types/admin-scheduled-tasks';

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  const [confirmTask, setConfirmTask] = useState<ScheduledTask | null>(null);
  const forceRunMutation = useForceRunScheduledTask();

  const params = useMemo<ScheduledTasksParams>(() => {
    const kind = searchParams.get('kind') as ScheduledTaskKind | null;
    const status = searchParams.get('status') as ScheduledTaskStatus | null;
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 25,
      kind: kind ?? undefined,
      status: status ?? undefined,
      failed_only: searchParams.get('failed_only') === '1' || undefined,
      user_id: searchParams.get('user_id') ? Number(searchParams.get('user_id')) : undefined,
    };
  }, [searchParams]);

  const { data, isLoading } = useScheduledTasks(params, { enabled: isSuperadmin });

  const updateParams = useCallback(
    (updates: Partial<ScheduledTasksParams>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === false) next.delete(key);
        else if (key === 'failed_only') next.set(key, '1');
        else next.set(key, String(value));
      });
      const qs = next.toString();
      router.push(qs ? `/admin/operations/scheduled-tasks?${qs}` : '/admin/operations/scheduled-tasks');
    },
    [router, searchParams]
  );

  const confirmForceRun = useCallback(() => {
    if (!confirmTask) return;
    const uuid = confirmTask.uuid;
    forceRunMutation.mutate(uuid, {
      onSuccess: () => {
        toast.success('Task dispatched — re-checking status shortly');
        setConfirmTask(null);
      },
      onError: (error) => toast.error(extractApiError(error).message),
    });
  }, [confirmTask, forceRunMutation]);

  if (authLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!isSuperadmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ShieldAlert className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Superadmin access required</p>
            <p className="text-sm text-muted-foreground">
              Scheduled task management is restricted to superadmins.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CalendarClock className="h-6 w-6 text-primary" />
          Scheduled Tasks
        </h1>
        <p className="text-sm text-muted-foreground">
          Cron-scheduled per-user work. Latest-run state only — there is no per-run history yet.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <CardTitle className="text-lg">Tasks</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={params.failed_only ? 'default' : 'outline'}
              size="sm"
              className="h-9"
              onClick={() => updateParams({ failed_only: !params.failed_only, page: 1 })}
            >
              Failed only
            </Button>
            <EnumFilterSelect
              value={params.kind}
              options={SCHEDULED_TASK_KINDS}
              onChange={(v) => updateParams({ kind: v as ScheduledTaskKind | undefined, page: 1 })}
              placeholder="Kind"
              allLabel="All kinds"
              labelFor={(v) => SCHEDULED_TASK_KIND_LABELS[v as ScheduledTaskKind] ?? v}
            />
            <EnumFilterSelect
              value={params.status}
              options={SCHEDULED_TASK_STATUSES}
              onChange={(v) => updateParams({ status: v as ScheduledTaskStatus | undefined, page: 1 })}
              placeholder="Status"
              allLabel="All statuses"
              className="w-[150px]"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScheduledTasksTable
            tasks={data?.data || []}
            isLoading={isLoading}
            forceRunningUuid={forceRunMutation.isPending ? confirmTask?.uuid ?? null : null}
            onForceRun={(task) => setConfirmTask(task)}
          />
          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={(page) => updateParams({ page })}
              itemLabel="tasks"
            />
          )}
        </CardContent>
      </Card>

      {/* Force-run confirmation */}
      <AlertDialog
        open={!!confirmTask}
        onOpenChange={(open) => !open && !forceRunMutation.isPending && setConfirmTask(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force-run this task now?</AlertDialogTitle>
            <AlertDialogDescription>
              This runs the handler once immediately, <strong>including real side effects</strong>{' '}
              (e.g. sending the scheduled message or email). The schedule is unchanged —{' '}
              <code>next_run_at</code> is not advanced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmTask && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <span className="font-medium">
                {SCHEDULED_TASK_KIND_LABELS[confirmTask.kind] ?? confirmTask.kind}
              </span>
              {confirmTask.description && (
                <span className="text-muted-foreground"> — {confirmTask.description}</span>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={forceRunMutation.isPending}>Cancel</AlertDialogCancel>
            <Button onClick={confirmForceRun} disabled={forceRunMutation.isPending}>
              {forceRunMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Force run
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ScheduledTasksPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <PageContent />
    </Suspense>
  );
}

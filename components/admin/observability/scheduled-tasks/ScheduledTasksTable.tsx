'use client';

import { useState } from 'react';
import { Play, Loader2, AlertCircle } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { makeStatusMeta } from '@/lib/utils/observability';
import {
  ObservabilityTable,
  StatusBadge,
  TimeAgoCell,
  type ObservabilityColumn,
} from '@/components/admin/observability';
import {
  SCHEDULED_TASK_KIND_LABELS,
  type ScheduledTask,
  type ScheduledTaskStatus,
} from '@/types/admin-scheduled-tasks';

const taskStatusMeta = makeStatusMeta<ScheduledTaskStatus>({
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  completed: { label: 'Completed', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'danger' },
});

const COLUMNS: ObservabilityColumn[] = [
  { key: 'task', label: 'Task' },
  { key: 'schedule', label: 'Schedule', className: 'w-[220px]' },
  { key: 'last', label: 'Last run', className: 'w-[180px]' },
  { key: 'status', label: 'Status', className: 'w-[120px]' },
  { key: 'actions', label: '', className: 'w-[120px]' },
];

/** Active tasks whose next_run_at is > 5 min in the past — scheduler tick likely broken. */
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

interface ScheduledTasksTableProps {
  tasks: ScheduledTask[];
  isLoading: boolean;
  forceRunningUuid: string | null;
  onForceRun: (task: ScheduledTask) => void;
}

export function ScheduledTasksTable({
  tasks,
  isLoading,
  forceRunningUuid,
  onForceRun,
}: ScheduledTasksTableProps) {
  // Capture a single reference time on mount (avoids Date.now() in render).
  const [now] = useState(() => Date.now());

  return (
    <ObservabilityTable
      columns={COLUMNS}
      isLoading={isLoading}
      isEmpty={tasks.length === 0}
      emptyText="No scheduled tasks found"
    >
      {tasks.map((task, index) => {
        const isStale =
          task.status === 'active' &&
          task.next_run_at != null &&
          now - new Date(task.next_run_at).getTime() > STALE_THRESHOLD_MS;
        const isRunning = forceRunningUuid === task.uuid;

        return (
          <TableRow key={task.uuid} className={cn(index % 2 === 1 && 'bg-muted/20')}>
            {/* Task */}
            <TableCell className="max-w-[320px]">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 font-normal">
                  {SCHEDULED_TASK_KIND_LABELS[task.kind] ?? task.kind}
                </Badge>
                <span className="truncate text-sm font-medium">
                  {task.description ?? '—'}
                </span>
              </div>
              {task.fail_count > 0 && (
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="border-transparent bg-destructive/10 text-[10px] text-destructive"
                  >
                    {task.fail_count} consecutive fail{task.fail_count === 1 ? '' : 's'}
                  </Badge>
                  {task.last_error && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex cursor-help items-center text-destructive">
                          <AlertCircle className="h-3.5 w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[400px]">
                        <p className="whitespace-pre-wrap text-xs">{task.last_error}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
            </TableCell>

            {/* Schedule */}
            <TableCell>
              <p className="font-mono text-xs">{task.schedule_cron}</p>
              <p className="text-xs text-muted-foreground">{task.timezone}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">next:</span>
                <TimeAgoCell value={task.next_run_at} />
                {isStale && (
                  <Badge
                    variant="outline"
                    className="border-transparent bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  >
                    overdue
                  </Badge>
                )}
              </div>
            </TableCell>

            {/* Last run */}
            <TableCell>
              <TimeAgoCell value={task.last_run_at} />
            </TableCell>

            {/* Status */}
            <TableCell>
              <StatusBadge meta={taskStatusMeta(task.status)} />
            </TableCell>

            {/* Actions */}
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => onForceRun(task)}
                disabled={isRunning}
              >
                {isRunning ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                )}
                Force run
              </Button>
            </TableCell>
          </TableRow>
        );
      })}
    </ObservabilityTable>
  );
}

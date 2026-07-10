// Admin Scheduled Tasks — types
// Backend: /api/admin/scheduled-tasks[/{uuid}|/{uuid}/force-run] (role:SUPERADMIN)

export type ScheduledTaskKind =
  | 'send_scheduled_chat_message'
  | 'send_scheduled_email'
  | 'radar_scan';

export const SCHEDULED_TASK_KINDS: ScheduledTaskKind[] = [
  'send_scheduled_chat_message',
  'send_scheduled_email',
  'radar_scan',
];

export const SCHEDULED_TASK_KIND_LABELS: Record<ScheduledTaskKind, string> = {
  send_scheduled_chat_message: 'Scheduled chat',
  send_scheduled_email: 'Scheduled email',
  radar_scan: 'Radar scan',
};

export type ScheduledTaskStatus =
  | 'active'
  | 'paused'
  | 'cancelled'
  | 'completed'
  | 'failed';

export const SCHEDULED_TASK_STATUSES: ScheduledTaskStatus[] = [
  'active',
  'paused',
  'cancelled',
  'completed',
  'failed',
];

export interface ScheduledTask {
  uuid: string;
  kind: ScheduledTaskKind;
  description: string | null;
  schedule_cron: string;
  timezone: string;
  next_run_at: string | null;
  /** The ONLY run-history field the table stores. */
  last_run_at: string | null;
  status: ScheduledTaskStatus;
  fail_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledTasksParams {
  user_id?: number;
  kind?: ScheduledTaskKind;
  status?: ScheduledTaskStatus;
  /** Only tasks with fail_count > 0, regardless of status. */
  failed_only?: boolean;
  per_page?: number;
  page?: number;
}

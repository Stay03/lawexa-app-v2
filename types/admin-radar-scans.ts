// Admin Radar scan observability — types
// Backend: /api/admin/radar-scans[/summary] (role:admin)

import type { JobUserRef } from '@/lib/utils/observability';

export type RadarScanStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped_no_balance';

export const RADAR_SCAN_STATUSES: RadarScanStatus[] = [
  'queued',
  'running',
  'completed',
  'failed',
  'skipped_no_balance',
];

export type RadarScanTrigger = 'schedule' | 'manual';

export const RADAR_SCAN_TRIGGERS: RadarScanTrigger[] = ['schedule', 'manual'];

export interface RadarScanRadar {
  id: number;
  uuid: string;
  name: string;
  /** Non-null when the radar was later soft-deleted (scan still attributable). */
  deleted_at: string | null;
  user: JobUserRef | null;
}

export interface RadarScan {
  id: number;
  uuid: string;
  status: RadarScanStatus;
  triggered_by: RadarScanTrigger;
  has_findings: boolean;
  title: string | null;
  error: string | null;
  duration_ms: number | null;
  ai_request_id: number | null;
  message_id: number | null;
  /** null only when the radar row is hard-deleted. */
  radar: RadarScanRadar | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface RadarScanSummary {
  scans: Record<RadarScanStatus, number>;
  last_7_days: Record<RadarScanStatus, number>;
  /** queued/running older than the stale threshold — sweeper should keep at 0. */
  stuck_in_flight: number;
}

export interface RadarScansParams {
  status?: RadarScanStatus;
  radar_id?: number;
  user_id?: number;
  triggered_by?: RadarScanTrigger;
  has_findings?: boolean;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}

/** 7-day failure rate = failed / (completed + failed). Returns 0 when no runs. */
export function failureRate(counts: Record<RadarScanStatus, number>): number {
  const denom = counts.completed + counts.failed;
  return denom > 0 ? counts.failed / denom : 0;
}

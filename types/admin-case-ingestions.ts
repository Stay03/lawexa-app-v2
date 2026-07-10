// Admin Case PDF ingestion observability — types
// Backend: /api/admin/case-ingestions[/{id}|/summary] (role:admin)

import type { JobUserRef } from '@/lib/utils/observability';

export type CaseIngestionStatus = 'pending' | 'running' | 'completed' | 'failed';

export const CASE_INGESTION_STATUSES: CaseIngestionStatus[] = [
  'pending',
  'running',
  'completed',
  'failed',
];

export interface CaseIngestionCountry {
  id: number;
  name: string;
}

/** Set on completed runs — link straight to the created case. */
export interface CaseIngestionResult {
  case_id: number;
  case_slug: string;
  resolutions?: unknown;
  metadata?: unknown;
}

export interface CaseIngestion {
  /** Job UUID — the same job_id the uploader polls with. */
  id: string;
  user: JobUserRef | null;
  country: CaseIngestionCountry | null;
  status: CaseIngestionStatus;
  report_file_name: string | null;
  report_file_path: string | null;
  error: string | null;
  status_code: number | null;
  result: CaseIngestionResult | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CaseIngestionSummary {
  jobs: Record<CaseIngestionStatus, number>;
  /** running with started_at > 30 min ago — worker died mid-run; should be 0. */
  stuck_running: number;
  failed_last_7_days: number;
}

export interface CaseIngestionsParams {
  status?: CaseIngestionStatus;
  user_id?: number;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}

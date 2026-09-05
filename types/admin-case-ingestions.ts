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

/**
 * How the judgment reached us. `pdf` and `akn_xml` are uploads and carry a file;
 * `legal_api` is fetched from a provider by id and has no file at all, which is
 * why the list cannot key on `report_file_name` alone.
 */
export type CaseIngestionSourceFormat = 'legal_api' | 'akn_xml' | 'pdf';

export const CASE_INGESTION_SOURCE_FORMATS: CaseIngestionSourceFormat[] = [
  'legal_api',
  'akn_xml',
  'pdf',
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
  source_format: CaseIngestionSourceFormat;
  /**
   * The provider's own id for the judgment, e.g. `nwlr:1897_1_175`. Set only on
   * `legal_api` jobs; an upload has no provider and leaves this null. It is the
   * ONLY thing that identifies which case a provider job is for while it runs,
   * because the case row does not exist yet.
   */
  provider_case_id: string | null;
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
  source_format?: CaseIngestionSourceFormat;
  user_id?: number;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}

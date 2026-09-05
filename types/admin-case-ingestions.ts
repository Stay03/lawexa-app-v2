// Admin Case PDF ingestion observability — types
// Backend: /api/admin/case-ingestions[/{id}|/summary] (role:admin)

import type { JobUserRef } from '@/lib/utils/observability';

/**
 * `duplicate` is TERMINAL AND IT IS NOT A FAILURE.
 *
 * A blast ticket closes as `duplicate` when the fetched judgment is one we
 * already hold, and it creates nothing. It never passes through `pending`, so
 * a duplicate row has no start and no run to watch: the decision was made
 * before the work was queued. Reading it as a failure would have somebody
 * retrying it, and retrying is exactly the thing it exists to prevent.
 */
export type CaseIngestionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'duplicate';

export const CASE_INGESTION_STATUSES: CaseIngestionStatus[] = [
  'pending',
  'running',
  'completed',
  'failed',
  'duplicate',
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

/**
 * WHY THE INGEST THINKS TWO RECORDS ARE THE SAME JUDGMENT.
 *
 * Each value is a whole test, not a field name, and they are ranked by how
 * hard they are to fake. Court and suit number is the strongest thing we have
 * and the only one that ran before 5 September 2026; the other two were added
 * after a blast batch created four duplicates that this check could not see,
 * because the copies we held carried no suit number to compare.
 */
export type CaseDuplicateSignal =
  | 'court_and_suit_no'
  | 'judgment_date_and_parties'
  | 'reporter_volume_and_page';

/**
 * A case the ingest believes this judgment already exists as.
 *
 * `case_slug` is what a link needs and it is NOT guaranteed: a row that names
 * only an id still has to be readable, so anything rendering this must fall
 * back to the id rather than build a broken href.
 */
export interface CaseDuplicateRef {
  case_id: number;
  case_slug?: string | null;
  case_title?: string | null;
  matched_on?: CaseDuplicateSignal | string;
  /** The server's own sentence, e.g. `same court and suit number "SC.86/2017"`. */
  detail?: string | null;
}

/**
 * Set on completed runs — link straight to the created case.
 *
 * On a `duplicate` job there is no created case: `duplicate_of` names the one
 * we already hold and `case_id`/`case_slug` are absent, which is why both are
 * optional here rather than merely empty.
 */
export interface CaseIngestionResult {
  case_id?: number;
  case_slug?: string;
  /** Set when the job closed as `duplicate`; nothing was created. */
  duplicate_of?: CaseDuplicateRef | null;
  /**
   * Cases the ingest flagged while still creating this one. Present on
   * completed jobs and NOT a refusal: the case exists and somebody has to
   * judge it. This was arriving on the payload for months with no screen
   * reading it, which is how four duplicates reached the library unnoticed.
   */
  possible_duplicates?: CaseDuplicateRef[] | null;
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

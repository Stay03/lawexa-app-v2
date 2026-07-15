// Admin Case Enrichment monitoring — type definitions
// Backend: docs/api/case-structures-and-enrichment.md §3 (role:admin)

export type EnrichmentTrigger = 'ingest' | 'backfill' | 'manual';

export type EnrichmentStatus = 'running' | 'completed' | 'failed' | 'skipped';

export type EnrichmentSkipReason = 'already_enriched' | 'no_full_report';

/** Compact case reference embedded on an enrichment run. */
export interface EnrichmentCaseRef {
  id: number;
  title: string;
  display_title?: string | null;
  slug: string;
}

/**
 * What a run wrote per structure. A completed run with all zeros found nothing
 * new to fill. Skipped runs carry `reason` instead of counts.
 */
export interface EnrichmentStats {
  principles?: number;
  citations?: number;
  statutes?: number;
  histories?: number;
  scalars?: string[];
  reason?: EnrichmentSkipReason;
}

/** One enrichment attempt (automatic on upload, backfill command, or manual). */
export interface CaseEnrichmentRun {
  id: number;
  case: EnrichmentCaseRef | null;
  trigger: EnrichmentTrigger;
  status: EnrichmentStatus;
  /** Failure reason, verbatim — shown in the failed-runs table. */
  error: string | null;
  stats: EnrichmentStats | null;
  /** Court's own disposition wording when it mapped to NO outcome enum value. */
  outcome_raw: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

/** Dashboard aggregate from GET /api/admin/case-enrichments/summary. */
export interface CaseEnrichmentSummary {
  /** Cases with a full report — the enrichable universe. */
  eligible_cases: number;
  /** Eligible cases still without structured principles (backfill to-do). */
  remaining_cases: number;
  /** Distinct cases with >= 1 completed run. */
  enriched_cases: number;
  /** Lifetime run counts by status. */
  runs: Record<EnrichmentStatus, number>;
  /** Rows carrying outcome_raw — the outcome-enum extension feed. */
  unmapped_outcomes: number;
}

/** Query params for GET /api/admin/case-enrichments. */
export interface CaseEnrichmentsParams {
  status?: EnrichmentStatus;
  trigger?: EnrichmentTrigger;
  case_id?: number;
  unmapped_outcomes?: boolean;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}

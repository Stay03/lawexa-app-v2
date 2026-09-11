// Admin Case Enrichment monitoring — type definitions
// Backend: docs/api/case-structures-and-enrichment.md §3 (role:admin)

/**
 * What started a run. `resume` is the 30-minute sweep
 * (`case-enrichments:resume-partial`) asking for the parts a partial run left
 * missing.
 */
export type EnrichmentTrigger = 'ingest' | 'backfill' | 'manual' | 'resume';

/**
 * `partial` ends the RUN, not the case: some parts of the report came back and
 * were written, and the rest wait for a resume.
 */
export type EnrichmentStatus = 'running' | 'completed' | 'partial' | 'failed' | 'skipped';

/** `already_running`: another run on the same case was still going. */
export type EnrichmentSkipReason = 'already_enriched' | 'no_full_report' | 'already_running';

/** Compact case reference embedded on an enrichment run. */
export interface EnrichmentCaseRef {
  id: number;
  title: string;
  display_title?: string | null;
  slug: string;
}

/**
 * A part of the report that failed, and why. Part indexes count from 0. A
 * failed run can carry these with no list of parts read at all.
 */
export interface EnrichmentChunkError {
  chunk: number;
  error: string;
  /** The AI service's error code when it gave one, else null. */
  code?: string | number | null;
}

/** A scalar read from a later part, held until every part before it is read. */
export interface EnrichmentWithheldScalar {
  chunk: number;
  /** Whatever the model read for that field, which is not always a string. */
  value: unknown;
}

/**
 * How a run's report was cut and which parts came back, on runs from the API
 * deploy that introduced partial runs (September 2026). Part indexes count
 * from 0. Read it only through `components/admin/case-enrichments/chunks.ts`:
 * older runs have no record, and a run made by the API's factories can carry
 * a plain number in its place.
 */
export interface EnrichmentChunks {
  /** Hash of the report text this run read. */
  report: string;
  /** Chunk size / overlap / cap, e.g. "40000/2000/20". */
  geometry: string;
  extractor: string;
  /** Parts the report cuts into. */
  total: number;
  /** Written before the model call, so a failed or reaped run still has it. */
  plan?: {
    requested: number[];
    /** The partial run this one continues, or null on a first read. */
    resumes: number | null;
  };
  /** Every part read over this report text so far. Absent when none came back. */
  done?: number[];
  missing?: number[];
  errors?: EnrichmentChunkError[];
  /** Keyed by field name. */
  withheld?: Record<string, EnrichmentWithheldScalar>;
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
  chunks?: EnrichmentChunks | number;
}

/** One enrichment attempt (automatic on upload, backfill command, manual, or resume). */
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
  /**
   * Cases whose latest run with an outcome is partial. Optional because the
   * frontend can deploy before the API that sends it.
   */
  partial_cases?: number;
  /** Lifetime run counts by status. `partial` is optional for the same reason. */
  runs: Record<Exclude<EnrichmentStatus, 'partial'>, number> & { partial?: number };
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

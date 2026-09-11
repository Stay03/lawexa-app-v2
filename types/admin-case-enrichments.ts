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

/**
 * Why a run was skipped. `already_running`: another run of the case was still
 * going, and `stats.running` is its id. `superseded`: a queued resume that
 * another run of the case overtook, and `stats.overtaken_by` is that run's id.
 */
export type EnrichmentSkipReason =
  | 'already_enriched'
  | 'no_full_report'
  | 'already_running'
  | 'superseded';

/**
 * A state of a partial case that the resume sweep does not move on its own.
 * `stopped`: 3 attempts in a row recovered no part over the current report
 * text. `text_changed`: the report was replaced after the partial run, so the
 * sweep neither retries nor stops it. A case is in one state at most.
 */
export type EnrichmentSweep = 'stopped' | 'text_changed';

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
  /**
   * The classifier's error code, such as "retry_deadline" or
   * "connection_error", or null. The API sends a string or null.
   */
  code?: string | null;
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
  /** On an `already_running` skip: the run that was still going. */
  running?: number;
  /** On a `superseded` skip: the run that overtook this one. */
  overtaken_by?: number;
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
  /**
   * The part of `partial_cases` the resume sweep has stopped on: 3 attempts in
   * a row recovered no part over the case's current report text, so nothing
   * retries it. Optional for the same reason.
   */
  partial_stopped_cases?: number;
  /**
   * The part of `partial_cases` whose partial run read a report text the case
   * no longer holds. The sweep neither retries nor stops these, and it never
   * overlaps `partial_stopped_cases`. Optional for the same reason.
   */
  partial_text_changed_cases?: number;
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
  /**
   * Only the partial runs of cases in that sweep state, one row per case. The
   * API accepts "stopped" and "text_changed"; anything else is a 422.
   */
  sweep?: EnrichmentSweep;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}

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
 * were written, and the rest stay missing until a later run reads them. The
 * resume sweep starts those runs, except for a stopped case or one whose report
 * text changed.
 */
export type EnrichmentStatus = 'running' | 'completed' | 'partial' | 'failed' | 'skipped';

/**
 * Why a run was skipped. `already_running`: another run of the case was
 * running, and `stats.running` is its id. `superseded`: a queued resume that
 * another run of the case overtook, and `stats.overtaken_by` is that run's id.
 */
export type EnrichmentSkipReason =
  | 'already_enriched'
  | 'no_full_report'
  | 'already_running'
  | 'superseded';

/**
 * A state of a partial case that the resume sweep does not resume. `stopped`:
 * each of the last 3 attempts after the partial run read the current report
 * text or recorded none, and recovered no new part. `text_changed`: the report
 * text changed after the partial run. A case is in one state at most.
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
 * What the AI service said under a part's failure. Every field is optional:
 * runs from before the API carried it have `error` and nothing else.
 *
 * Measured on every enrichment run the admin API held, 15 September 2026:
 * 95 failed runs that day carry `code` 'schema_violation' (90), 'rate_limited'
 * (4) or 'retry_deadline' (1). `retryable` is false on a schema violation and
 * true on a rate limit, which is the distinction no screen was drawing.
 */
export interface EnrichmentChunkErrorDetails {
  code?: string;
  message?: string;
  retryable?: boolean;
  last_error_code?: string;
  details?: {
    /**
     * The model's answer, cut to 405 characters: 200 of the opening, a marker,
     * then 200 of the ending. The AI service truncates it before the API's own
     * trimmer does, so the whole answer is not stored anywhere. Do not measure
     * its length or count its brackets: both describe the cut, not the model.
     */
    raw_output?: string;
    raw_output_first_attempt?: string;
    /**
     * What the validator said, untruncated. On 8-15 September every recorded
     * entry was a JSON parse error carrying the character the answer stopped
     * at (98 of 98), and none complained about a field or a type.
     */
    validation_errors?: string[];
    upstream_code?: string;
    upstream_details?: unknown;
  };
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
  details?: EnrichmentChunkErrorDetails;
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
  /** On an `already_running` skip: the run that was running at the time. */
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

/**
 * Dashboard aggregate from GET /api/admin/case-enrichments/summary.
 *
 * The three partial counts are optional because the frontend can deploy before
 * the API that sends them. The screens treat anything but a number as not sent.
 */
export interface CaseEnrichmentSummary {
  /** Cases with a full report — the enrichable universe. */
  eligible_cases: number;
  /** Eligible cases still without structured principles (backfill to-do). */
  remaining_cases: number;
  /** Distinct cases with >= 1 completed run. */
  enriched_cases: number;
  /** Cases whose latest run with an outcome is partial. */
  partial_cases?: number;
  /**
   * The part of `partial_cases` the resume sweep no longer retries: each of the
   * last 3 attempts after the partial run read the current report text or
   * recorded none, and recovered no new part. Its presence also says the API
   * accepts `sweep=stopped`.
   */
  partial_stopped_cases?: number;
  /**
   * The part of `partial_cases` whose partial run read a report text the case
   * no longer holds, which the sweep does not resume. It never overlaps
   * `partial_stopped_cases`. Its presence also says the API accepts
   * `sweep=text_changed`.
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

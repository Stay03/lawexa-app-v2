// Admin Case Data Review — type definitions
// Backend: /api/admin/case-data-review (role:researcher), docs/api/admin-case-data-review.md
//
// Written against real production responses, not the document alone. Where the
// two disagreed the response won, and the difference is recorded here.

/******************************************************************************
                              Problems
******************************************************************************/

/**
 * The nine defects a case can carry. Server-defined and closed: one place in
 * the API defines each problem's finder, its count and its per-row flag, so the
 * left nav and the table can never disagree about how much work exists. That
 * was checked against production on 2026-08-14: all nine counts in `summary`
 * match the totals of the list they open, blocked figures included.
 */
export type CaseProblemKey =
  | 'no_full_report'
  | 'no_court'
  | 'unidentified_court'
  | 'no_judges'
  | 'no_judgment_date'
  | 'no_citation'
  | 'lawexa_elr_branding'
  | 'citation_in_title'
  | 'year_mismatch';

/** One problem as it appears ON A ROW (the row carries every problem it has). */
export interface CaseProblem {
  key: CaseProblemKey;
  label: string;
  /**
   * True when only the judgment text can fix this, so no amount of tidying our
   * own data will. It is what separates "waiting on the provider" from "someone
   * can do this now".
   */
  needs_source_content: boolean;
}

/** One problem as it appears in the SUMMARY (counts, no row context). */
export interface CaseProblemCount {
  label: string;
  total: number;
  /** How many of `total` we cannot compute a corrected value for. */
  blocked: number;
}

/******************************************************************************
                              The fix preview
******************************************************************************/

/**
 * `blocked` is the state that matters. Our citation generator fills the year
 * and court in from the case itself, so a case parked on the placeholder court
 * happily produces `(1956) LELR-131 (NG-N)`: a string that reads exactly like a
 * real citation and identifies nothing. Showing that to a reviewer is what
 * recruits them into approving it. 681 production cases are in this state.
 */
export type FixState = 'proposed' | 'already_correct' | 'blocked';

/** Set only when blocked. Switch on this, never on the label. */
export type FixBlockedReason =
  | 'court_missing'
  | 'court_not_identified'
  | 'date_missing'
  | 'year_not_trustworthy';

/** One field's current and corrected value. `after` is null when blocked. */
export interface FixField {
  before: string | null;
  after: string | null;
}

export interface CaseFixPreview {
  state: FixState;
  reason: FixBlockedReason | null;
  /** Wording, and it will change. For display only. */
  reason_label: string | null;
  title: FixField;
  citation: FixField;
}

/******************************************************************************
                              Rows
******************************************************************************/

/** The court as this endpoint returns it: flatter than the full `Court`. */
export interface ReviewCourt {
  id: number;
  name: string;
  abbreviation: string | null;
  /**
   * NOT how an unidentified court is found. 161 production courts carry this
   * flag and they are real ones, including the House of Lords, which cite
   * perfectly well. `unidentified_court` is found by the court itself.
   */
  pending_review: boolean;
}

export interface ReviewCreator {
  id: number;
  name: string;
}

export interface CaseReviewRow {
  id: number;
  title: string;
  short_title: string | null;
  slug: string;
  citation: string | null;
  judgment_date: string | null;
  court: ReviewCourt | null;
  has_full_report: boolean;
  has_judges: boolean;
  judges_count: number;
  /** Both counts are here to settle duplicates: the copy people actually
   *  opened is the copy to keep. */
  views_count: number;
  bookmarks_count: number;
  created_at: string;
  created_by: ReviewCreator | null;
  problems: CaseProblem[];
  fix: CaseFixPreview;
}

/******************************************************************************
                              Duplicates
******************************************************************************/

/** How copies were grouped. Title grouping is an exact match after spacing and
 *  punctuation are stripped, so it misses copies whose fused citation tails
 *  differ; citation grouping catches those instead. Neither is a superset. */
export type DuplicateGroupBy = 'title' | 'citation';

/**
 * A group is EVIDENCE, never an instruction. Production holds one citation,
 * `(2013) 15 NWLR (PT. 1378) 455`, sitting on two genuinely different
 * judgments, so anything that merged a group automatically would fuse
 * unrelated cases. There is no merge endpoint, by design.
 */
export interface DuplicateGroup {
  /** The normalised string the group was formed on. Not for display. */
  key: string;
  case_count: number;
  cases: CaseReviewRow[];
}

/******************************************************************************
                              Query parameters
******************************************************************************/

export interface CaseDataReviewParams {
  /** Omit for every live case, including the healthy ones. */
  problem?: CaseProblemKey;
  /** True for only the ones we cannot compute a fix for, false for only the
   *  ones we can. Omit for both. */
  blocked?: boolean;
  court_id?: number;
  country_id?: number;
  /**
   * A plain LIKE over title, short title and citation, deliberately not the
   * relevance-backed case search: this queue needs to find an exact broken
   * string such as `LAWEXA ELR`, which is what a relevance index is built not
   * to do.
   */
  search?: string;
  per_page?: number;
  page?: number;
}

export interface DuplicatesParams {
  by?: DuplicateGroupBy;
  per_page?: number;
  page?: number;
}

/******************************************************************************
                              Responses
******************************************************************************/

export interface CaseDataReviewSummary {
  live_cases: number;
  /**
   * A case can carry several problems at once, so these totals overlap and
   * MUST NOT be added together. Measured: 11,571 live cases against 46,960
   * problem rows.
   */
  problems: Record<CaseProblemKey, CaseProblemCount>;
}

/**
 * The duplicates endpoint returns a raw framework paginator nested under
 * `data`, where the list endpoint returns `{ data, pagination }`. Two different
 * envelopes on the same prefix, confirmed against production rather than
 * assumed from the document, which shows neither.
 */
export interface DuplicatesPage {
  current_page: number;
  data: DuplicateGroup[];
  from: number | null;
  to: number | null;
  per_page: number;
  last_page: number;
  total: number;
}

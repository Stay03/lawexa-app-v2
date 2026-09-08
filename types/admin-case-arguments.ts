// Admin Case Argument review queue — type definitions
// Backend: /api/admin/case-arguments (role:researcher)
//
// The twin of `admin-case-principles.ts`. Shapes read off a live row rather
// than off a document, on 8 September 2026, because the two queues are similar
// enough that assuming would have been cheap and wrong: an argument carries a
// side, a counsel and the court's response, none of which a principle has.

/** Which party made the submission. Read off the live queue: only these two. */
export type ArgumentSide = 'appellant' | 'respondent';

/** Case reference embedded on a queue item (court/country as display strings). */
export interface ArgumentCaseRef {
  id: number;
  title: string;
  display_title?: string | null;
  slug: string;
  court: string | null;
  country: string | null;
}

/** A person the row is attributed to. Null when the extraction found none. */
export interface ArgumentPersonRef {
  id: number;
  name: string;
}

/** An authority the argument leaned on, as the extraction recorded it. */
export interface ArgumentAuthorityRef {
  id: number;
  cited_case_id?: number | null;
  slug?: string | null;
  title?: string | null;
  display_title?: string | null;
  raw?: string | null;
  citation?: string | null;
}

/** One extracted argument awaiting (or past) review. */
export interface CaseArgumentReviewItem {
  id: number;
  case: ArgumentCaseRef | null;
  side: ArgumentSide | null;
  /** Resolved counsel record, when the name matched somebody we hold. */
  counsel: ArgumentPersonRef | null;
  /** What the report printed, before matching. Often null. */
  counsel_name_raw: string | null;
  /** The name to show: the resolved one, or the printed one, or nothing. */
  counsel_name: string | null;
  /** The submission itself, in counsel's own terms. This is what is reviewed. */
  argument: string | null;
  /**
   * What the COURT did with the submission, not what a reviewer decided.
   * `rejected_at` is the reviewer's verdict and this is the judgment's; the
   * two are unrelated and were confused once already on the case page.
   */
  status: string | null;
  /** The court's reasoning on this submission, when the report carries it. */
  court_response: string | null;
  judge: ArgumentPersonRef | null;
  authorities: ArgumentAuthorityRef[];

  /** See the notes in `admin-case-principles.ts`; identical contract. */
  verbatim_score: number | null;
  verbatim_quote: string | null;
  verbatim_quote_key: string | null;
  verbatim_window: string | null;

  sort_order: number;
  /**
   * True once a reviewer has decided, EITHER WAY. A rejected row is
   * `reviewed: true` with `rejected_at` set, which is why every count of
   * approved rows in this screen also tests `rejected_at === null`.
   */
  reviewed: boolean;
  reviewed_at: string | null;
  /** Set when a reviewer threw it out. The row is kept, never deleted. */
  rejected_at: string | null;
  created_at: string;
}

/**
 * Editorial aggregate. `reviewed` is APPROVED ONLY — the server excludes
 * rejected rows from it and counts them separately, so the three numbers do
 * not overlap and `unreviewed + reviewed + rejected` is the whole table.
 */
export interface CaseArgumentsSummary {
  unreviewed: number;
  reviewed: number;
  rejected: number;
  cases_with_unreviewed: number;
  reviewed_today: number;
  rejected_today: number;
}

/** Query params for GET /api/admin/case-arguments. Unreviewed by default. */
export interface CaseArgumentsParams {
  reviewed?: boolean;
  /** True returns thrown-out rows, whatever their `reviewed` flag says. */
  rejected?: boolean;
  case_id?: number;
  side?: ArgumentSide;
  counsel_id?: number;
  judge_id?: number;
  court_id?: number;
  country_id?: number;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}

/** PATCH body — all optional. `reviewed: true` fixes-and-approves in one call. */
export interface UpdateArgumentData {
  argument?: string;
  side?: ArgumentSide;
  status?: string | null;
  court_response?: string | null;
  counsel_id?: number | null;
  judge_id?: number | null;
  reviewed?: true;
}

/** Body for POST /{id}/reject. The reason is the only record of the mistake. */
export interface RejectArgumentData {
  reason?: string;
}

/** Result of POST /bulk-approve. */
export interface ArgumentBulkApproveResult {
  approved: number;
  cases_reindexed?: number;
}

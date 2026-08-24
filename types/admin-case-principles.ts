// Admin Case Principle review queue — type definitions
// Backend: docs/api/case-structures-and-enrichment.md §4 (role:researcher)

export type PrincipleType = 'ratio' | 'obiter';

export type PrincipleLawType = 'procedural' | 'substantive';

/** Case reference embedded on a queue item (court/country as display strings). */
export interface PrincipleCaseRef {
  id: number;
  title: string;
  display_title?: string | null;
  slug: string;
  court: string | null;
  country: string | null;
}

/** Judge a principle is attributed to. Null when unattributed. */
export interface PrincipleJudgeRef {
  id: number;
  name: string;
}

/** Reviewer stamp, present once approved. */
export interface PrincipleReviewer {
  id: number;
  name: string;
}

/** One extracted principle awaiting (or past) review. */
export interface CasePrincipleReviewItem {
  id: number;
  case: PrincipleCaseRef | null;
  principle: string;
  judge: PrincipleJudgeRef | null;
  type: PrincipleType | null;
  tag: string | null;
  law_type: PrincipleLawType[] | null;
  order: number;
  reviewed: boolean;
  reviewed_by: PrincipleReviewer | null;
  reviewed_at: string | null;
  created_at: string;

  /**
   * How much of this principle is word for word in the judgment, 0 to 100.
   *
   * ── IT IS A TRIPWIRE, NOT A WORKLIST ──────────────────────────────────
   * Measured across ~400 principles by the backend and 149 by this side:
   * nothing scores below 80 and almost everything scores 100. The check does
   * discriminate — invented prose scores 0 against the same judgment — it
   * simply has nothing to catch while extraction stays clean. So the column
   * reads 100, 100, 100, and that is the corpus being right rather than the
   * check being broken. Never present it as "the worst work, first".
   *
   * `null` means NOT MEASURED, which is not the same as zero and must never
   * sort or filter as one. It is the state before the scoring command has run,
   * and the permanent state of a principle whose case has no judgment text —
   * those re-enter the pool on their own the day a report arrives.
   */
  verbatim_score: number | null;

  /**
   * The passage lifted from the judgment, raw. Not the principle's own words.
   *
   * Because it is cut from the report rather than written, it exists in the
   * rendered text by construction — which is why the highlighter searches THIS
   * and not `principle`, which is often a summary and legitimately absent.
   *
   * `null` while carrying a score is CORRECT and common: the passage is built
   * from the longest run of six or more words, and a principle shorter than
   * six words has none. Such a principle is matched whole, scores 100 or 0,
   * and has nothing to highlight. The payload has no "too short" flag, so a
   * badge waiting on one would never fire — read it from this field being null
   * while the score is not.
   */
  verbatim_quote: string | null;

  /**
   * The same passage under the shared normalisation, contract steps 1 to 7.
   *
   * It KEEPS PUNCTUATION on purpose, because it has to stay mapping-preserving
   * so a match can become a range on the page. Step 8, dropping punctuation,
   * is scoring-only and must never be applied here.
   *
   * A word-boundary test that demands a SPACE either side would reject every
   * passage wrapped in quotation marks or ending on a full stop — measured at
   * 20 of 149. `isWordAligned` in lib/utils/quote-locator.ts uses the correct
   * rule instead: a cut is inside a word only when both neighbouring
   * characters are word characters.
   */
  verbatim_quote_key: string | null;

  /** The surrounding sentence a free reader is shown, ~1,500 characters. */
  verbatim_window: string | null;
}

/** Editorial dashboard aggregate. */
export interface CasePrinciplesSummary {
  unreviewed: number;
  reviewed: number;
  cases_with_unreviewed: number;
  reviewed_today: number;
}

/** Query params for GET /api/admin/case-principles. Unreviewed by default. */
export interface CasePrinciplesParams {
  reviewed?: boolean;
  case_id?: number;
  judge_id?: number;
  type?: PrincipleType;
  court_id?: number;
  country_id?: number;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
  /** Sort key. `verbatim_score` puts UNMEASURED rows last, never first. */
  sort?: 'verbatim_score';
  direction?: 'asc' | 'desc';
  /**
   * Only principles scoring at or below this. An unmeasured principle is not
   * below any threshold, so `null` scores are excluded rather than treated as
   * zero — measured: `max_score=99` returns 0 rows on a wholly unscored queue.
   */
  max_score?: number;
}

/** PATCH body — all optional. `reviewed: true` fixes-and-approves in one call. */
export interface UpdatePrincipleData {
  principle?: string;
  type?: PrincipleType | null;
  tag?: string | null;
  law_type?: PrincipleLawType[];
  judge_id?: number | null;
  reviewed?: true;
}

/** Result of POST /bulk-approve. */
export interface BulkApproveResult {
  approved: number;
  cases_reindexed: number;
}

// Admin Case Principle review queue — type definitions
// Backend: docs/api/case-structures-and-enrichment.md §4 (role:researcher)

export type PrincipleType = 'ratio' | 'obiter';

export type PrincipleLawType = 'procedural' | 'substantive';

/** Case reference embedded on a queue item (court/country as display strings). */
export interface PrincipleCaseRef {
  id: number;
  title: string;
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

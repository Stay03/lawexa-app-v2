/**
 * Case type definitions for Phase 5 API
 */

// Court type embedded in Case
export interface Court {
  name: string;
  slug: string;
  abbreviation: string;
}

// Country type embedded in Case
export interface Country {
  id: number;
  name: string;
  slug: string;
  code: string;
  abbreviation: string;
}

// Judge type for case detail
export interface Judge {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

// Full report type (from include_full_report=true)
export interface FullReport {
  id: number;
  case_id: number;
  full_text: string;
  created_at: string;
  updated_at: string;
}

// Related case type (for similar_cases, and the base shape of cited_by)
export interface RelatedCase {
  id: number;
  title: string;
  display_title: string;
  slug: string;
  excerpt: string;
  citation: string | null;
  judgment_date: string | null;
  court: Court | null;
  country: Country | null;
}

// How a citing case treated the authority it cited.
// See docs/api/case-structures-and-enrichment.md (backend repo).
export type CaseTreatment =
  | 'followed'
  | 'applied'
  | 'approved'
  | 'considered'
  | 'referred_to'
  | 'distinguished'
  | 'doubted'
  | 'not_followed'
  | 'overruled';

// Disposition of a case. `null` = the document's disposition didn't map cleanly.
export type CaseOutcome =
  | 'appeal_allowed'
  | 'appeal_dismissed'
  | 'appeal_allowed_in_part'
  | 'retrial_ordered'
  | 'convicted'
  | 'acquitted'
  | 'judgment_for_plaintiff'
  | 'judgment_for_defendant'
  | 'dismissed'
  | 'struck_out'
  | 'application_granted'
  | 'application_refused';

// An outgoing citation edge (cited_cases). `id` is the EDGE id, NOT a case id.
// When `cited_case_id` is null the citation points at a case not in our DB —
// render `raw` as the name and do not link. Linked rows carry title/slug/citation.
export interface CitedCaseEdge {
  id: number;
  cited_case_id: number | null;
  raw: string | null;
  title: string | null;
  display_title: string | null;
  slug: string | null;
  citation: string | null;
  treatment: CaseTreatment | null;
}

// A reverse citation (cited_by): the old related-case shape plus a treatment label.
export interface CitedByCase extends RelatedCase {
  treatment: CaseTreatment | null;
}

// Meta information for SEO
export interface CaseMeta {
  title: string;
  description: string;
  canonical: string;
}

// Case list item (from GET /api/cases)
export interface Case {
  id: number;
  title: string;
  display_title: string;
  slug: string;
  excerpt: string;
  topic: string | null;
  tags: string[] | null;
  principles: string | null;
  level: string | null;
  course: string | null;
  court: Court | null;
  country: Country | null;
  judgment_date: string | null;
  citation: string | null;
  views_count: number;
  is_bookmarked: boolean;
  bookmarks_count: number;
  meta: CaseMeta;
}

// View limit error from 429 response
export interface CaseViewLimitError {
  limit_type: string;
  plan_limit: number;
  hard_limit: number;
  used: number;
  remaining: number;
  resets_at: string;
}

// Full case detail (from GET /api/cases/{slug})
export interface CaseDetail extends Case {
  body: string | null;
  judges: Judge[];
  has_full_report?: boolean;
  full_report?: FullReport | null;
  similar_cases?: RelatedCase[] | null;
  cited_cases?: CitedCaseEdge[] | null;
  cited_by?: CitedByCase[] | null;
  cited_by_count?: number;
  creator: {
    id: number;
    name: string;
    email: string;
    role: string;
    is_creator: boolean;
    is_verified: boolean;
    auth_provider: string;
    avatar_url: string | null;
    created_at: string;
  };
  created_at: string;
  updated_at: string;
  limit_exceeded?: boolean;
  limit_message?: string;
}

// Pagination metadata from API
export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number | null;
  to: number | null;
}

// Pagination links from API
export interface PaginationLinks {
  first: string;
  last: string;
  prev: string | null;
  next: string | null;
}

// Paginated case list response
export interface CaseListResponse {
  success: boolean;
  message: string;
  data: Case[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// Single case response
export interface CaseDetailResponse {
  success: boolean;
  message: string;
  data: CaseDetail | null;
}

// Query params for case list
export interface CaseListParams {
  page?: number;
  per_page?: number;
  search?: string;
  court_id?: number;
  country_id?: number;
  year?: number;
  tags?: string; // Filter by tags (comma-separated or single tag)
}

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

// Related case type (for similar_cases, cited_cases, cited_by)
export interface RelatedCase {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  citation: string | null;
  judgment_date: string | null;
  court: Court | null;
  country: Country | null;
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

// Full case detail (from GET /api/cases/{slug})
export interface CaseDetail extends Case {
  body: string;
  judges: Judge[];
  judicial_precedent: string | null;
  has_full_report?: boolean;
  full_report?: FullReport | null;
  similar_cases?: RelatedCase[] | null;
  cited_cases?: RelatedCase[] | null;
  cited_by?: RelatedCase[] | null;
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

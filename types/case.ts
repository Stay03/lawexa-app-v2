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

// The judge's role on a case's coram (pivot field, July 2026 contract).
// `null` = unknown / legacy row.
export type CoramRole = 'lead' | 'concurring' | 'dissenting';

// Judge type for case detail
export interface Judge {
  id: number;
  name: string;
  slug: string;
  // Coram role pivot — optional because pre-July payloads (and cached
  // responses) do not carry it.
  role?: CoramRole | null;
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

// A verbatim principle extracted from the judgment (report_principles[]).
// End users (below Researcher) receive ONLY `reviewed: true` rows — the server
// filters the rest — so `reviewed: false` is visible to Researcher+ accounts
// and should be badged as unreviewed, never hidden client-side.
export interface ReportPrinciple {
  id: number;
  principle: string;
  // Present only when the principle is attributed; `role` is the judge's coram
  // role on THIS case.
  judge?: { id: number; name: string; slug: string; role: CoramRole | null } | null;
  type: 'ratio' | 'obiter' | null;
  tag: string | null;
  law_type: string[] | null;
  reviewed: boolean;
  order: number;

  /**
   * The judgment's own words behind this principle — the passage the extractor
   * cut it from, with a little of the sentence around it.
   *
   * ── WHY A READER GETS THIS AND NOT THE JUDGMENT ───────────────────────────
   * A principle is OUR sentence about what the court held. This is the COURT'S
   * sentence. Showing it is the difference between being told what a case says
   * and reading it, and for a reader who is not paying it is the only judgment
   * text on the page.
   *
   * The server truncates it for readers without a subscription and caps how
   * many principles carry one, so the page can never add up to the judgment.
   * The owner agreed the number knowingly: about 3,000 characters per case,
   * roughly 500 words, near enough one percent of a typical judgment.
   *
   * `null` when this principle has no measured passage — most often because it
   * is shorter than the six-word run the matcher works in.
   */
  verbatim_window?: string | null;

  /**
   * The exact span the principle was matched against, raw from the judgment.
   *
   * Shorter than the window: this is the match itself, with nothing either
   * side. It is what a highlight paints.
   *
   * ── THE RULE THAT KEEPS IT SAFE, AND IT IS NOT OBVIOUS ────────────────────
   * Its words are by construction the longest run of THIS PRINCIPLE found in
   * the judgment, so every word in it is already in the principle above it.
   * That is the whole reason it can be shown to a reader who is not paying.
   * It follows that the quote MAY ONLY EVER BE RENDERED ALONGSIDE THE FULL
   * PRINCIPLE IT WAS CUT FOR. Show it on its own — in a teaser, a summary
   * list, or beside a truncated principle — and it stops being bounded by
   * anything and becomes raw judgment text.
   */
  verbatim_quote?: string | null;

  /**
   * The same span under the shared normalisation, for locating it in rendered
   * text without the browser re-deriving the string and drifting.
   *
   * It KEEPS punctuation on purpose. A word-boundary test that demands a space
   * on each side will reject every passage wrapped in quotation marks or ending
   * on a full stop — measured at 20 of 149 before it was fixed. Use
   * `isWordAligned` in lib/utils/quote-locator.ts, which asks the right
   * question: a cut is inside a word only when the characters on both sides of
   * it are word characters.
   */
  verbatim_quote_key?: string | null;
}

// One statute this judgment cited (statutes_cited[]). When `statute_id` is set
// a `statute` object is included — render as a link; when null, render `raw`
// as plain text (unresolved; a future healing job links these).
export interface StatuteCitedEdge {
  id: number;
  statute_id: number | null;
  raw: string | null;
  provision: string | null;
  statute?: { id: number; title: string; slug: string } | null;
}

// One step of the case's procedural chain (court_history[], ordered). When
// `related_case_id` is set, title/slug/court/decided_date/outcome describe the
// linked case; otherwise `label` is the whole entry.
export interface CourtHistoryStep {
  id: number;
  related_case_id: number | null;
  label: string | null;
  order: number;
  title: string | null;
  slug: string | null;
  court: string | null;
  decided_date: string | null;
  outcome: CaseOutcome | null;
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
//
// July 2026 contract notes (docs/api/case-structures-and-enrichment.md,
// backend repo): the show endpoint ALWAYS loads the structured relations
// (report_principles / statutes_cited / court_history) — only full_report and
// the citation sets stay behind include params. All structured fields are
// typed optional because the corpus is mixed (bot UAs get a lean payload, and
// cached pre-July responses lack them).
export interface CaseDetail extends Case {
  body: string | null;
  judges: Judge[];
  // Falls back to `title` server-side when unset.
  short_title?: string;
  suit_no?: string | null;
  outcome?: CaseOutcome | null;
  // Sub-national origin, e.g. "Kano", "Greater Accra".
  origin_state?: string | null;
  report_principles?: ReportPrinciple[];
  statutes_cited?: StatuteCitedEdge[];
  court_history?: CourtHistoryStep[];
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

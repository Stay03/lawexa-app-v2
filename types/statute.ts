/**
 * Statute type definitions for Phase 17 API
 */

import type { Country, PaginationMeta, PaginationLinks } from './case';

// Statute status values
export type StatuteStatus = 'active' | 'repealed' | 'amended';

// What repealed a repealed statute (verified live on list + show payloads,
// July 31, 2026 — present on repealed rows, null otherwise).
export interface StatuteRepealedBy {
  title: string;
  // ISO date of the repeal.
  date: string | null;
  // FRBR work URI of the repealing instrument, e.g. "/akn/gh/act/2020/1023".
  uri: string | null;
  // The repealing instrument when it is in the library (show payload; absent or
  // null when it is not, verified live Sep 27, 2026 on statutes 607 and 807).
  statute?: StatuteRepealedByStatute | null;
}

export interface StatuteRepealedByStatute {
  id: number;
  uuid: string;
  title: string;
  slug: string;
}

// Statute creator (embedded in responses)
export interface StatuteCreator {
  id: number;
  uuid: string;
  name: string;
  email: string;
  role: string;
  is_creator: boolean;
  is_verified: boolean;
  auth_provider: string;
  avatar_url: string | null;
  created_at: string;
}

// Statute list item (from GET /api/statutes)
export interface Statute {
  id: number;
  uuid: string;
  title: string;
  short_title: string | null;
  slug: string;
  preamble: string | null;
  description: string | null;
  country: Country | null;
  year: number;
  commencement_date: string | null;
  status: StatuteStatus;
  status_label: string;
  creator: StatuteCreator | null;
  is_bookmarked: boolean;
  bookmarks_count: number;
  created_at: string;
  updated_at: string;
  // ── Fields the API ships that predate this file (verified against prod,
  // July 31, 2026 — present on both the list and show payloads). Optional so
  // no existing consumer's expectations change.
  /** The enacting formula ("AN ACT to …"), usually mirrored by `preamble`. */
  long_title?: string | null;
  /** AKN document type, e.g. `"act"`. */
  document_type?: string | null;
  /** FRBR work URI, e.g. `"/akn/gh/act/1993/459"`. */
  frbr_uri?: string | null;
  /** Date of assent (ISO date). */
  assent_date?: string | null;
  /** Consolidation window ("as at" dates), when the text is a consolidation. */
  as_at_date?: string | null;
  as_at_date_end?: string | null;
  /** The repealing instrument, on repealed statutes. */
  repealed_by?: StatuteRepealedBy | null;
  /**
   * Real-reader view count (backend, Aug 2 2026: 30-minute per-user cooldown,
   * bots excluded; verified live on list and detail). Counting began mid-July
   * 2026, so numbers are younger than the statutes themselves. Not displayed
   * anywhere yet — that is an owner decision (the case pages deliberately
   * dropped their view displays).
   */
  views_count?: number;
}

// Full statute detail (from GET /api/statutes/{slug})
export interface StatuteDetail extends Statute {
  root_nodes_count: number;
  nodes_count: number;
  /** Amendment records (verified live: `[]` today; shape not yet published). */
  amendments?: unknown[];
  amendments_count?: number;
}

// Valid node types (AKN 3.0 standard)
export type StatuteNodeType =
  | 'act'
  | 'chapter'
  | 'part'
  | 'section'
  | 'subsection'
  | 'article'
  | 'rule'
  | 'schedule'
  | 'regulation'
  | 'clause'
  | 'paragraph'
  | 'item'
  | 'subpart'
  | 'crossheading'
  | 'hcontainer'
  | 'subparagraph'
  | 'subclause'
  | 'subrule'
  | 'division'
  | 'subdivision'
  | 'title'
  | 'book'
  | 'point'
  | 'proviso';

// Statute node (hierarchical structure element)
export interface StatuteNode {
  id: number;
  statute_id: number;
  parent_id: number | null;
  node_type: StatuteNodeType;
  node_type_label: string;
  number: string | null;
  title: string | null;
  content: string | null;
  intro: string | null;
  wrap_up: string | null;
  slug: string;
  slug_path: string;
  order: number;
  position: number;
  depth: number;
}

// Query params for statute list
export interface StatuteListParams {
  page?: number;
  per_page?: number;
  search?: string;
  country?: number;
  status?: StatuteStatus;
  year?: number;
  sort?: 'title' | 'year' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
}

// Paginated statute list response
export interface StatuteListResponse {
  success: boolean;
  message: string;
  data: Statute[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// A country that has at least one statute, with its statute count.
export interface StatuteCountryFacet {
  country: Country;
  statute_count: number;
}

// Aggregated country facets that drive the statute library country tabs.
export interface StatuteCountriesData {
  // Total statutes across all countries, including uncategorised
  // (country-less) statutes. Shown on the "All" tab.
  total: number;
  // Only countries that have at least one statute.
  countries: StatuteCountryFacet[];
}

// Response envelope for GET /api/statutes/countries
export interface StatuteFacetsResponse {
  success: boolean;
  message: string;
  data: StatuteCountriesData;
}

// Single statute response
export interface StatuteDetailResponse {
  success: boolean;
  message: string;
  data: StatuteDetail | null;
}

// Statute nodes response (range-based)
export interface StatuteNodesResponse {
  success: boolean;
  message: string;
  data: {
    nodes: StatuteNode[];
    total_count: number;
  };
}

// Navigate response (deep link resolution)
export interface StatuteNavigateResponse {
  success: boolean;
  message: string;
  data: {
    node: StatuteNode;
    total_count: number;
  };
}

/**
 * A researcher's note on a statute: a printing error, a typo, a doubt, or a
 * plain note (`GET /statutes/{slug}/annotations`, researcher and up; an
 * ordinary account gets 403).
 *
 * Where it sits: `node` is the part it belongs to, with the eId the AKN export
 * writes, so the reader places it with no second lookup. `null` with a null
 * `quote` is a note on the whole statute; `null` WITH a quote is `detached`
 * (the part was deleted and the note kept). `quote` is the words it marks;
 * `text_changed` says the server no longer finds them in the part's text.
 * `prefix`, `suffix` and the offsets are hints for telling one occurrence of
 * the quote from another, and are null on imported notes.
 */
export interface StatuteAnnotation {
  uuid: string;
  statute_id: number;
  node: {
    id: number;
    eid: string;
    node_type: string;
    number: string | null;
    position: number;
  } | null;
  quote: string | null;
  prefix: string | null;
  suffix: string | null;
  start_offset: number | null;
  end_offset: number | null;
  type: StatuteAnnotationType;
  type_label: string;
  status: 'open' | 'decided';
  status_label: string;
  body: string;
  decision: string | null;
  source: 'manual' | 'log_import' | 'typos_import';
  text_changed: boolean;
  detached: boolean;
  created_by?: { id: number; name: string } | null;
  decided_by?: { id: number; name: string } | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export type StatuteAnnotationType = 'print_error' | 'typo' | 'doubt' | 'note';

// Notes on one statute, in reading order (whole-statute notes first, then by
// the part's position, detached notes last).
export interface StatuteAnnotationsResponse {
  success: boolean;
  message: string;
  data: StatuteAnnotation[];
}

// One note, as every write (update, decide) answers it.
export interface StatuteAnnotationResponse {
  success: boolean;
  message: string;
  data: StatuteAnnotation;
}

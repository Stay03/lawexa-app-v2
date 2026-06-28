/**
 * Statute type definitions for Phase 17 API
 */

import type { Country, PaginationMeta, PaginationLinks } from './case';

// Statute status values
export type StatuteStatus = 'active' | 'repealed' | 'amended';

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
}

// Full statute detail (from GET /api/statutes/{slug})
export interface StatuteDetail extends Statute {
  root_nodes_count: number;
  nodes_count: number;
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

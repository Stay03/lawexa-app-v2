/**
 * Recently-viewed feed types (backend Ask A — GET /api/users/recently-viewed).
 *
 * ONE merged, interleaved list of the cases, notes, and statutes the caller has
 * opened — newest view first, each item once (stamped with its latest view
 * time). Every row is a discriminated union on `type`, and its `item` is the
 * EXACT summary payload the matching list page already consumes (the existing
 * `Case` / `Note` / `Statute` list types) — never a parallel shape — so the home
 * rows and the list pages can never drift on field names.
 *
 * Sparse pages are NORMAL: statute view history only accrues from the endpoint's
 * deploy day (cases/notes have history already), and deleted items are skipped —
 * so a page may legitimately hold fewer than `per_page` rows.
 */

import type { Case, PaginationLinks, PaginationMeta } from './case';
import type { Note } from './note';
import type { Statute } from './statute';

/** The three viewable content types the merged feed interleaves. */
export type RecentlyViewedType = 'case' | 'note' | 'statute';

/** A viewed case row — `item` is the `GET /api/cases` list payload verbatim. */
export interface RecentlyViewedCase {
  type: 'case';
  viewed_at: string;
  item: Case;
}

/** A viewed note row — `item` is the `GET /api/notes` list payload verbatim. */
export interface RecentlyViewedNote {
  type: 'note';
  viewed_at: string;
  item: Note;
}

/** A viewed statute row — `item` is the `GET /api/statutes` list payload verbatim. */
export interface RecentlyViewedStatute {
  type: 'statute';
  viewed_at: string;
  item: Statute;
}

/** One row of the merged feed, discriminated on `type`. */
export type RecentlyViewedItem =
  | RecentlyViewedCase
  | RecentlyViewedNote
  | RecentlyViewedStatute;

/** Query params for GET /api/users/recently-viewed. */
export interface RecentlyViewedParams {
  /** Restrict to a subset of types; omit / empty ⇒ all three. */
  types?: RecentlyViewedType[];
  /** Default 10, max 50 (server-clamped). */
  per_page?: number;
  page?: number;
}

/** Standard paginated envelope, reusing the shared pagination types. */
export interface RecentlyViewedListResponse {
  success: boolean;
  message: string;
  data: RecentlyViewedItem[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

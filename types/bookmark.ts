/**
 * Bookmark type definitions.
 *
 * ── THE CONTENT UNION IS DISCRIMINATED (August 3, 2026) ──────────────────────
 * `Bookmark` used to be one interface whose `content` was a bare union of the
 * four payload shapes, so every consumer had to CAST to read a field. v1's
 * bookmarks page did exactly that — and shipped a live defect the compiler
 * could never see: it has no `statute` branch, so a saved statute falls into
 * the folder branch and renders a folder icon linking to `/folders/undefined`.
 *
 * `Bookmark` is now a union DISCRIMINATED BY `type`, so `type === 'statute'`
 * narrows `content` to the statute payload and a missing branch is a type
 * error rather than a wrong page. Casts at the call site become unnecessary,
 * and the four shapes can carry their real, per-type fields.
 *
 * ── THE SHAPES ARE LIVE-VERIFIED ────────────────────────────────────────────
 * Probed against prod-api.lawexa.com on August 3, 2026 (case, note and statute
 * bookmarks created, listed and removed). Anything the live payload carried and
 * this file did not is marked "live". The FOLDER shape is the one that could
 * not be observed (the probing account owns no folders) and is therefore left
 * exactly as documented — consumers must treat it as unconfirmed.
 */

import type { PaginationMeta, PaginationLinks } from './case';
import type { StatuteStatus } from './statute';

// Bookmarkable content type. Live-verified: `type=file` answers 422
// "Invalid bookmark type." — these four are the whole set.
export type BookmarkType = 'case' | 'note' | 'folder' | 'statute';

// Case summary as returned inside a Bookmark object.
// NOTE the payload is a THIN summary: no court, country, holding or tags.
export interface BookmarkCaseContent {
  id: number;
  title: string;
  /** live — the short designation; absent on the un-enriched corpus. */
  short_title?: string | null;
  display_title: string;
  slug: string;
  judgment_date: string | null;
  citation: string | null;
  is_bookmarked: boolean;
  /**
   * UNRELIABLE HERE: observed as 0 immediately after a successful add that
   * returned `is_bookmarked: true`. Never render a count from this payload.
   */
  bookmarks_count: number;
  /** live — same caveat as `bookmarks_count`. */
  views_count?: number;
}

// Note summary as returned inside a Bookmark object
export interface BookmarkNoteContent {
  id: number;
  title: string;
  slug: string;
  /** Already PLAIN text, already truncated by the API. */
  content_preview: string;
  /** live — the same preview as markup. Never render it as HTML. */
  content_preview_html?: string;
  user: {
    id: number;
    name: string;
    /** live */
    avatar_url?: string | null;
  };
  tags: string[] | null;
  /** live: `null` on a free note, not the empty string. */
  price_ngn: string | null;
  price_usd: string | null;
  is_free: boolean;
  thumbnail_url: string | null;
  is_bookmarked: boolean;
  bookmarks_count: number;
  /** live */
  views_count?: number;
  created_at: string;
}

// Statute summary as returned inside a Bookmark object.
// NOTE the payload is a THIN summary: no country, status_label or description.
export interface BookmarkStatuteContent {
  id: number;
  title: string;
  short_title: string | null;
  slug: string;
  year: number;
  /**
   * The same enum the statute library reads (`types/statute.ts`), so a
   * bookmarked statute and a browsed one describe their status identically.
   * The bookmark payload carries no `status_label`, so the label is derived.
   */
  status: StatuteStatus;
  is_bookmarked: boolean;
  bookmarks_count: number;
}

/**
 * Folder summary as returned inside a Bookmark object.
 *
 * THE ONE SHAPE NEVER OBSERVED LIVE (August 3, 2026 probe: the account owns no
 * folders). Left exactly as documented rather than guessed at — but consumers
 * should treat `uuid` as something to VERIFY before building a route from it,
 * because `/folders/undefined` is precisely the defect v1 ships here.
 */
export interface BookmarkFolderContent {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  slug_path: string;
  icon: string | null;
  color: string | null;
  is_private: boolean;
  children_count: number;
  items_count: number;
  is_bookmarked: boolean;
  created_at: string;
}

/** What every bookmark carries regardless of what it points at. */
interface BookmarkBase {
  /** The BOOKMARK's own id — not the content's. */
  id: number;
  /** When the bookmark was created (the list's sort key, newest first). */
  created_at: string;
}

export interface CaseBookmark extends BookmarkBase {
  type: 'case';
  content: BookmarkCaseContent;
}

export interface NoteBookmark extends BookmarkBase {
  type: 'note';
  content: BookmarkNoteContent;
}

export interface FolderBookmark extends BookmarkBase {
  type: 'folder';
  content: BookmarkFolderContent;
}

export interface StatuteBookmark extends BookmarkBase {
  type: 'statute';
  content: BookmarkStatuteContent;
}

/** Single bookmark item from the list endpoint — discriminated by `type`. */
export type Bookmark =
  | CaseBookmark
  | NoteBookmark
  | FolderBookmark
  | StatuteBookmark;

// GET /api/bookmarks response
export interface BookmarkListResponse {
  success: boolean;
  message: string;
  data: Bookmark[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// POST /api/bookmarks request body
export interface ToggleBookmarkData {
  type: BookmarkType;
  id: number;
}

// POST /api/bookmarks response (added)
export interface BookmarkToggleAddedResponse {
  success: boolean;
  message: string;
  data: {
    bookmarked: true;
    bookmark: Bookmark;
  };
}

// POST /api/bookmarks response (removed)
export interface BookmarkToggleRemovedResponse {
  success: boolean;
  message: string;
  data: {
    bookmarked: false;
  };
}

// Union type for toggle response
export type BookmarkToggleResponse =
  | BookmarkToggleAddedResponse
  | BookmarkToggleRemovedResponse;

// GET /api/bookmarks/check response
export interface BookmarkCheckResponse {
  success: boolean;
  message: string;
  data: {
    bookmarked: boolean;
  };
}

// Query params for bookmark list. Live-verified: `per_page` is 1–100 and any
// `type` outside the four above answers 422.
export interface BookmarkListParams {
  type?: BookmarkType;
  per_page?: number;
  page?: number;
}

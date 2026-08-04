import type { PaginationLinks, PaginationMeta } from '@/types/case';
import type { StatuteStatus } from '@/types/statute';

/**
 * The v2 folders contract — typed against the LIVE API as probed on
 * August 4, 2026 (raw payloads in the wave-5 study), not against v1's
 * `types/folder.ts`.
 *
 * ── FOUR PAYLOADS, NOT ONE (the wave-4 lesson, restated) ────────────────────
 * The server returns four different folder shapes and they are NOT subsets of
 * one another in the way a single type would suggest:
 *
 *   public feed row   13 keys
 *   my-folders row    17 keys  (+ description, counts of views/bookmarks, updated_at)
 *   detail            19 keys  (+ `parent`, `children`)
 *   create/update/restore response
 *                     17 keys  (my-folders shape — NO `parent`, NO `children`)
 *
 * So `description`, `updated_at`, `parent` and `children` are ABSENT (not
 * null) from payloads that do not carry them. Every one of them is optional
 * here, and no consumer may read an absence as a value: gate on PROOF
 * (`=== true`, `!== undefined`), never on `undefined` falling through a
 * comparison. A mutation response can never refresh a DETAIL cache on its own
 * — it has no children — and the RESTORE response's counts are stale
 * (measured 0/0 against a real 3/1), so a restore must refetch.
 *
 * ── ADDRESSING ─────────────────────────────────────────────────────────────
 * `uuid` is the only honest address. The slug route 404s, numeric ids 404,
 * slugs are not unique between sibling folders, and a rename rewrites every
 * descendant's `slug_path`. `restore` is the one endpoint taking the numeric
 * `id`.
 */

/** The author block. The public feed sends three keys; owned rows send the lot. */
export interface FolderUser {
  id: number;
  name: string;
  avatar_url: string | null;
}

/**
 * A folder as it appears INSIDE another folder's payload — `parent` and every
 * entry of `children`. A FIFTH shape, and the study's four-payload count
 * missed it: twelve keys, with NO `user`, `description`, `updated_at`,
 * `bookmarks_count` or `views_count` (re-probed against files 20, 38 and 51).
 *
 * It is its own interface, not a partial of the full record, because typing a
 * subfolder as the full record makes `child.user.name` compile and throw —
 * the exact class of defect this wave shipped a guard for on `/bookmarks`.
 * Anything that renders both a top-level row and a subfolder row must accept
 * THIS type; a full record satisfies it, never the other way round.
 */
export interface FolderNode {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  /** Full ancestor path in SLUGS (no uuids) — display only, never an address. */
  slug_path: string;
  /** Free text, unvalidated by the server. v2 never mints new ones. */
  icon: string | null;
  /** Hex, server-validated. v2 renders legacy values and mints no new ones. */
  color: string | null;
  is_private: boolean;
  children_count: number;
  items_count: number;
  is_bookmarked: boolean;
  created_at: string;
}

export interface FolderRecord extends FolderNode {
  /** Present on owned rows and on the detail — never on a nested node. */
  user: FolderUser;
  description?: string | null;
  /** The list TRAIL reads this, falling back to `created_at` when absent. */
  updated_at?: string;
  bookmarks_count?: number;
  /** Never displayed (owner's standing call on view counts). */
  views_count?: number;
  /** DETAIL only, and one level deep — the whole ancestor chain is not served. */
  parent?: FolderNode | null;
  /** DETAIL only, UNPAGINATED — the server sends every child in one array. */
  children?: FolderNode[];
}

/**
 * What v2 sends to create or rename a folder. Deliberately four fields short
 * of v1's form: no `icon`, no `color` (decision 2 — monochrome), and
 * `is_private` is not a toggle the user sees (decision 3 — v2 creates every
 * folder private; the field is sent so the server is never left guessing).
 */
export interface FolderCreateInput {
  name: string;
  is_private: true;
  /** uuid of the parent, or omitted for a root folder. */
  parent_id?: string;
}

/** A rename. `parent_id: null` moves a folder back to the root. */
export interface FolderUpdateInput {
  name?: string;
  parent_id?: string | null;
}

/**
 * ── ITEM TYPES ─────────────────────────────────────────────────────────────
 * The server accepts SIX (`case`, `note`, `statute`, `file`, `conversation`,
 * `folder`). v2 offers FOUR (decision 4):
 *
 *  - `conversation` is dropped because the endpoint accepts any conversation
 *    by numeric id without an ownership check and then serves back its private
 *    title — an id-enumeration leak, filed as the urgent backend ask. v2 will
 *    not add one and will not render one.
 *  - `folder` as an ITEM is dropped because real nesting (`parent_id`) already
 *    exists; supporting both is what made v1 render the same subfolder twice.
 *
 * Both may still ARRIVE from folders filled by v1, so the wire union below
 * models all six and the row mapper drops the two v2 does not render — the
 * same "known type, not rendered" discipline as the bookmarks mapper.
 */
export type FolderItemType = 'case' | 'note' | 'statute' | 'file';

export interface FolderItemCaseContent {
  id: number;
  title: string;
  short_title: string | null;
  display_title: string | null;
  slug: string;
  judgment_date: string | null;
  citation: string | null;
  is_bookmarked: boolean;
  bookmarks_count: number;
}

/**
 * Note items carry `price_ngn`/`price_usd`/`is_free` on the wire. They are NOT
 * typed here: v2 does not sell notes, and a field that cannot be read cannot
 * be rendered by mistake.
 */
export interface FolderItemNoteContent {
  id: number;
  title: string | null;
  slug: string;
  content_preview: string;
  content_preview_html?: string;
  user: FolderUser;
  tags: string[] | null;
  thumbnail_url: string | null;
  is_bookmarked: boolean;
  bookmarks_count: number;
  created_at: string;
}

export interface FolderItemStatuteContent {
  id: number;
  title: string;
  short_title: string | null;
  slug: string;
  year: number | null;
  /** Raw status — the label map lives in the row model (the wire sends no label). */
  status: StatuteStatus;
  is_bookmarked: boolean;
  bookmarks_count: number;
}

/**
 * UNPROBED SHAPE. A guest owns no files, so the file item's `content` was
 * never observed. Every field is optional and the row model must render from
 * what is present — a file row may show its name and nothing else rather than
 * claim a size the payload did not carry.
 */
export interface FolderItemFileContent {
  id: number;
  name?: string;
  original_name?: string;
  url?: string;
  mime_type?: string;
  size?: number;
  created_at?: string;
}

/** The two v2 accepts on the wire but never renders (see the block above). */
export interface FolderItemOpaqueContent {
  id: number | string;
  title?: string;
  name?: string;
}

export type FolderItemRecord =
  | { id: number; type: 'case'; added_at: string; content: FolderItemCaseContent }
  | { id: number; type: 'note'; added_at: string; content: FolderItemNoteContent }
  | { id: number; type: 'statute'; added_at: string; content: FolderItemStatuteContent }
  | { id: number; type: 'file'; added_at: string; content: FolderItemFileContent }
  | {
      id: number;
      type: 'conversation' | 'folder';
      added_at: string;
      content: FolderItemOpaqueContent;
    };

/** Add / remove take the type and the CONTENT id (a slug is accepted for cases). */
export interface FolderItemInput {
  type: FolderItemType;
  id: number | string;
}

export interface FolderListEnvelope {
  success: boolean;
  message: string;
  data: FolderRecord[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

export interface FolderItemsEnvelope {
  success: boolean;
  message: string;
  data: FolderItemRecord[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

export interface FolderEnvelope {
  success: boolean;
  message: string;
  data: FolderRecord;
}

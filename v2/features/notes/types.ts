import type { NoteStatus, NoteUser } from '@/types/note';
import type { PaginationLinks, PaginationMeta } from '@/types/case';

/**
 * The v2 notes contract — typed against the backend as of the 2026-08-04 notes
 * rebuild reply (their commit `54d44e0`), NOT against v1's `types/note.ts`.
 * The differences are deliberate:
 *
 *  - `title` is honestly `string | null`. The backend now accepts untitled
 *    saves and normalizes `""` to `null`, so `null` is a value every consumer
 *    WILL see. Render it as "Untitled" at the display site, never store the
 *    fallback. v1's `Note` still claims `string`; that lie stays quarantined
 *    in v1.
 *  - The pricing fields (`price_ngn` / `price_usd`) are NOT typed. Note
 *    selling is out of scope for v2 ("no current demand") and no v2 surface
 *    may read a price. `is_free` / `is_paid` stay, because hiding paid notes
 *    requires knowing which ones those are.
 *
 * Wire facts v2 relies on (same reply):
 *  - The slug is set ONCE at creation and never changes unless a save
 *    explicitly sends a different `slug`. Auto-save must therefore never send
 *    `slug` — see `NoteUpdateInput`.
 *  - `GET /api/notes/by-id/{id}` exists and is the editor's canonical read.
 *  - Content caps at 5,242,880 characters (5MB). The old 65,535 figure is
 *    stale v1 trivia — do not resurrect it.
 *  - Saves (create + update combined) are limited to 60/min per user, a
 *    notes-only bucket; a 429 WITH `Retry-After` is the rate limit, a 429
 *    WITHOUT it (create only) is the plan's note-creation quota.
 *
 * ── LIST ROWS AND DETAILS ARE DIFFERENT PAYLOADS (probed on prod, Aug 4
 * 2026 — this type lying about it emptied the whole library once). A LIST row
 * carries ONLY: id, slug, title, content_preview(_html), is_free, price
 * fields (untyped here), tags, thumbnail_url, user, created_at,
 * is_bookmarked, bookmarks_count, views_count (untyped — never displayed,
 * owner's call). `status`, `is_paid`, `is_private`, `updated_at`, `content`
 * and `has_access` exist ONLY on detail payloads, so every one of them is
 * optional, and NO consumer may treat their absence as a value: a gate that
 * needs one must gate on PROOF (`=== true`, `!== undefined`), never on
 * `undefined` falling through a comparison.
 */
export interface NoteRecord {
  id: number;
  title: string | null;
  slug: string;
  /**
   * Full HTML body — DETAIL only. A readable note carries a string (possibly
   * empty). A locked paid note OMITS the key entirely (not `null` — probed).
   * List rows never carry it.
   */
  content?: string | null;
  content_preview: string;
  content_preview_html?: string;
  /** Detail only. */
  is_private?: boolean;
  tags: string[] | null;
  is_free: boolean;
  /** Detail only — list rows signal paid via `is_free: false`. */
  is_paid?: boolean;
  /** Detail only (and, per v1's mine screens, my-notes rows). */
  status?: NoteStatus;
  /** Detail only — the authoritative "may this viewer read the body" signal. */
  has_access?: boolean;
  thumbnail_url: string | null;
  user: NoteUser;
  created_at: string;
  /** Detail only — list rows carry only `created_at`. */
  updated_at?: string;
  is_bookmarked: boolean;
  bookmarks_count: number;
}

export interface NoteListEnvelope {
  success: boolean;
  message: string;
  data: NoteRecord[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

export interface NoteEnvelope {
  success: boolean;
  message: string;
  data: NoteRecord;
}

/**
 * What a v2 create sends. Nothing else: no pricing, no status, no thumbnail,
 * no tags — a v2 note is born a plain draft, and the marketplace fields stay
 * untouched until that product exists. `slug` is accepted by the API but v2
 * never sends one at create (the backend mints `untitled-x3f9`-style
 * addresses and they are stable).
 */
export interface NoteCreateInput {
  /** Omit or `null` for an untitled draft. Caps at 500 characters. */
  title?: string | null;
  content: string;
}

/**
 * What a v2 save sends. `slug` is deliberately NOT here: sending a changed
 * slug is the ONE thing that breaks a note's links (old address 404s
 * immediately), so the type makes it unsendable rather than trusting every
 * call site to remember.
 */
export interface NoteUpdateInput {
  /** `null` clears the title (allowed); omit to leave it alone. */
  title?: string | null;
  content?: string;
}

/** Response envelope for a content-image upload (`POST /api/files`). */
export interface NoteImageUpload {
  success: boolean;
  message: string;
  data: {
    /** Keep this alongside the embedded URL — it is what `DELETE /api/files/{id}` takes. */
    id: number;
    url: string;
    original_name: string;
    mime_type: string;
    size: number;
    created_at: string;
  };
}

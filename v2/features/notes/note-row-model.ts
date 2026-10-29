import type { NoteStatus } from '@/types/note';
import type { NoteRecord } from './types';
import { mayEditNote, noteSpace } from './note-copy';
import { noteDisplayTitle, noteHasTitle, notePreviewText } from './note-text';

/**
 * note-row-model — the notes list's edge normalisation, the move
 * `case-row-model.ts`, `statute-row-model.ts` and `bookmark-row-model.ts` each
 * make: ONE pure function turns a wire record into exactly the fields a row
 * renders, so the row component holds no derivation logic and the two tabs
 * cannot drift into two ideas of what a note row says.
 *
 * ── WHAT THIS MODEL SUPPLIES FOR THE META LINE ─────────────────────────────
 * The row's grey line (the owner's take A, 23 October 2026) is built from
 * {@link NoteRowModel.author}, {@link NoteRowModel.updatedAt} and
 * {@link NoteRowModel.tags}; which of them show, and in what order, depends on
 * the tab, so that rule lives in `library/note-row-meta.ts` and the list passes
 * the tab down.
 *
 * ── WHAT IS DELIBERATELY ABSENT ─────────────────────────────────────────────
 * PRICE. `NoteRecord` does not type `price_ngn` / `price_usd` at all (see
 * `types.ts`), so no row can accidentally reach one. Paid notes are hidden from
 * v2 entirely — {@link isLibraryListable} is the render-side half of that rule,
 * and the wire layer bakes `free: true` into the library request as the other.
 *
 * THUMBNAILS. Marketplace furniture from the v1 note cards; a v2 row is a name,
 * a summary and one meta line.
 */

/** What a notes-list row renders. Every field is display-ready. */
export interface NoteRowModel {
  /** The CONTENT id — what the bookmark toggle takes. */
  id: number;
  slug: string;
  /** The reader's address. */
  href: string;
  /** The on-screen name, with the "Untitled" display fallback applied. */
  title: string;
  /** `false` when the fallback is standing in — lets the row set it quieter. */
  hasTitle: boolean;
  /** First on the All notes meta line. `null` when the payload has no name. */
  author: string | null;
  /** PLAIN text only — nothing in this feature is handed to the browser as HTML. */
  preview: string | null;
  /** Present only when the payload carries it (detail and my-notes rows). */
  status: NoteStatus | undefined;
  /** An honest draft mark, on PROOF only (the folder picker reads it). */
  isDraft: boolean;
  /** The date on the meta line. */
  updatedAt: string;
  /** The note's tags, trimmed, empty ones dropped. */
  tags: readonly string[];
  isBookmarked: boolean;
  /** A Space's copy: the server files it only in its own Space's folders. */
  isSpaceCopy: boolean;
  /** Edit and Delete in the row's menu (`mayEditNote`). */
  canEdit: boolean;
  /** Made from a chat's draft (drafts saved as notes): "From a chat" on My notes. */
  fromChat: boolean;
}

/** `viewerId` decides {@link NoteRowModel.canEdit}; without one, no row is editable. */
export function noteRow(note: NoteRecord, viewerId: number | null = null): NoteRowModel {
  return {
    id: note.id,
    slug: note.slug,
    href: `/notes/${note.slug}`,
    title: noteDisplayTitle(note.title),
    hasTitle: noteHasTitle(note.title),
    author: note.user?.name?.trim() || null,
    preview: notePreviewText(note.content_preview, note.content_preview_html),
    status: note.status,
    // On PROOF only — `status` is absent from list payloads, and reading the
    // absence as "not published" would stamp a draft mark on every real row.
    isDraft: note.status === 'draft',
    // List rows carry only `created_at`; the date must never go blank.
    updatedAt: note.updated_at ?? note.created_at,
    tags: noteTags(note.tags),
    isBookmarked: note.is_bookmarked,
    isSpaceCopy: noteSpace(note) !== null,
    canEdit: mayEditNote(note, viewerId),
    fromChat: note.from_chat === true,
  };
}

/**
 * A note's tags as every surface shows them: trimmed, empty ones dropped, in
 * the writer's order. The list rows and the note's own page both read this,
 * so a tag cannot look one way in the list and another on the page.
 */
export function noteTags(tags: readonly string[] | null | undefined): string[] {
  return (tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0);
}

/**
 * Whether a record may appear in the PUBLIC library stream — the belt-and-
 * braces half of the paid/draft rule.
 *
 * The wire layer already sends `free: true` and the endpoint already returns
 * published notes only, so in normal operation this filter removes nothing.
 * It exists because the two rules it enforces are OWNER DECISIONS about what
 * v2 shows, not request parameters: "paid notes are hidden from v2 entirely"
 * and "the library never shows drafts". A parameter can be dropped by a
 * refactor, a query-string typo or a backend default change without anyone
 * noticing; a render-side gate cannot. It is checked on the ROW, so the worst
 * case is one row missing rather than a price appearing on a surface that has
 * no concept of one.
 *
 * NOT used on My notes: drafts are the whole point of that tab, and a note the
 * reader owns is theirs to read whatever its price field says.
 */
export function isLibraryListable(note: NoteRecord): boolean {
  // Drop only on PROOF. List rows carry neither `status` nor `is_paid`
  // (probed Aug 4 2026), and the original `status === 'published'` test read
  // that absence as "not published" — which filtered out every real row and
  // emptied the library the day it went live. The server already scopes the
  // library request to published free notes; this belt catches only a row
  // that AFFIRMS it does not belong.
  if (note.is_paid === true || note.is_free === false) return false;
  if (note.status !== undefined && note.status !== 'published') return false;
  return true;
}

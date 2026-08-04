import type { NoteStatus } from '@/types/note';
import type { NoteRecord } from './types';
import { noteDisplayTitle, noteHasTitle, notePreviewText } from './note-text';

/**
 * note-row-model — the notes list's edge normalisation, the move
 * `case-row-model.ts`, `statute-row-model.ts` and `bookmark-row-model.ts` each
 * make: ONE pure function turns a wire record into exactly the fields a row
 * renders, so the row component holds no derivation logic and the two tabs
 * cannot drift into two ideas of what a note row says.
 *
 * ── WHAT THIS MODEL SUPPLIES FOR THE TWO-ZONE META LINE ─────────────────────
 * A row's meta line has a LEAD (left, gives up its width first) and a TRAIL
 * (right-anchored, never wraps, never moves). This model supplies BOTH
 * candidates for the lead and the single trail value; the choice between the
 * two leads is the LIST's, because it depends on which tab is showing and a
 * row model does not know that (`NoteRow`'s `showStatus` prop, set by
 * `NotesBrowser`).
 *
 *   LEAD, on the public library   {@link NoteRowModel.author} — "who wrote
 *           this" is what distinguishes two notes on the same subject.
 *   LEAD, on My notes             {@link NoteRowModel.isDraft} — the author is
 *           always the reader there, so their name is noise and the honest
 *           draft/published mark takes the slot.
 *   TRAIL, on both                {@link NoteRowModel.updatedAt}, tabular, so
 *           the dates read straight down the column whatever fills the lead.
 *
 * ── WHAT IS DELIBERATELY ABSENT ─────────────────────────────────────────────
 * PRICE. `NoteRecord` does not type `price_ngn` / `price_usd` at all (see
 * `types.ts`), so no row can accidentally reach one. Paid notes are hidden from
 * v2 entirely — {@link isLibraryListable} is the render-side half of that rule,
 * and the wire layer bakes `free: true` into the library request as the other.
 *
 * TAGS and THUMBNAILS. Both are marketplace furniture from the v1 note cards;
 * neither survives into a v2 row, which is a name, one meta line and a preview.
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
  /** The lead candidate the public library uses. `null` when the payload has
   *  no name. */
  author: string | null;
  /** PLAIN text only — nothing in this feature is handed to the browser as HTML. */
  preview: string | null;
  status: NoteStatus;
  /** The lead candidate My notes uses: an honest draft/published mark. */
  isDraft: boolean;
  /** The meta TRAIL, on both tabs. */
  updatedAt: string;
  isBookmarked: boolean;
}

export function noteRow(note: NoteRecord): NoteRowModel {
  return {
    id: note.id,
    slug: note.slug,
    href: `/notes/${note.slug}`,
    title: noteDisplayTitle(note.title),
    hasTitle: noteHasTitle(note.title),
    author: note.user?.name?.trim() || null,
    preview: notePreviewText(note.content_preview, note.content_preview_html),
    status: note.status,
    isDraft: note.status !== 'published',
    updatedAt: note.updated_at,
    isBookmarked: note.is_bookmarked,
  };
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
  return note.status === 'published' && !note.is_paid;
}

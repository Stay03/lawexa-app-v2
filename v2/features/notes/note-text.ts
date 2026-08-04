/**
 * note-text — the notes feature's PURE text derivations. No React, no DOM, no
 * imports: the list, the reader and (later) the editor all read from here, so a
 * note's title and its preview can never say two different things on two
 * screens.
 *
 * WHY A MODULE OF ITS OWN. Two of the three helpers below encode a CONTRACT
 * decision rather than a formatting preference — the untitled fallback is a
 * display-site-only substitution the backend explicitly asked us to make, and
 * the markup-to-text reduction is the one-way degrade that keeps note markup
 * from ever reaching the browser as markup. Both are the kind of rule that
 * rots the moment it is re-typed at a second call site.
 */

/**
 * What an untitled note is CALLED on screen.
 *
 * `null` is a real, first-class value for `NoteRecord.title` (the backend
 * normalises `""` to `null` and mints `untitled-x3f9`-style slugs for it), and
 * the contract is explicit that the fallback is a DISPLAY substitution: it is
 * never stored, never sent back on a save, and never used as an identity. That
 * is why this is a render-time function and not a default applied in the wire
 * layer — a default there would silently re-title the note on its next save.
 */
export const UNTITLED_NOTE_TITLE = 'Untitled';

/** The note's on-screen name. `null` / blank → {@link UNTITLED_NOTE_TITLE}. */
export function noteDisplayTitle(title: string | null | undefined): string {
  const trimmed = title?.trim();
  return trimmed ? trimmed : UNTITLED_NOTE_TITLE;
}

/** Whether the note carries a real title — lets a display site set "Untitled"
 *  in a quieter voice without re-deriving the same test. */
export function noteHasTitle(title: string | null | undefined): boolean {
  return !!title?.trim();
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#039;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/**
 * Reduce markup to the text it wrapped — a ONE-WAY degrade.
 *
 * Tags become spaces (so `<p>a</p><p>b</p>` reads "a b", not "ab"), the handful
 * of entities that actually occur are decoded, and whitespace is collapsed. The
 * result is only ever rendered as a React text child, so nothing here can
 * re-promote content to markup; the ampersand is decoded LAST so a
 * doubly-encoded entity cannot be resurrected into a live one by an earlier
 * pass.
 *
 * Pure string work, no DOM — identical on the server and in the browser, which
 * is what lets the reader use it as its `DOMParser`-unavailable fallback.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A note's preview line, as PLAIN TEXT.
 *
 * The API sends the preview twice: `content_preview` (already plain, already
 * truncated) and `content_preview_html` (the same text as markup). The plain
 * field is preferred precisely because it needs no parsing; the HTML field is
 * only ever a fallback, and it is reduced to text — never rendered as markup.
 */
export function notePreviewText(
  plain: string | null | undefined,
  html: string | null | undefined,
): string | null {
  const direct = plain?.trim();
  if (direct) return direct;
  return htmlToPlainText(html) || null;
}

/**
 * A note timestamp as "12 Mar 2026". Parsed with the deterministic
 * `Date.parse` (no zero-argument `Date` anywhere, so nothing here can run in
 * render and trip the React Compiler lint), and `''` for anything missing or
 * unparseable so a caller never has to null-check before rendering.
 */
export function formatNoteDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return '';
  return new Date(timestamp).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

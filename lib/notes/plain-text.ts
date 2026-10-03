/**
 * plain-text — note markup reduced to the text it wrapped, shared by v1 and v2.
 *
 * Moved here from `v2/features/notes/note-text.ts` (3 October 2026) so the note
 * walker in `note-html.ts` can live in `lib/`, where v1's note page can use it
 * too: v1 code may not import from `v2/`. v2's `note-text` re-exports it.
 */

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

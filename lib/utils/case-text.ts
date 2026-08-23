/**
 * Turning a stored judgment into paragraphs of plain text.
 *
 * ── WHY THIS LIVES IN lib/utils AND NOT IN THE v2 RENDERER ────────────────
 * Two surfaces need it and they are on opposite sides of a lint boundary. The
 * public case reader is v2; the admin principle-review screen is v1, and
 * `eslint.config.mjs` forbids v1 from importing v2 outside a short allowlist.
 * `lib/` is the neutral ground both may reach, so the conversion lives here and
 * each surface renders it in its own idiom.
 *
 * ── AND THE COST OF NOT SHARING IT WAS MEASURED ───────────────────────────
 * The admin Judgment sheet printed the stored value straight into a paragraph.
 * That looked fine for as long as the sheet was accidentally fetching the case
 * SUMMARY, which is plain prose. The moment it began fetching the judgment —
 * which is stored as markup — the reviewer was shown 6,145 raw HTML tags and
 * 302 undecoded entities, beginning `<p style="line-height: 150%;">COKER,
 * J.S.C. ...`. Fixing the fetch exposed a rendering bug that had been hidden by
 * a data bug.
 */

/** Paragraph openers that mark a section of a judgment summary. */
export const CASE_HEADING =
  /^(Held|Facts|Issue|Issues|Decision|Ratio|Obiter|Judgment|Appeal|Background|Analysis|Conclusion|Dissent|Concurrence|Per\s+[\w'-]+(?:\s+[A-Z][\w.'-]*)*)\s*:\s*/;

/** Tags whose presence means the value is legacy markup rather than plain text. */
const LOOKS_LIKE_HTML =
  /<\/?(?:p|br|div|strong|em|b|i|ul|ol|li|h[1-6]|span)\b[^>]*>/i;

const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&nbsp;': ' ',
};

/**
 * Numeric character references, decimal and hexadecimal.
 *
 * ── A LOOKUP TABLE CANNOT COVER THESE, AND READERS SAW THE PROOF ──────────
 * The table carried `&#39;` and production emits the ZERO-PADDED `&#039;`. The
 * lookup missed, the entity survived, and the page printed `carrier&#039;s
 * agent` to the reader — 62 times in Savannah Bank v Pan Atlantic, 28 in
 * Nwachukwu v State.
 *
 * Adding `&#039;` to the table would have fixed those two reports and left
 * `&#0039;` and `&#x27;` waiting. A number is decoded as a number.
 *
 * Safe because this output is rendered as text by React, never as innerHTML,
 * so a decoded `<` is escaped rather than reopening markup.
 */
const NUMERIC_ENTITY = /&#(x)?([0-9a-f]+);/gi;

function decodeEntities(value: string): string {
  return value
    .replace(NUMERIC_ENTITY, (entity, hex: string | undefined, digits: string) => {
      const code = Number.parseInt(digits, hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : entity;
    })
    .replace(/&[a-z]+;/gi, (entity) => NAMED_ENTITIES[entity.toLowerCase()] ?? entity);
}

/**
 * Reduce legacy markup to the text it was wrapping. Block boundaries become
 * blank lines so the paragraph split below still finds the author's structure.
 */
function htmlToPlainText(value: string): string {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n\n')
      .replace(/<li\b[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ''),
  ).replace(/\n{3,}/g, '\n\n');
}

/**
 * Split into paragraphs on blank lines, dropping empties.
 *
 * Exported because the flat `principles` fallback needs the SAME split to
 * decide whether the field holds one passage or a paragraph-per-principle list
 * (measured on live data: Mustapha v Abubakar's flat field is five blank-line
 * paragraphs, one principle each). Legacy HTML degrades before splitting, the
 * same as when rendering.
 */
export function caseTextParagraphs(value: string): string[] {
  const source = LOOKS_LIKE_HTML.test(value) ? htmlToPlainText(value) : value;
  return source
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

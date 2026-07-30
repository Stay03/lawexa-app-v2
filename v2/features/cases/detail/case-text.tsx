import { Fragment } from 'react';

/**
 * CaseText — the case body and the full judgment, rendered as TEXT.
 *
 * ── WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────────
 * v1 rendered the same field three incompatible ways and one of them was a hole:
 *
 *   `CaseBodyCard`          `dangerouslySetInnerHTML={{ __html: body }}`
 *   `CaseDocumentView`      built an HTML STRING by interpolating the text into
 *                           `<p>${paragraph}</p>` and injected THAT
 *   `CasePrinciplesCard`    plain text with `whitespace-pre-wrap`
 *
 * The admin form writes `body` from a bare `<Textarea>` — it is plain text — so
 * the two HTML paths were both wrong about what they held, and the second one
 * concatenated unescaped content into markup. The blast radius is small (only
 * our own editors can author a case) but the shape is a stored-XSS pattern, and
 * v2 does not copy it forward: NOTHING here is ever handed to the browser as
 * HTML. Paragraphs are React elements, so escaping is structural rather than
 * remembered.
 *
 * ── LEGACY HTML IS DEGRADED, NOT TRUSTED ────────────────────────────────────
 * Some older rows may still hold markup from before the field settled. Printing
 * `<p>` literally to the reader would be its own defect, so text that clearly
 * contains block tags is CONVERTED DOWN to text: `<br>` and `</p>` become line
 * breaks, remaining tags are dropped, and the handful of entities that actually
 * appear are decoded. The result is still rendered as text. This is deliberately
 * one-way — we never re-promote anything to markup.
 *
 * ── HEADINGS ────────────────────────────────────────────────────────────────
 * Nigerian judgment summaries lead paragraphs with `Held:`, `Facts:`, `Issue:`,
 * `Per Oputa JSC:` and so on. Those read as structure, so they are set apart —
 * as a real `<strong>` element, not by pasting `<strong>` into a string.
 */

/** Paragraph openers that mark a section of a judgment summary. */
const HEADING = /^(Held|Facts|Issue|Issues|Decision|Ratio|Obiter|Judgment|Appeal|Background|Analysis|Conclusion|Dissent|Concurrence|Per\s+[\w'-]+(?:\s+[A-Z][\w.'-]*)*)\s*:\s*/;

/** Tags whose presence means the value is legacy markup rather than plain text. */
const LOOKS_LIKE_HTML = /<\/?(?:p|br|div|strong|em|b|i|ul|ol|li|h[1-6]|span)\b[^>]*>/i;

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/**
 * Reduce legacy markup to the text it was wrapping. Block boundaries become
 * blank lines so the paragraph split below still finds the author's structure.
 */
function htmlToPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Split into paragraphs on blank lines, dropping empties — exported because
 * the flat `principles` fallback needs the SAME split to decide whether the
 * field holds one passage or a paragraph-per-principle list (measured on live
 * data: Mustapha v Abubakar's flat field is five blank-line paragraphs, one
 * principle each). Legacy HTML degrades before splitting, same as rendering.
 */
export function caseTextParagraphs(value: string): string[] {
  const source = LOOKS_LIKE_HTML.test(value) ? htmlToPlainText(value) : value;
  return source
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/**
 * Render a plain-text legal passage.
 *
 * `whitespace-pre-line` preserves the author's SINGLE line breaks (numbered
 * points, quoted passages) while still letting the browser wrap normally — which
 * is what `pre-wrap` would not do, since that also preserves the incidental
 * indentation that survives a copy-paste out of a PDF.
 */
export function CaseText({ value }: { value: string }) {
  const paragraphs = caseTextParagraphs(value);
  if (paragraphs.length === 0) return null;

  return (
    <>
      {paragraphs.map((paragraph, index) => {
        const match = HEADING.exec(paragraph);
        if (!match) {
          return (
            <p key={index} className="whitespace-pre-line">
              {paragraph}
            </p>
          );
        }
        const rest = paragraph.slice(match[0].length);
        // A STANDALONE heading — the July body format puts `Held:` alone on
        // its own line between the facts and the judgment — is promoted to a
        // real part heading (`doc-part-heading`, styled in case-document.css)
        // so the summary visibly breaks into its halves. A heading with prose
        // on the same line stays an inline lead-in.
        if (!rest) {
          return (
            <p key={index} className="doc-part-heading">
              {match[1]}
            </p>
          );
        }
        return (
          <p key={index} className="whitespace-pre-line">
            <strong>{match[1]}:</strong>
            <Fragment> {rest}</Fragment>
          </p>
        );
      })}
    </>
  );
}

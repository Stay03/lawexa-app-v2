import { Fragment } from 'react';
import Link from 'next/link';

import { extractAuthorityRefs } from './authorities';

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
 *
 * ── INLINE AUTHORITIES (July 30) ────────────────────────────────────────────
 * The prose cites cases and statutes in every other line, and on the old page
 * that was dead ink. `extractAuthorityRefs` (authorities.ts — precision over
 * recall, see its docblock) finds them, and they render as quiet dotted-gold
 * links that open the library with the authority pre-filled as the search —
 * the same click-runs-a-search semantics as an unlinked authority row.
 */

/* The conversion from stored markup to paragraphs of plain text now lives in
   `@/lib/utils/case-text`, because the admin principle-review screen needs the
   same function and the lint boundary forbids v1 importing v2. Re-exported here
   so this module stays the one place v2 asks for case text. */
export { caseTextParagraphs } from '@/lib/utils/case-text';
import { CASE_HEADING as HEADING, caseTextParagraphs } from '@/lib/utils/case-text';

/**
 * A passage with its inline authorities linked. The link keeps the serif's
 * ink and marks itself with a dotted gold underline only — a reference mark,
 * not a button — and the title says what a click does.
 */
function AuthorityLinkedText({ text }: { text: string }) {
  const refs = extractAuthorityRefs(text);
  if (refs.length === 0) return text;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const ref of refs) {
    if (ref.start > cursor) nodes.push(text.slice(cursor, ref.start));
    nodes.push(
      <Link
        key={`${ref.kind}-${ref.start}`}
        href={ref.href}
        prefetch={false}
        title={
          ref.kind === 'case'
            ? 'Find this case in the library'
            : 'Find this statute in the library'
        }
        className="rounded-sm underline decoration-primary/45 decoration-dotted underline-offset-4 transition-colors hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {text.slice(ref.start, ref.end)}
      </Link>,
    );
    cursor = ref.end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
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
              <AuthorityLinkedText text={paragraph} />
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
            <Fragment> </Fragment>
            <AuthorityLinkedText text={rest} />
          </p>
        );
      })}
    </>
  );
}

/**
 * draft-blocks — the drafts Lawexa writes into an answer, read out of its
 * text (Stay, 23 October 2026: "Can we use tags … Yes build and push").
 *
 * THE TAG (agreed with backend's prompt piece, 23 October 2026):
 *
 *   <draft title="Tenancy Agreement for 12 Allen Avenue">
 *   # Tenancy Agreement
 *   …Markdown…
 *   </draft>
 *
 * One opening line with a double-quoted `title` (`&quot;` and `&amp;` are the
 * only entities in it), a Markdown body, and a closing tag. Text before and
 * after stays an ordinary reply, and one answer may hold several drafts.
 *
 * FONTS (Stay, 24 October 2026; backend's prompt piece 398beb4a). The opening
 * tag may carry the whole draft's font and size, `font="Georgia" size="12"`,
 * either one optional, in any order after `title`. Only the note fonts and
 * sizes are kept (lib/notes/note-fonts.ts); any other value is dropped and the
 * draft reads in the house font. A part of the text carries its own as an
 * inline `<span data-font data-size>`, which markdown-to-doc.ts reads.
 *
 * WHILE IT STREAMS the closing tag has not arrived, so an open draft runs to
 * the end of the text and says it is not complete: the panel shows the body
 * growing. A tag cut off mid-name at the very end (`<dra`, `<draft title="Ten`)
 * is held back, never shown as text, so no half tag flashes in the reply.
 *
 * Pure, so the rules are tested here and the card and the panel only draw them.
 */

import { noteFont, noteSize, type NoteFont, type NoteSize } from '@/lib/notes/note-fonts';

export interface DraftBlock {
  title: string;
  /** The Markdown between the tags, without the newline after the opening line. */
  body: string;
  /** The closing tag has arrived. */
  complete: boolean;
  /** The whole draft's font and size from the opening tag; `null` for the house ones. */
  font: NoteFont | null;
  size: NoteSize | null;
}

export type DraftPart = { kind: 'text'; text: string } | { kind: 'draft'; draft: DraftBlock };

/** `<draft title="…">`, with any other double-quoted attributes after the title. */
const OPEN = /<draft\s+title="([^"]*)"((?:\s+[a-z-]+="[^"]*")*)\s*>/gi;
const CLOSE = '</draft>';

/** The two entities a title may carry. */
function decodeTitle(raw: string): string {
  return raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
}

/** One double-quoted attribute out of the tag's rest, or `null`. */
function attribute(rest: string, name: string): string | null {
  const match = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(rest);
  return match ? match[1].trim() : null;
}

/** How much of `text`'s end could still grow into `<draft title="…">`. */
function heldTail(text: string): number {
  const lt = text.lastIndexOf('<');
  if (lt < 0) return 0;
  const tail = text.slice(lt);
  if (tail.includes('>')) return 0;
  const lower = tail.toLowerCase();
  // `<`, `<d` … `<draft` and anything after it up to the closing `>`.
  return '<draft'.startsWith(lower) || lower.startsWith('<draft') ? tail.length : 0;
}

/** Whether the text holds a draft or the start of one; the cheap check callers run first. */
export function mayHoldDraft(content: string): boolean {
  return /<d/i.test(content);
}

/**
 * The answer, split into its reply text and its drafts, in order. `streaming`
 * holds back a tag still being written at the very end.
 */
export function splitDrafts(content: string, streaming = false): DraftPart[] {
  const parts: DraftPart[] = [];
  let cursor = 0;
  OPEN.lastIndex = 0;
  let open: RegExpExecArray | null;
  while ((open = OPEN.exec(content)) !== null) {
    const before = content.slice(cursor, open.index);
    if (before.trim()) parts.push({ kind: 'text', text: before });
    const bodyStart = open.index + open[0].length;
    const closeAt = content.indexOf(CLOSE, bodyStart);
    const rawBody = content.slice(bodyStart, closeAt < 0 ? content.length : closeAt);
    let body = rawBody.replace(/^\r?\n/, '');
    if (closeAt < 0 && streaming) {
      // The closing tag may be arriving: never show its first letters as text.
      const partialClose = body.lastIndexOf('<');
      if (partialClose >= 0 && CLOSE.startsWith(body.slice(partialClose).toLowerCase())) {
        body = body.slice(0, partialClose);
      }
    }
    const rest = open[2] ?? '';
    parts.push({
      kind: 'draft',
      draft: {
        title: decodeTitle(open[1]) || 'Draft',
        body: body.replace(/\s+$/, ''),
        complete: closeAt >= 0,
        font: noteFont(attribute(rest, 'font')),
        size: noteSize(attribute(rest, 'size')),
      },
    });
    if (closeAt < 0) return parts;
    cursor = closeAt + CLOSE.length;
    OPEN.lastIndex = cursor;
  }
  let rest = content.slice(cursor);
  if (streaming) rest = rest.slice(0, rest.length - heldTail(rest));
  if (rest.trim() || parts.length === 0) parts.push({ kind: 'text', text: rest });
  return parts;
}

/** The drafts alone, in order. */
export function draftsIn(content: string, streaming = false): DraftBlock[] {
  if (!mayHoldDraft(content)) return [];
  return splitDrafts(content, streaming).flatMap((part) => (part.kind === 'draft' ? [part.draft] : []));
}

/** How many drafts the text holds, counting one still being written. */
export function countDrafts(content: string): number {
  return draftsIn(content).length;
}

/**
 * The card's and the panel's status line: "Draft · 1,240 words" once it is
 * finished, "Writing · 420 words" while it streams, and "Unfinished" for a
 * saved answer that stopped inside its draft.
 */
export function draftStatus(draft: DraftBlock, live: boolean): string {
  if (draft.complete) return `Draft · ${draftWordsLabel(draft.body)}`;
  return live ? `Writing · ${draftWordsLabel(draft.body)}` : `Unfinished · ${draftWordsLabel(draft.body)}`;
}

/** "about 420 words": the body's length, for the card while it is written. */
export function draftWordsLabel(body: string): string {
  const words = body.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  if (words === 0) return 'Starting';
  return `${words.toLocaleString('en-US')} ${words === 1 ? 'word' : 'words'}`;
}

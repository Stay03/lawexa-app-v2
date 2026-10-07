import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Code, Nodes } from 'mdast';

/** What the export route needs to find one fenced block of a saved answer. */
export interface DocumentExportTarget {
  conversationId: string;
  messageId: number;
  block: number;
}

/** `msg_123` (a row built from the server's history) → 123; a row drawn locally → null. */
export function savedMessageId(rowId: string): number | null {
  const match = /^msg_(\d+)$/.exec(rowId);
  return match ? Number(match[1]) : null;
}

/**
 * The text of every fenced block (three backticks or tildes) in a message, in
 * order, whatever its tag: code fences count too. This is the list the export
 * route numbers from 0 (`POST .../messages/{id}/export-docx` with `{ block }`,
 * backend contract of 7 October 2026), and the route counts the CommonMark
 * way, so this parses with a CommonMark parser instead of matching lines.
 * Indented code (four spaces, no fence) is not a fenced block and is skipped.
 */
export function fencedBlockTexts(markdown: string): string[] {
  const texts: string[] = [];
  const visit = (node: Nodes) => {
    if (node.type === 'code') {
      if (isFenced(node, markdown)) texts.push(node.value);
      return;
    }
    if ('children' in node) node.children.forEach(visit);
  };
  visit(fromMarkdown(markdown));
  return texts;
}

function isFenced(node: Code, markdown: string): boolean {
  const start = node.position?.start.offset;
  if (start === undefined) return false;
  const opener = markdown.slice(start, start + 3);
  return opener === '```' || opener === '~~~';
}

/**
 * The route's `block` for a fenced block shown on screen: the first block in
 * the message with the same text. Two blocks with the same text give the same
 * Word file, so the first is as good as either. `null` when the text is not a
 * block of this message (the screen shows text the saved message does not
 * hold), and then the block offers no Download.
 */
export function blockIndexOf(blocks: readonly string[], text: string): number | null {
  const index = blocks.indexOf(text);
  return index === -1 ? null : index;
}

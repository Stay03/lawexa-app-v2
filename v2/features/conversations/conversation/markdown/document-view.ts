/**
 * The document block's view rules (owner, 7 October 2026: "nicer and cleaner,
 * maximize, fold"). Pure, so tests can pin them.
 */

/** A document longer than this many lines, or characters, opens folded. */
export const FOLD_AFTER_LINES = 16;
export const FOLD_AFTER_CHARS = 1400;

/**
 * The header's title: the document's first non-empty line, collapsed spaces,
 * without the markdown marks that line may carry (a heading's `#`, `**bold**`,
 * `*italic*`, backticks). Underscores stay: a form uses them as blanks.
 * '' when there is none.
 */
export function documentTitle(text: string): string {
  const first = text.split('\n').find((line) => line.trim() !== '') ?? '';
  return first
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/(\*\*|\*)(\S(?:.*?\S)?)\1/g, '$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether the document is long enough to open folded. A short one shows in full, with no fold control. */
export function isLongDocument(text: string): boolean {
  return text.split('\n').length > FOLD_AFTER_LINES || text.length > FOLD_AFTER_CHARS;
}

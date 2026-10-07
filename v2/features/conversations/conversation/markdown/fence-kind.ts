/**
 * Which fenced block (three backticks) in an AI answer is a DOCUMENT and which
 * is CODE (owner, 7 October 2026: a court template the AI fenced rendered as
 * a grey typewriter box that scrolled sideways on a phone).
 *
 * THE RULE
 * - A fence tagged with a programming language (`js`, `php`, `json`, …) is
 *   code, always.
 * - A fence with no tag, or tagged `text` / `plaintext` / `txt` / `md` /
 *   `markdown`, is a document UNLESS its content is shaped like code
 *   ({@link looksLikeCode}).
 *
 * THE PROSE-VS-CODE TEST, stated plainly. Content is code-shaped when at least
 * a quarter of its non-empty lines look like code, or when fewer than half of
 * its visible characters are letters. A line looks like code when it ends in
 * `;`, `{` or `}`, starts with a common keyword (`import`, `const`, `def`,
 * `function`, `return`, `SELECT`, …) or a shell prompt (`$ `), or holds `=>`,
 * `#include` or an HTML/XML tag. Court forms (capitals, "SUIT NO: ____",
 * dotted signature lines) pass as prose: their lines match none of those, and
 * letters dominate even with blank lines to fill in.
 */

export type FenceKind = 'document' | 'code';

/** Fence tags that mean "not a programming language". The empty tag is no tag. */
export const DOCUMENT_FENCE_TAGS: ReadonlySet<string> = new Set(['', 'text', 'plaintext', 'txt', 'md', 'markdown']);

/** The tag of a fenced block from its `<code>` class (`language-xyz`), lowercased; '' when untagged. */
export function fenceLanguage(className: unknown): string {
  const names = Array.isArray(className) ? className : typeof className === 'string' ? className.split(/\s+/) : [];
  for (const name of names) {
    if (typeof name === 'string' && name.startsWith('language-')) return name.slice('language-'.length).toLowerCase();
  }
  return '';
}

const CODE_LINE =
  /[;{}]\s*$|^\s*(import|export|const|let|var|function|def|class|return|public|private|SELECT|INSERT|UPDATE|DELETE|CREATE)\b|^\s*\$\s|=>|#include|<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/;

/** Whether fenced content is shaped like code (see the module note for the test). */
export function looksLikeCode(text: string): boolean {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) return false;
  const codeLines = lines.filter((line) => CODE_LINE.test(line)).length;
  if (codeLines / lines.length >= 0.25) return true;
  const visible = text.replace(/\s/g, '');
  const letters = (visible.match(/\p{L}/gu) ?? []).length;
  return visible.length > 0 && letters / visible.length < 0.5;
}

/** Document or code, for a fenced block with this tag and content. */
export function fenceKind(language: string, text: string): FenceKind {
  if (!DOCUMENT_FENCE_TAGS.has(language)) return 'code';
  return looksLikeCode(text) ? 'code' : 'document';
}

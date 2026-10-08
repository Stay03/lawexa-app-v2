import { createElement, type ComponentProps } from 'react';
import type { Components, Options } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

/**
 * How a document block reads its markdown (Stay, 8 October 2026: "look like
 * notes"). The Word export applies the same rules on the server, so what the
 * screen shows is what the file holds; the shared sample blocks are in
 * `document-markdown.test.ts` and in the API's tests.
 *
 * A court form with no markdown must look exactly as it did when the block
 * showed plain text, so four things markdown would change are kept as typed:
 *
 * 1. A single line break is a line break (remark-breaks).
 * 2. Leading spaces stay. Each one becomes a no-break space, except on a list
 *    item, a quote or a heading, whose indent markdown needs. This also means
 *    an indented line never turns into a code block.
 * 3. A line of only `-`, `_`, `*` or `=` (a signature line, a rule under a
 *    title) stays text: markdown would read it as a divider or as a heading
 *    underline.
 * 4. Raw HTML prints as typed (react-markdown never renders it), and an image
 *    shows its alt text, so a block never loads anything from elsewhere.
 */
export function documentMarkdown(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (SEPARATOR_LINE.test(line)) return line.replace(/[-_*=]/, (mark) => `\\${mark}`);
      const indent = /^[ \t]+/.exec(line)?.[0];
      if (!indent || STRUCTURAL_LINE.test(line.slice(indent.length))) return line;
      return NBSP.repeat(indent.replace(/\t/g, '    ').length) + line.slice(indent.length);
    })
    .join('\n');
}

const NBSP = ' ';
/** Three or more of one of - _ * =, spaces allowed between, nothing else. */
const SEPARATOR_LINE = /^[ \t]*([-_*=])[ \t]*(?:\1[ \t]*){2,}$/;
/** A list item, a quote or a heading: markdown reads its indent. */
const STRUCTURAL_LINE = /^(?:[-*+][ \t]|\d{1,9}[.)][ \t]|>|#{1,6}[ \t])/;

export const DOCUMENT_REMARK_PLUGINS: Options['remarkPlugins'] = [remarkBreaks, remarkGfm];

/**
 * The notes' type styles cover h2 to h6 (a note's title is its h1), so a
 * document's `#` heading renders as the top heading inside the body. An image
 * renders as its alt text.
 */
export const DOCUMENT_COMPONENTS: Components = {
  h1: 'h2',
  img: ({ alt }: ComponentProps<'img'>) => (alt ? createElement('span', null, alt) : null),
};

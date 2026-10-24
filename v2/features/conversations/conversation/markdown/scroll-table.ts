import { createElement, type ComponentProps } from 'react';
import type { ExtraProps } from 'react-markdown';

import { cn } from '@/lib/utils';

/**
 * ScrollTable — a markdown table in a chat answer, in its own sideways
 * scroller (Tester, 24 October 2026: on a phone the reply's table was cut at
 * the right edge, and its last column could not be reached).
 *
 * The answer's prose is `overflow-x-hidden` (`MarkdownText`), so a table wider
 * than the column was clipped. Code blocks already scroll on their own
 * (`[&_pre]:overflow-x-auto`); a table now does the same, inside a wrapper that
 * takes the column's width, so only the table moves and the page never scrolls
 * sideways. `overscroll-x-contain` keeps a swipe at the table's end from going
 * back a page. Plain `createElement`, as `document-markdown.ts`, so the node
 * test runner can render it.
 */
export function ScrollTable({ node, className, ...rest }: ComponentProps<'table'> & ExtraProps) {
  void node;
  return createElement(
    'div',
    { className: 'v2-chat-table my-4 max-w-full overflow-x-auto overscroll-x-contain' },
    createElement('table', { ...rest, className: cn('my-0', className) }),
  );
}

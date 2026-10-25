'use client';

import { createElement, useEffect, useState, type ComponentProps, type MouseEvent } from 'react';
import type { ExtraProps } from 'react-markdown';
import { Check, Copy } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * ScrollTable — a markdown table in a chat answer (chat-table.css).
 *
 * Tester, 24 October 2026: on a phone the reply's table was cut at the right
 * edge. The answer's prose is `overflow-x-hidden` (`MarkdownText`), so a table
 * wider than the column was clipped. The table now sits in its own sideways
 * scroller, inside a frame that takes the column's width, so only the table
 * moves and the page never scrolls sideways. `overscroll-x-contain` keeps a
 * swipe at the table's end from going back a page.
 *
 * Stay, 25 October 2026 ("a more cleaner, professional ui/ux table"):
 *  - the edge that has more columns fades (`data-more-start`, `data-more-end`
 *    on the scroller), so the reader knows the table goes on;
 *  - "Copy table" under it copies the table as tab-separated text, which
 *    pastes into a sheet as rows and columns.
 * Number and long-text columns are marked before render (rehype-table-columns).
 * Plain `createElement`, as `document-markdown.ts`, so the node test runner can
 * render it.
 */

/** The table as tab-separated rows: what a sheet reads as cells on paste. */
export function tableText(table: HTMLTableElement): string {
  return Array.from(table.rows)
    .map((row) =>
      Array.from(row.cells)
        .map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim())
        .join('\t'),
    )
    .join('\n');
}

const COPIED_MS = 1600;

export function ScrollTable({ node, className, ...rest }: ComponentProps<'table'> & ExtraProps) {
  void node;
  // The scroller as state (a callback ref), so the effect below runs once it exists.
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [more, setMore] = useState({ start: false, end: false });
  const [copied, setCopied] = useState(false);

  // Which edges hide columns: measured on scroll and whenever the scroller or
  // the table changes size (a streaming table grows; a phone turns).
  useEffect(() => {
    if (!scroller) return;
    const measure = () => {
      const hidden = scroller.scrollWidth - scroller.clientWidth;
      const start = scroller.scrollLeft > 1;
      const end = hidden - scroller.scrollLeft > 1;
      setMore((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    const table = scroller.querySelector('table');
    if (table) observer.observe(table);
    scroller.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener('scroll', measure);
    };
  }, [scroller]);

  // "Copied" reads for a moment, then the button says "Copy table" again.
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = (event: MouseEvent<HTMLButtonElement>) => {
    const table = event.currentTarget.closest('.v2-chat-table')?.querySelector('table');
    if (!table) return;
    void navigator.clipboard
      .writeText(tableText(table))
      .then(() => setCopied(true))
      .catch(() => undefined);
  };

  return createElement(
    'div',
    { className: 'v2-chat-table' },
    createElement(
      'div',
      { className: 'v2-chat-table-frame' },
      createElement(
        'div',
        {
          ref: setScroller,
          className: 'v2-chat-table-scroll',
          'data-more-start': more.start ? '' : undefined,
          'data-more-end': more.end ? '' : undefined,
        },
        createElement('table', { ...rest, className: cn('my-0', className) }),
      ),
    ),
    createElement(
      'div',
      { className: 'v2-chat-table-actions' },
      createElement(
        'button',
        { type: 'button', className: 'v2-chat-table-copy', onClick: copy, 'aria-live': 'polite' },
        createElement(copied ? Check : Copy, { 'aria-hidden': true, className: 'size-3.5' }),
        copied ? 'Copied' : 'Copy table',
      ),
    ),
  );
}

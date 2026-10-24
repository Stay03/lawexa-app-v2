import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScrollTable } from './scroll-table';

/* Tester, 24 October 2026: on a phone a reply's table was cut at the right
 * edge, and its last column ("Uploaded (UTC)") could not be reached. A chat
 * answer's table now sits in its own sideways scroller. */

const here = dirname(fileURLToPath(import.meta.url));

const WIDE = [
  '| Id | Name | Type | Size | Pages | Uploaded (UTC) |',
  '| --- | --- | --- | --- | --- | --- |',
  '| 5215 | TEST DATA tenancy-test.pdf | PDF | 18 KB | 1 | 2026-10-24 23:48 |',
].join('\n');

const render = (text: string) =>
  renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], components: { table: ScrollTable } }, text));

test('a chat table is drawn inside its own sideways scroller, whole', () => {
  const html = render(WIDE);
  assert.match(html, /^<div class="v2-chat-table my-4 max-w-full overflow-x-auto overscroll-x-contain"><table class="my-0">/);
  // Every column is drawn; the scroller, not the prose, decides what shows.
  assert.match(html, /<th>Uploaded \(UTC\)<\/th>/);
  assert.match(html, /<td>2026-10-24 23:48<\/td>/);
  // The markdown tree never reaches the page as an attribute.
  assert.doesNotMatch(html, /node=/);
});

test('every chat answer uses it: the answer’s components route tables through ScrollTable', () => {
  const source = readFileSync(join(here, 'MarkdownText.tsx'), 'utf8');
  assert.match(source, /const MARKDOWN_COMPONENTS: Components = \{ a: CaseMentionLink, pre: FencedBlock, table: ScrollTable \};/);
  // The prose itself still never scrolls sideways; only the table does.
  assert.match(source, /'prose prose-sm dark:prose-invert max-w-none overflow-x-hidden break-words '/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScrollTable, tableText } from './scroll-table';

/* Tester, 24 October 2026: on a phone a reply's table was cut at the right
 * edge, and its last column ("Uploaded (UTC)") could not be reached. A chat
 * answer's table now sits in its own sideways scroller, inside the card Stay
 * picked (look B, 26 October 2026), with Copy table under it. */

const here = dirname(fileURLToPath(import.meta.url));

const WIDE = [
  '| Id | Name | Type | Size | Pages | Uploaded (UTC) |',
  '| --- | --- | --- | --- | --- | --- |',
  '| 5215 | TEST DATA tenancy-test.pdf | PDF | 18 KB | 1 | 2026-10-24 23:48 |',
].join('\n');

const render = (text: string) =>
  renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], components: { table: ScrollTable } }, text));

test('a chat table is drawn whole, in a card, inside its own sideways scroller', () => {
  const html = render(WIDE);
  assert.match(
    html,
    /^<div class="v2-chat-table"><div class="v2-chat-table-frame"><div class="v2-chat-table-scroll"><table class="my-0">/,
  );
  // Every column is drawn; the scroller, not the prose, decides what shows.
  assert.match(html, /<th>Uploaded \(UTC\)<\/th>/);
  assert.match(html, /<td>2026-10-24 23:48<\/td>/);
  // The markdown tree never reaches the page as an attribute.
  assert.doesNotMatch(html, /node=/);
});

test('Copy table sits under the table, a plain button', () => {
  const html = render(WIDE);
  assert.match(
    html,
    /<\/table><\/div><\/div><div class="v2-chat-table-actions"><button type="button" class="v2-chat-table-copy" aria-live="polite">.*Copy table<\/button><\/div><\/div>$/,
  );
});

test('Copy table copies tab-separated rows, which a sheet pastes as cells', () => {
  const cell = (text: string) => ({ textContent: text });
  const table = {
    rows: [
      { cells: [cell('File name'), cell('Pages')] },
      { cells: [cell('  TEST_DATA_notice.pdf '), cell('3')] },
      { cells: [cell('A two\n line   name'), cell('12')] },
    ],
  } as unknown as HTMLTableElement;
  assert.equal(tableText(table), 'File name\tPages\nTEST_DATA_notice.pdf\t3\nA two line name\t12');
});

test('every chat answer uses it: the answer’s components route tables through ScrollTable', () => {
  const source = readFileSync(join(here, 'MarkdownText.tsx'), 'utf8');
  assert.match(source, /const MARKDOWN_COMPONENTS: Components = \{ a: CaseMentionLink, pre: FencedBlock, table: ScrollTable \};/);
  // Both pipelines mark the columns, the streaming one before its word spans.
  assert.match(source, /const REHYPE_ANIMATED: Options\['rehypePlugins'\] = \[rehypeTableColumns, rehypeStreamWords\];/);
  assert.match(source, /const REHYPE_PLAIN: Options\['rehypePlugins'\] = \[rehypeTableColumns\];/);
  assert.match(source, /import '\.\/chat-table\.css';/);
  // The prose itself still never scrolls sideways; only the table does.
  assert.match(source, /'prose prose-sm dark:prose-invert max-w-none overflow-x-hidden break-words '/);
});

test('the table scrolls inside its card, and a narrow wide table keeps its first column in place', () => {
  const css = readFileSync(join(here, 'chat-table.css'), 'utf8');
  assert.match(css, /\.v2-chat-table-scroll \{\s*max-width: 100%;\s*overflow-x: auto;\s*overscroll-behavior-x: contain;/);
  assert.match(css, /container: v2-chat-table \/ inline-size;/);
  assert.match(
    css,
    /@container v2-chat-table \(max-width: 30rem\) \{\s*\.v2-chat-table \.v2-table-wide :is\(th, td\):first-child:not\(\.v2-cell-num\) \{\s*position: sticky;\s*left: 0;/,
  );
  // A long name breaks only in that kept column: everywhere else the break points are hidden, since Chromium
  // breaks at a <wbr> even inside nowrap.
  assert.match(css, /\.v2-chat-table wbr \{\s*display: none;\s*\}/);
  assert.match(css, /\.v2-chat-table \.v2-table-wide :is\(th, td\):first-child:not\(\.v2-cell-num\) wbr \{\s*display: inline;\s*\}/);
});

test('a long column keeps its 30rem floor only in a wide table in a narrow frame, so a table that can fit does fit', () => {
  const css = readFileSync(join(here, 'chat-table.css'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(css, /@container v2-chat-table \(max-width: 30rem\) \{\s*\.v2-chat-table \.v2-table-wide \.v2-cell-long \{\s*min-width: 30rem;\s*\}\s*\}/);
  // Outside the narrow-frame queries, nothing gives a long column a width of its own.
  const outside = css.replace(/@container v2-chat-table \(max-width: 30rem\) \{[\s\S]*?\n\}\n/g, '');
  assert.doesNotMatch(outside, /\.v2-cell-long \{[^}]*min-width/);
  // The table fills the card and lays its columns out by content: they share the width and wrap.
  assert.match(css, /\.v2-chat-table table \{\s*width: 100%;\s*margin: 0;\s*border-collapse: collapse;\s*table-layout: auto;/);
});

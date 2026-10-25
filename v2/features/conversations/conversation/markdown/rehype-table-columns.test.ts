import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { rehypeTableColumns } from './rehype-table-columns';

/* Stay, 25 October 2026: "a more cleaner, professional ui/ux table". Numbers
 * and dates line up on the right; long text wraps at a readable width. */

const render = (text: string) =>
  renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeTableColumns] }, text));

const FILES = [
  '| File name | Type | Pages | Size | Uploaded (UTC) | Summary |',
  '| --- | --- | --- | --- | --- | --- |',
  '| TEST_DATA_notice.pdf | PDF | 3 | 182 KB | 2026-10-24 23:19 | A landlord’s notice to quit the flat at 12 Allen Avenue, served six months before the anniversary. |',
  '| TEST_DATA_receipt.pdf | PDF | 1 | 1,229 KB | 2026-10-20 09:02 | ₦2,400,000.00 paid. |',
].join('\n');

test('number, size and date columns are marked as numbers, head and body alike', () => {
  const html = render(FILES);
  assert.match(html, /<th class="v2-cell-num">Pages<\/th>/);
  assert.match(html, /<th class="v2-cell-num">Size<\/th>/);
  assert.match(html, /<th class="v2-cell-num">Uploaded \(UTC\)<\/th>/);
  assert.match(html, /<td class="v2-cell-num">1,229 KB<\/td>/);
  assert.match(html, /<td class="v2-cell-num">2026-10-24 23:19<\/td>/);
});

test('a column with a long cell wraps at a readable width; short text stays plain', () => {
  const html = render(FILES);
  assert.match(html, /<th class="v2-cell-long">Summary<\/th>/);
  assert.match(html, /<th>File name<\/th>/);
  assert.match(html, /<th>Type<\/th>/);
});

test('a long file name has no words to wrap at: marked as one, with break points after its separators', () => {
  const html = render(['| File | Note |', '| --- | --- |', '| TEST_DATA_notice_to_quit_signed_final_version_two.pdf | Signed. |'].join('\n'));
  assert.doesNotMatch(html, /v2-cell-long/);
  assert.match(html, /<th class="v2-cell-token">File<\/th>/);
  // <wbr> adds no text: what is read and copied is the name, unchanged.
  assert.match(html, /<td class="v2-cell-token">TEST_<wbr\/>DATA_<wbr\/>notice_<wbr\/>to_<wbr\/>quit_<wbr\/>signed_<wbr\/>final_<wbr\/>version_<wbr\/>two\.<wbr\/>pdf<\/td>/);
  assert.match(html, /<td>Signed\.<\/td>/);
});

test('a table of four columns or more is marked wide; three columns are not', () => {
  assert.match(render(FILES), /^<table class="v2-table-wide">/);
  assert.match(render(['| Step | Deadline | Days left |', '| --- | --- | --- |', '| Reply | 2026-11-07 | 13 |'].join('\n')), /^<table>/);
});

test('a column the answer aligned itself keeps its alignment and gets no number mark', () => {
  const html = render(['| Step | Days |', '| --- | ---: |', '| Reply | 13 |'].join('\n'));
  assert.match(html, /<th style="text-align:right">Days<\/th>/);
  assert.doesNotMatch(html, /v2-cell-num/);
});

test('a column with text among its numbers stays text', () => {
  const html = render(['| Item | Amount |', '| --- | --- |', '| Rent | 2,400,000 |', '| Fee | waived |'].join('\n'));
  assert.doesNotMatch(html, /v2-cell-num/);
});

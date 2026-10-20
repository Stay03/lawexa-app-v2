import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderNoteNodes } from '@/lib/notes/note-elements';
import type { NoteNode } from '@/lib/notes/note-html';

/* The renderer v1's note reader uses for the walker's tree (security fix,
 * 3 October 2026). The walker itself needs a browser DOM; these pin what the
 * renderer can emit for each node kind. */
const markup = (nodes: NoteNode[]) =>
  renderToStaticMarkup(createElement('div', null, ...renderNoteNodes(nodes)));

test('a case mention keeps the anchor v1 tooltips find, with a rebuilt href', () => {
  const html = markup([{ kind: 'case', key: 'c', slug: 'okafor-v-nweke', children: [{ kind: 'text', key: 't', text: '@Okafor' }] }]);
  assert.equal(
    html,
    '<div><a href="/cases/okafor-v-nweke" class="case-mention" data-type="case-mention" data-case-slug="okafor-v-nweke">@Okafor</a></div>',
  );
});

test('an external link opens in a new tab with a hardened rel; an internal one does not', () => {
  const html = markup([
    { kind: 'link', key: 'e', href: 'https://example.org/x', mode: 'external', children: [{ kind: 'text', key: 't1', text: 'out' }] },
    { kind: 'link', key: 'i', href: '/statutes/x', mode: 'internal', children: [{ kind: 'text', key: 't2', text: 'in' }] },
  ]);
  assert.match(html, /<a href="https:\/\/example.org\/x" target="_blank" rel="noreferrer noopener nofollow">out<\/a>/);
  assert.match(html, /<a href="\/statutes\/x">in<\/a>/);
});

test('text that looks like a tag stays text', () => {
  const html = markup([{ kind: 'element', key: 'p', tag: 'p', children: [{ kind: 'text', key: 't', text: '<script>alert(1)</script>' }] }]);
  assert.equal(html, '<div><p>&lt;script&gt;alert(1)&lt;/script&gt;</p></div>');
});

test('void tags and images carry nothing but what the walker checked', () => {
  const html = markup([
    { kind: 'element', key: 'b', tag: 'br', children: [] },
    { kind: 'image', key: 'i', src: 'https://cdn.example.org/a.png', alt: 'Court' },
  ]);
  assert.equal(html, '<div><br/><img src="https://cdn.example.org/a.png" alt="Court" loading="lazy"/></div>');
});

/* Arthur's editor step 2 (20 October 2026): tables, one highlight and
 * alignment are read as well as written. */
const text = (key: string, value: string): NoteNode => ({ kind: 'text', key, text: value });

test('a table keeps its rows and cells, and a cell carries only a span over one', () => {
  const html = markup([
    {
      kind: 'element',
      key: 't',
      tag: 'table',
      children: [
        {
          kind: 'element',
          key: 'b',
          tag: 'tbody',
          children: [
            {
              kind: 'element',
              key: 'r1',
              tag: 'tr',
              children: [
                { kind: 'cell', key: 'h', tag: 'th', colSpan: 2, children: [text('x', 'Case')] },
              ],
            },
            {
              kind: 'element',
              key: 'r2',
              tag: 'tr',
              children: [
                { kind: 'cell', key: 'a', tag: 'td', children: [text('y', 'Donoghue')] },
                { kind: 'cell', key: 'c', tag: 'td', children: [text('z', '1932')] },
              ],
            },
          ],
        },
      ],
    },
  ]);
  assert.equal(
    html,
    '<div><table><tbody><tr><th colSpan="2">Case</th></tr><tr><td>Donoghue</td><td>1932</td></tr></tbody></table></div>',
  );
});

test('an aligned block gets a class from the closed table, never a style; a highlight is a bare mark', () => {
  const html = markup([
    { kind: 'element', key: 'p', tag: 'p', align: 'center', children: [text('t', 'Held')] },
    { kind: 'element', key: 'h', tag: 'h2', align: 'justify', children: [text('u', 'Facts')] },
    {
      kind: 'element',
      key: 'q',
      tag: 'p',
      children: [{ kind: 'element', key: 'm', tag: 'mark', children: [text('v', 'ratio')] }],
    },
  ]);
  assert.equal(
    html,
    '<div><p class="text-center">Held</p><h2 class="text-justify">Facts</h2><p><mark>ratio</mark></p></div>',
  );
  assert.doesNotMatch(html, /style=/);
});

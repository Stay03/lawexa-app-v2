import { test } from 'node:test';
import assert from 'node:assert/strict';

import { markdownToDoc } from './markdown-to-doc';

/* The draft editor (Stay, 23 October 2026): the draft Lawexa wrote opens in the
 * note editor with its structure. TEST DATA throughout. */

test('headings, paragraphs and inline marks become the editor schema', () => {
  const doc = markdownToDoc('# TEST DATA Agreement\n\nMade **between** *the parties*, ~~not~~ `here`, see [the Act](https://example.com).\n\n#### Deep');
  assert.deepEqual(doc.content?.[0], { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'TEST DATA Agreement' }] });
  assert.deepEqual(doc.content?.[1].content, [
    { type: 'text', text: 'Made ' },
    { type: 'text', text: 'between', marks: [{ type: 'bold' }] },
    { type: 'text', text: ' ' },
    { type: 'text', text: 'the parties', marks: [{ type: 'italic' }] },
    { type: 'text', text: ', ' },
    { type: 'text', text: 'not', marks: [{ type: 'strike' }] },
    { type: 'text', text: ' ' },
    { type: 'text', text: 'here', marks: [{ type: 'code' }] },
    { type: 'text', text: ', see ' },
    { type: 'text', text: 'the Act', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
    { type: 'text', text: '.' },
  ]);
  // The editor has three heading levels: a deeper one becomes a 3.
  assert.deepEqual(doc.content?.[2].attrs, { level: 3 });
});

test('lists keep their numbering start, and a table keeps its header row', () => {
  const doc = markdownToDoc('3. Third\n4. Fourth\n\n- One\n- Two\n\n| Item | Detail |\n| --- | --- |\n| Rent | ₦2,400,000 |');
  const [ordered, bullet, table] = doc.content ?? [];
  assert.equal(ordered.type, 'orderedList');
  assert.deepEqual(ordered.attrs, { start: 3 });
  assert.equal(ordered.content?.length, 2);
  assert.deepEqual(ordered.content?.[0], { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Third' }] }] });
  assert.equal(bullet.type, 'bulletList');
  assert.equal(bullet.attrs, undefined);
  assert.equal(table.type, 'table');
  assert.equal(table.content?.[0].content?.[0].type, 'tableHeader');
  assert.equal(table.content?.[1].content?.[1].type, 'tableCell');
  assert.deepEqual(table.content?.[1].content?.[1].content, [{ type: 'paragraph', content: [{ type: 'text', text: '₦2,400,000' }] }]);
});

test('markup in a draft stays text, and an empty draft is one empty paragraph', () => {
  const doc = markdownToDoc('<span style="color:red">TEST DATA</span>\n\nText <b>bold?</b>');
  // No HTML is parsed: the raw markup is text the reader can see and delete.
  assert.equal(doc.content?.[0].content?.map((node) => node.text).join(''), '<span style="color:red">TEST DATA</span>');
  assert.ok(doc.content?.[0].content?.every((node) => node.type === 'text' && !node.marks));
  assert.ok(doc.content?.[1].content?.every((node) => !node.marks));
  assert.deepEqual(markdownToDoc(''), { type: 'doc', content: [{ type: 'paragraph' }] });
  assert.deepEqual(markdownToDoc('---').content, [{ type: 'horizontalRule' }]);
});

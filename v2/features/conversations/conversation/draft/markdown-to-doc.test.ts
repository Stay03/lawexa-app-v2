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
  // A span with no allowed font is dropped and its words kept, with no style and no mark.
  assert.equal(doc.content?.[0].content?.map((node) => node.text).join(''), 'TEST DATA');
  assert.ok(doc.content?.[0].content?.every((node) => node.type === 'text' && !node.marks));
  // Any other tag is text the reader can see and delete.
  assert.equal(doc.content?.[1].content?.map((node) => node.text).join(''), 'Text <b>bold?</b>');
  assert.ok(doc.content?.[1].content?.every((node) => !node.marks));
  assert.deepEqual(markdownToDoc(''), { type: 'doc', content: [{ type: 'paragraph' }] });
  assert.deepEqual(markdownToDoc('---').content, [{ type: 'horizontalRule' }]);
});

const fontOf = (node: { marks?: { type: string; attrs?: Record<string, unknown> }[] } | undefined) =>
  node?.marks?.find((mark) => mark.type === 'fontStyle')?.attrs ?? null;

test('the draft\'s own font goes on every run of text, and a span wins for its words', () => {
  const doc = markdownToDoc(
    '# TEST DATA Agreement\n\nMade <span data-font="Times New Roman" data-size="14">between **the parties**</span> today.\n\n- One\n\n`code`',
    { font: 'Georgia', size: 12 },
  );
  // The heading and the list carry the draft's font.
  assert.deepEqual(fontOf(doc.content?.[0].content?.[0]), { font: 'Georgia', size: 12 });
  const runs = doc.content?.[1].content ?? [];
  assert.deepEqual(runs.map((node) => node.text), ['Made ', 'between ', 'the parties', ' today.']);
  assert.deepEqual(fontOf(runs[0]), { font: 'Georgia', size: 12 });
  // Inside the span, bold included.
  assert.deepEqual(fontOf(runs[1]), { font: 'Times New Roman', size: 14 });
  assert.deepEqual(fontOf(runs[2]), { font: 'Times New Roman', size: 14 });
  assert.ok(runs[2].marks?.some((mark) => mark.type === 'bold'));
  // After the close, the draft's font again.
  assert.deepEqual(fontOf(runs[3]), { font: 'Georgia', size: 12 });
  assert.deepEqual(fontOf(doc.content?.[2].content?.[0].content?.[0].content?.[0]), { font: 'Georgia', size: 12 });
  // Code takes no font.
  assert.equal(fontOf(doc.content?.[3].content?.[0]), null);
});

test('only allowed fonts and sizes are kept; a span may set one and keep the other', () => {
  const doc = markdownToDoc('<span data-font="Comic Sans MS" data-size="13">kept words</span> and <span data-size="18">bigger</span>.');
  const runs = doc.content?.[0].content ?? [];
  assert.deepEqual(runs.map((node) => node.text), ['kept words', ' and ', 'bigger', '.']);
  assert.equal(fontOf(runs[0]), null);
  assert.deepEqual(fontOf(runs[2]), { font: null, size: 18 });
  // A stray close tag is dropped; no font means no mark.
  assert.deepEqual(markdownToDoc('Plain </span> text').content?.[0].content?.map((node) => node.text), ['Plain ', ' text']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Fragment, Schema, Slice } from '@tiptap/pm/model';

import { keepFirstPastedAlignment } from './paste-alignment';

/* Tester's live check, 4c515c9b: the first pasted line took the alignment of
 * the empty line at the caret instead of its own. */

const textAlign = { default: null };
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*', attrs: { textAlign } },
    heading: { group: 'block', content: 'text*', attrs: { level: { default: 1 }, textAlign } },
    bullet_list: { group: 'block', content: 'list_item+' },
    list_item: { content: 'paragraph+' },
    text: {},
  },
});
const p = (text: string, align: string | null = null) => schema.nodes.paragraph.create({ textAlign: align }, text ? schema.text(text) : null);
const h = (text: string, align: string | null = null) => schema.nodes.heading.create({ level: 2, textAlign: align }, schema.text(text));
const pasted = (...nodes: ReturnType<typeof p>[]) => new Slice(Fragment.from(nodes), 1, 1);

test('on an empty line, a first pasted block with its own alignment replaces the line whole', () => {
  const slice = pasted(h('TEST DATA TITLE', 'center'), p('Body'));
  assert.equal(keepFirstPastedAlignment(slice, p('')).openStart, 0);
  assert.equal(keepFirstPastedAlignment(slice, p('')).openEnd, 1);
  // Tester's proof: a right-aligned first line pasted on an empty centred line.
  assert.equal(keepFirstPastedAlignment(pasted(p('TEST', 'right')), p('', 'center')).openStart, 0);
});

test('otherwise the first block joins the line, as before', () => {
  const slice = pasted(p('TEST', 'center'), p('DATA'));
  // The caret line has words: a paste mid-line never splits it.
  assert.equal(keepFirstPastedAlignment(slice, p('Some words')), slice);
  // The same alignment as the line, or no alignment of its own (plain text).
  assert.equal(keepFirstPastedAlignment(slice, p('', 'center')), slice);
  const plain = pasted(p('TEST'), p('DATA', 'center'));
  assert.equal(keepFirstPastedAlignment(plain, p('', 'center')), plain);
  // A slice already closed at its start.
  const closed = new Slice(Fragment.from(p('TEST', 'right')), 0, 0);
  assert.equal(keepFirstPastedAlignment(closed, p('')), closed);
});

test('the first block is found at the slice’s open depth', () => {
  const item = schema.nodes.list_item.create(null, p('TEST', 'center'));
  const list = schema.nodes.bullet_list.create(null, item);
  assert.equal(keepFirstPastedAlignment(new Slice(Fragment.from(list), 3, 3), p('')).openStart, 0);
  // Open only to the item: its first block is not a line of words, so nothing changes.
  const toItem = new Slice(Fragment.from(list), 2, 2);
  assert.equal(keepFirstPastedAlignment(toItem, p('')), toItem);
});

test('Techlead’s three cases (8eeb046c)', () => {
  // A centred first block lands centred on an empty left line.
  assert.equal(keepFirstPastedAlignment(pasted(p('TEST', 'center')), p('')).openStart, 0);
  // A right first block after a centred line (Enter keeps the centring) lands right.
  assert.equal(keepFirstPastedAlignment(pasted(p('TEST', 'right')), p('', 'center')).openStart, 0);
  // Plain text pasted inside a centred line joins it and stays centred.
  const words = pasted(p('TEST DATA'));
  assert.equal(keepFirstPastedAlignment(words, p('Signed:', 'center')), words);
});

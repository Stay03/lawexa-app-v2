import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { JSONContent } from '@tiptap/core';
import { getSchema } from '@tiptap/core';
import { DOMSerializer } from '@tiptap/pm/model';

import { isSignatureTable } from '@/lib/notes/note-html';
import { createNoteExtensions } from '@/v2/features/notes/editor/extensions';
import type { CaseMentionSnapshot, CaseMentionStore } from '@/v2/features/notes/editor/mention-store';
import { markdownToDoc, signatureRows } from './markdown-to-doc';

/* A template's signing table (template layout, thread 2b658111): a ```signature
 * fence in a draft is a borderless table marked `signature`, split by the
 * server's rule (Backend df7ae449, DraftHtml::setSignaturesApart), kept by the
 * editor on save as `<table data-type="signature">`, and drawn without borders
 * by the reader, Show changes and the chat's card. TEST DATA only. */

const here = join(process.cwd(), 'v2', 'features');
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8');

const SNAPSHOT: CaseMentionSnapshot = { open: false, query: '', loading: false, failed: false, items: [], activeIndex: 0, anchor: null };
const stubStore: CaseMentionStore = {
  subscribe: () => () => undefined,
  getSnapshot: () => SNAPSHOT,
  getServerSnapshot: () => SNAPSHOT,
  start: () => undefined,
  update: () => undefined,
  exit: () => undefined,
  moveActive: () => undefined,
  setActive: () => undefined,
  choose: () => undefined,
  handleKeyDown: () => false,
  destroy: () => undefined,
};
const schema = getSchema(createNoteExtensions({ placeholder: '', mentionStore: stubStore }));

const FENCE = [
  'Signed as a deed.',
  '',
  '```signature',
  'SIGNED by the Landlord | SIGNED by the Tenant',
  '**TEST DATA Ada Obi** | TEST DATA Bayo \\| Co',
  '______________________',
  '```',
].join('\n');

function tableOf(doc: JSONContent): JSONContent {
  const table = doc.content?.find((node) => node.type === 'table');
  assert.ok(table, 'a table');
  return table;
}

const cellText = (cell: JSONContent | undefined) => (cell?.content?.[0]?.content ?? []).map((node) => node.text ?? '').join('');

test('a signature line splits on every bar without a backslash before it, each cell trimmed, as the server splits it', () => {
  assert.deepEqual(signatureRows('SIGNED by the Landlord | SIGNED by the Tenant'), [['SIGNED by the Landlord', 'SIGNED by the Tenant']]);
  assert.deepEqual(signatureRows('A \\| B | C'), [['A \\| B', 'C']]);
  assert.deepEqual(signatureRows('one line, no bar'), [['one line, no bar']]);
  assert.deepEqual(signatureRows('A |'), [['A', '']]);
  // A blank line inside the fence is a row of its own, as on the server; no lines make no rows.
  assert.deepEqual(signatureRows('A | B\n\nC'), [['A', 'B'], [''], ['C']]);
  assert.deepEqual(signatureRows(''), []);
});

test('a ```signature fence opens in the draft panel as a borderless table, short rows padded, each cell read as inline Markdown', () => {
  const table = tableOf(markdownToDoc(FENCE));
  assert.deepEqual(table.attrs, { signature: true });
  const rows = table.content ?? [];
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.content?.length, 2, 'every row as wide as the widest');
    for (const cell of row.content ?? []) assert.equal(cell.type, 'tableCell', 'no header cells');
  }
  assert.equal(cellText(rows[0].content?.[0]), 'SIGNED by the Landlord');
  assert.equal(cellText(rows[0].content?.[1]), 'SIGNED by the Tenant');
  // Bold stays bold, and "\|" is a bar inside the cell.
  assert.deepEqual(rows[1].content?.[0].content?.[0].content, [{ type: 'text', text: 'TEST DATA Ada Obi', marks: [{ type: 'bold' }] }]);
  assert.equal(cellText(rows[1].content?.[1]), 'TEST DATA Bayo | Co');
  // The short third row gets an empty cell.
  assert.equal(cellText(rows[2].content?.[0]), '______________________');
  assert.deepEqual(rows[2].content?.[1].content, [{ type: 'paragraph' }]);
  // A cell that is not one paragraph shows as typed, as on the server: a heading mark stays.
  assert.equal(cellText(tableOf(markdownToDoc('```signature\n# TEST DATA | x\n```')).content?.[0].content?.[0]), '# TEST DATA');
});

test('only a fence tagged signature alone is a signing table: any case; other fences stay code blocks', () => {
  assert.equal(tableOf(markdownToDoc('```SIGNATURE\nA | B\n```')).attrs?.signature, true);
  for (const markdown of ['```signature x\nA | B\n```', '```js\nA | B\n```', '```\nA | B\n```']) {
    const first = markdownToDoc(markdown).content?.[0];
    assert.equal(first?.type, 'codeBlock', markdown);
  }
  // An empty signature fence makes nothing, as on the server.
  assert.deepEqual(markdownToDoc('```signature\n```').content, [{ type: 'paragraph' }]);
});

test('the editor keeps the mark when a draft is saved: the table is valid in the note schema and writes data-type="signature"', () => {
  const doc = schema.nodeFromJSON(markdownToDoc(FENCE));
  doc.check();
  let table = null as ReturnType<typeof doc.child> | null;
  doc.descendants((node) => {
    if (node.type.name === 'table') table = node;
    return !table;
  });
  assert.ok(table);
  assert.equal(table.attrs.signature, true);

  const toDOM = schema.nodes.table.spec.toDOM;
  assert.ok(toDOM);
  const spec = toDOM(table) as unknown as [string, Record<string, string>, ...unknown[]];
  assert.equal(spec[0], 'table');
  assert.equal(spec[1]['data-type'], 'signature');

  // A plain table writes no mark.
  const plain = schema.nodes.table.create(null, table.content);
  const plainSpec = toDOM(plain) as unknown as [string, Record<string, string>, ...unknown[]];
  assert.equal(plainSpec[1]['data-type'], undefined);
  assert.equal(typeof DOMSerializer.fromSchema(schema), 'object');
});

test('the editor reads the mark back from saved HTML, and only the exact value', () => {
  const rule = schema.nodes.table.spec.parseDOM?.[0];
  assert.ok(rule?.getAttrs);
  const element = (dataType: string | null) =>
    ({ getAttribute: (name: string) => (name === 'data-type' ? dataType : null), style: {} }) as unknown as HTMLElement;
  assert.equal((rule.getAttrs(element('signature')) as { signature?: boolean }).signature, true);
  assert.equal((rule.getAttrs(element(null)) as { signature?: boolean }).signature, false);
  assert.equal((rule.getAttrs(element('Signature ')) as { signature?: boolean }).signature, false);
});

test('the note reader keeps the signature mark on a table, and only the exact value', () => {
  const element = (value: string | null) => ({ getAttribute: (name: string) => (name === 'data-type' ? value : null) });
  assert.equal(isSignatureTable(element('signature')), true);
  assert.equal(isSignatureTable(element(null)), false);
  assert.equal(isSignatureTable(element('case-mention')), false);
  const content = read('notes', 'reader', 'NoteContent.tsx');
  assert.match(content, /<table data-type=\{node\.signature \? 'signature' : undefined\}>/);
});

test('every surface draws the signing table without borders: one stylesheet, imported where a draft or note is drawn', () => {
  const css = read('notes', 'signature-table.css');
  assert.match(css, /:is\(\.v2-note-fonts, \.ProseMirror\) table\[data-type='signature'\] :is\(td, th\) \{\s*border: 0;/);
  for (const parts of [
    ['notes', 'reader', 'NoteContent.tsx'],
    ['notes', 'editor', 'NoteEditorScreen.tsx'],
    ['conversations', 'conversation', 'draft', 'DraftEditor.tsx'],
    ['conversations', 'conversation', 'draft', 'DraftChangesView.tsx'],
  ]) {
    assert.match(read(...parts), /import '@\/v2\/features\/notes\/signature-table\.css';/, parts.join('/'));
  }
});

test('Show changes and the chat card draw a template draft as the panel does: aligned lines aligned, the signing table marked', () => {
  const view = read('conversations', 'conversation', 'draft', 'DraftChangesView.tsx');
  assert.match(view, /<table data-type=\{node\.attrs\?\.signature \? 'signature' : undefined\}>/);
  assert.match(view, /case 'paragraph':\s*return <p key=\{key\} className=\{tone\} style=\{alignment\(node\)\}>/);
  const card = read('conversations', 'conversation', 'draft', 'DraftCard.tsx');
  // Without a side panel the card reads the draft as the panel reads it, not as chat Markdown.
  assert.match(card, /<DraftDocument draft=\{draft\} \/>/);
  assert.match(card, /markdownToDoc\(draft\.body, \{ font: draft\.font, size: draft\.size \}\)/);
  assert.doesNotMatch(card, /MarkdownText/);
  // And the centred line it reads is a centred paragraph, not typed tags.
  assert.deepEqual(markdownToDoc('<p style="text-align: center">**TEST DATA TENANCY AGREEMENT**</p>').content?.[0].attrs, { textAlign: 'center' });
});

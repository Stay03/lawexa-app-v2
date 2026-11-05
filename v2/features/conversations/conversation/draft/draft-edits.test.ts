import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { draftEditStatus, draftsIn, editsIn, splitDrafts } from './draft-blocks';
import { draftGroupTitle, draftVersionIndex } from './draft-versions';
import { reportParts } from '../../../radars/report/report-drafts';

/* Lawexa changes only the part of a draft the reader asked for (Stay's option
 * A, thread 803b7234; spec 76a6d14b): <draft-edit id version> with find/replace
 * pairs. These mirror the server's DraftEditParser tests (woz 73a6d912). TEST
 * DATA throughout. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

const EDIT = [
  'TEST DATA. I changed the rent and removed the pets clause.',
  '<draft-edit id="k3f9q2" version="3">',
  '<find>The rent is ₦1,200,000 a year.</find>',
  '<replace>The rent is ₦1,500,000 a year.</replace>',
  '<find>',
  'Pets are allowed.',
  '</find>',
  '<replace></replace>',
  '</draft-edit>',
  'Anything else?',
].join('\n');

test('an edit is split from the reply around it, its pairs in order, with id and version', () => {
  const parts = splitDrafts(EDIT);
  assert.equal(parts.length, 3);
  assert.deepEqual(parts[0], { kind: 'text', text: 'TEST DATA. I changed the rent and removed the pets clause.\n' });
  assert.deepEqual(parts[1], {
    kind: 'edit',
    edit: {
      id: 'k3f9q2',
      version: 3,
      complete: true,
      pairs: [
        { find: 'The rent is ₦1,200,000 a year.', replace: 'The rent is ₦1,500,000 a year.', complete: true },
        // One line break inside each edge of a find or replace is dropped; an empty replace deletes.
        { find: 'Pets are allowed.', replace: '', complete: true },
      ],
    },
  });
  assert.deepEqual(parts[2], { kind: 'text', text: '\nAnything else?' });
  // It is not a whole draft: it adds no draft and no version.
  assert.deepEqual(draftsIn(EDIT), []);
});

test('breaks inside a find or replace are kept, only one at each edge is dropped', () => {
  const [edit] = editsIn('<draft-edit id="k3f9q2" version="2">\n<find>\n\nTEST\nDATA\n\n</find>\n<replace>A\n\nB</replace>\n</draft-edit>');
  assert.deepEqual(edit.pairs, [{ find: '\nTEST\nDATA\n', replace: 'A\n\nB', complete: true }]);
});

test('an edit is complete only with its closing tag; an open one runs to the end', () => {
  const [edit] = editsIn('<draft-edit id="k3f9q2" version="2"><find>TEST</find><replace>DATA</replace>');
  assert.equal(edit.complete, false);
  assert.deepEqual(edit.pairs, [{ find: 'TEST', replace: 'DATA', complete: true }]);
  // Text after an open edit is its own, not the reply's.
  assert.equal(splitDrafts('Intro.\n<draft-edit id="k3f9q2" version="2"><find>TEST</find>').length, 2);
});

test('a bad id or version is dropped; the edit still reads', () => {
  for (const tag of ['<draft-edit id="K3F9Q2" version="0">', '<draft-edit id="ab" version="1000">', '<draft-edit>']) {
    const [edit] = editsIn(`${tag}<find>TEST</find><replace>DATA</replace></draft-edit>`);
    assert.equal(edit.id, null, tag);
    assert.equal(edit.version, null, tag);
    assert.equal(edit.pairs.length, 1, tag);
  }
  // Attributes in any order.
  assert.deepEqual(editsIn('<draft-edit version="4" id="k3f9q2"></draft-edit>')[0], { id: 'k3f9q2', version: 4, pairs: [], complete: true });
});

test('a reply with no edit has none, and drafts and edits keep their order', () => {
  assert.deepEqual(editsIn('TEST DATA, no tags.'), []);
  const mixed = '<draft title="TEST Lease" id="k3f9q2" version="1">Body.</draft>\nThen:\n<draft-edit id="k3f9q2" version="2"><find>Body.</find><replace>New body.</replace></draft-edit>';
  assert.deepEqual(splitDrafts(mixed).map((part) => part.kind), ['draft', 'text', 'edit']);
});

test('while it streams, a half-written pair shows as far as it has got and no tag shows as text', () => {
  const at = (text: string) => editsIn(text, true)[0];
  assert.deepEqual(at('<draft-edit id="k3f9q2" version="2">\n<find>The rent is').pairs, [{ find: 'The rent is', replace: '', complete: false }]);
  assert.deepEqual(at('<draft-edit id="k3f9q2" version="2"><find>TEST</fi').pairs, [{ find: 'TEST', replace: '', complete: false }]);
  assert.deepEqual(at('<draft-edit id="k3f9q2" version="2"><find>TEST</find>\n<repl').pairs, [{ find: 'TEST', replace: '', complete: false }]);
  assert.deepEqual(at('<draft-edit id="k3f9q2" version="2"><find>TEST</find><replace>DA</repla').pairs, [{ find: 'TEST', replace: 'DA', complete: false }]);
  // The opening tag itself, cut off at the very end, is held back.
  assert.deepEqual(splitDrafts('TEST DATA.\n<draft-e', true), [{ kind: 'text', text: 'TEST DATA.\n' }]);
  assert.deepEqual(splitDrafts('TEST DATA.\n<draft-edit id="k3f', true), [{ kind: 'text', text: 'TEST DATA.\n' }]);
  // Saved, an unfinished pair is not read.
  assert.deepEqual(editsIn('<draft-edit id="k3f9q2" version="2"><find>TEST</find><replace>DA')[0].pairs, []);
});

test('the edit card says Editing while it streams, the count once written, Unfinished if cut short', () => {
  const edit = (complete: boolean, count: number) => ({
    id: 'k3f9q2',
    version: 2,
    complete,
    pairs: Array.from({ length: count }, () => ({ find: 'A', replace: 'B', complete: true })),
  });
  assert.equal(draftEditStatus(edit(false, 0), true), 'Editing · No changes yet');
  assert.equal(draftEditStatus(edit(false, 2), true), 'Editing · 2 changes');
  assert.equal(draftEditStatus(edit(true, 1), false), '1 change');
  assert.equal(draftEditStatus(edit(true, 0), false), 'No changes');
  assert.equal(draftEditStatus(edit(false, 1), false), 'Unfinished · 1 change');
});

test('the card names the draft by its newest title; a Radar report leaves edits out', () => {
  const index = draftVersionIndex([
    { id: 'a1', role: 'assistant', content: '<draft title="TEST Lease" id="k3f9q2" version="1">A</draft>' },
    { id: 'a2', role: 'assistant', content: '<draft title="TEST Lease (amended)" id="k3f9q2" version="2">B</draft>' },
  ]);
  assert.equal(draftGroupTitle(index, 'id:k3f9q2'), 'TEST Lease (amended)');
  assert.equal(draftGroupTitle(index, 'id:zzzz99'), null);
  assert.deepEqual(reportParts('TEST <draft-edit id="k3f9q2" version="2"><find>A</find><replace>B</replace></draft-edit>', 0).map((part) => part.kind), ['text']);
  const card = read('DraftEditCard.tsx');
  assert.match(card, /writing \? `Editing \$\{title\}…` : `Changes to \$\{title\}`/);
  assert.match(card, /\?\? 'the draft'/);
  // No tag is shown as text: the answer renders an edit as its own card.
  assert.match(read('..', 'markdown', 'ChatContent.tsx'), /if \(part\.kind === 'edit'\) \{\s*return \[\s*<div key=\{`edit-\$\{index\}`\} className="not-prose">\s*<DraftEditCard edit=\{part\.edit\} live=\{revealing\} \/>/);
});

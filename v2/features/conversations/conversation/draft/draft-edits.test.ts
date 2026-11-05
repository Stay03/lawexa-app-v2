import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { draftEditStatus, draftsIn, editsIn, splitDrafts } from './draft-blocks';
import { draftGroupTitle, draftVersionIndex } from './draft-versions';
import { reportParts } from '../../../radars/report/report-drafts';
import { draftEditBases, resolveDraftEdits } from '../../../../../lib/utils/draft-edits';
import { transformApiMessages } from '../../../../../lib/utils/transform-api-messages';
import type { ApiMessage } from '../../../../../types/chat';

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
      failed: false,
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
  assert.deepEqual(editsIn('<draft-edit version="4" id="k3f9q2"></draft-edit>')[0], { id: 'k3f9q2', version: 4, pairs: [], complete: true, failed: false });
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
    failed: false,
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
  assert.match(card, /: writing\s*\? `Editing \$\{title\}…`\s*: `Changes to \$\{title\}`/);
  assert.match(card, /\?\? 'the draft'/);
  // No tag is shown as text: the answer renders an edit as its own card.
  assert.match(read('..', 'markdown', 'ChatContent.tsx'), /if \(part\.kind === 'edit'\) \{\s*return \[\s*<div key=\{`edit-\$\{index\}`\} className="not-prose">\s*<DraftEditCard edit=\{part\.edit\} live=\{revealing\} \/>/);
});

/* Parts 3 to 5: the server applies each edit once the answer is saved and
 * stores the result on the message (woz 93f19832). */

const LEASE = '<draft title="TEST Lease" id="k3f9q2" version="1">\nRent: ₦1,200,000.\nPets allowed.\n</draft>';
const CHANGE = 'Raised.\n<draft-edit id="k3f9q2" version="2"><find>₦1,200,000</find><replace>₦1,500,000</replace></draft-edit>\nDone.';
const RESOLVED = {
  'k3f9q2:2': { body: 'Rent: ₦1,500,000.\nPets allowed.', ranges: [{ start: 6, end: 16 }], base_version: 1, failed: [], title: 'TEST Lease & "Co"', font: null, size: null },
};

test('a resolved edit is read as the whole version it makes; the reply around it is kept', () => {
  const content = resolveDraftEdits(CHANGE, RESOLVED);
  assert.equal(content, 'Raised.\n<draft title="TEST Lease &amp; &quot;Co&quot;" id="k3f9q2" version="2" from-edit="true">\nRent: ₦1,500,000.\nPets allowed.\n</draft>\nDone.');
  const [draft] = draftsIn(content);
  assert.deepEqual({ title: draft.title, id: draft.id, version: draft.version, body: draft.body, fromEdit: draft.fromEdit }, {
    title: 'TEST Lease & "Co"',
    id: 'k3f9q2',
    version: 2,
    body: 'Rent: ₦1,500,000.\nPets allowed.',
    fromEdit: true,
  });
  // A draft Lawexa wrote whole is not marked.
  assert.equal(draftsIn(LEASE)[0].fromEdit, undefined);
  // The panel compares a version made by an edit against the text it was applied to, and opens
  // showing its changes; without that text it is a whole version, at the reader's last choice.
  const panel = read('DraftPanel.tsx');
  assert.match(panel, /savedMessage\.draftEditBases\?\.\[`\$\{draft\.id\}:\$\{draft\.version\}`\]/);
  assert.match(panel, /const before = editBase \?\? \(previous\?\.complete \? previous\.body : null\);/);
  assert.match(panel, /const showChanges = showChangesChoice \?\? \(editBase !== null \|\| rememberedShowChanges\);/);
  assert.match(panel, /before=\{before\}/);
  // So it is version 2 of the draft, like any version.
  const index = draftVersionIndex([
    { id: 'a1', role: 'assistant', content: LEASE },
    { id: 'a2', role: 'assistant', content },
  ]);
  assert.deepEqual(index.map((entry) => entry.key), ['id:k3f9q2', 'id:k3f9q2']);
  // The font and size come with it.
  assert.match(resolveDraftEdits(CHANGE, { 'k3f9q2:2': { ...RESOLVED['k3f9q2:2'], font: 'Georgia', size: 12 } }), /<draft title="[^"]*" id="k3f9q2" version="2" font="Georgia" size="12" from-edit="true">/);
});

test('a failed edit stays an edit, marked failed, with no version', () => {
  const content = resolveDraftEdits(CHANGE, { 'k3f9q2:2': { body: null, ranges: [], base_version: 1, failed: [{ pair: 0, find: '₦1,200,000', matches: 0 }], title: 'TEST Lease', font: null, size: null } });
  assert.deepEqual(draftsIn(content), []);
  const [edit] = editsIn(content);
  assert.equal(edit.failed, true);
  assert.equal(draftEditStatus(edit, false), 'No new version');
  assert.match(read('DraftEditCard.tsx'), /'Lawexa couldn’t make this change'/);
});

test('an answer with no draft_edits, or an edit the server has not resolved, is read as it was', () => {
  assert.equal(resolveDraftEdits(CHANGE, undefined), CHANGE);
  assert.equal(resolveDraftEdits(CHANGE, {}), CHANGE);
  assert.equal(resolveDraftEdits(CHANGE, { 'k3f9q2:3': RESOLVED['k3f9q2:2'] }), CHANGE);
  // An open edit (a stopped answer) is never swapped.
  const open = 'Raised.\n<draft-edit id="k3f9q2" version="2"><find>₦1,200,000</find>';
  assert.equal(resolveDraftEdits(open, RESOLVED), open);
});

test('the transcript reader writes resolved edits out, for answers, stopped answers and Radar reports', () => {
  const api = (id: number, metadata: Record<string, unknown>) =>
    ({ id, conversation_id: 'c', agent_id: null, role: 'assistant', content: CHANGE, metadata, created_at: '2026-11-05T01:00:00Z' }) as unknown as ApiMessage;
  const [plain, stopped] = transformApiMessages([api(1, { draft_edits: RESOLVED }), api(2, { partial: true, draft_edits: RESOLVED })]);
  for (const message of [plain, stopped]) {
    assert.equal(draftsIn(message.content)[0]?.version, 2);
    assert.match(message.content, /^Raised\./);
  }
  const [before] = transformApiMessages([api(3, {})]);
  assert.equal(before.content, CHANGE);
});

test('a character that changes length when lower-cased does not move the pairs (Techlead 5e5b3216)', () => {
  const content = 'İstanbul, TEST DATA.\n<draft-edit id="k3f9q2" version="2"><find>İzmir rent</find><REPLACE>İzmir lease</REPLACE></Draft-Edit>\nAfter.';
  const parts = splitDrafts(content);
  assert.deepEqual(parts.map((part) => part.kind), ['text', 'edit', 'text']);
  assert.deepEqual((parts[1] as { kind: 'edit'; edit: { pairs: unknown[] } }).edit.pairs, [{ find: 'İzmir rent', replace: 'İzmir lease', complete: true }]);
  assert.deepEqual(parts[2], { kind: 'text', text: '\nAfter.' });
});

test('the text an edit was applied to comes with the answer, for the panel to compare against (Techlead 3f293dc2)', () => {
  const withBase = { 'k3f9q2:2': { ...RESOLVED['k3f9q2:2'], base_body: 'Rent: ₦1,200,000.\nPets allowed (as the person edited it).' } };
  assert.deepEqual(draftEditBases(withBase), { 'k3f9q2:2': 'Rent: ₦1,200,000.\nPets allowed (as the person edited it).' });
  // None sent, or only on a failed edit: nothing.
  assert.equal(draftEditBases(RESOLVED), undefined);
  assert.equal(draftEditBases({ 'k3f9q2:2': { body: null, base_body: 'x' } }), undefined);
  const [message] = transformApiMessages([
    { id: 1, conversation_id: 'c', agent_id: null, role: 'assistant', content: CHANGE, metadata: { draft_edits: withBase }, created_at: '2026-11-05T01:00:00Z' } as unknown as ApiMessage,
  ]);
  assert.deepEqual((message as { draftEditBases?: Record<string, string> }).draftEditBases, draftEditBases(withBase));
});

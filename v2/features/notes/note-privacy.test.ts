import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { noteOwnerMark } from './note-privacy';

/* The owner's mark on a note says who can open it, from the server's
 * `visible_to` (techlead's task 0c312e51; WOZ's contract 4bfea576). */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('a note only its owner can open says so: a draft as a draft, a published one as private', () => {
  assert.equal(noteOwnerMark({ status: 'draft', visible_to: 'only_you' }, true), 'Draft · only you can see this');
  // A note Lawexa writes in a chat: published and private.
  assert.equal(noteOwnerMark({ status: 'published', visible_to: 'only_you' }, true), 'Private · only you can see this');
});

test('a Space’s note and a public note carry no mark, and nobody but the owner sees one', () => {
  assert.equal(noteOwnerMark({ status: 'published', visible_to: 'space' }, true), null);
  assert.equal(noteOwnerMark({ status: 'draft', visible_to: 'space' }, true), null);
  assert.equal(noteOwnerMark({ status: 'published', visible_to: 'everyone' }, true), null);
  assert.equal(noteOwnerMark({ status: 'draft', visible_to: 'only_you' }, false), null);
  assert.equal(noteOwnerMark({ status: 'published', visible_to: 'only_you' }, false), null);
});

test('a server without visible_to keeps today’s rule: a draft is marked, a published note is not', () => {
  assert.equal(noteOwnerMark({ status: 'draft' }, true), 'Draft · only you can see this');
  assert.equal(noteOwnerMark({ status: 'published' }, true), null);
});

test('the note page shows the mark from the rule, not from the status alone', () => {
  const doc = read('v2', 'features', 'notes', 'reader', 'NoteDocument.tsx');
  assert.match(doc, /const ownerMark = noteOwnerMark\(note, isOwn\);/);
  assert.match(doc, /\{ownerMark \? \(/);
  assert.doesNotMatch(doc, /isOwnDraft/);
});

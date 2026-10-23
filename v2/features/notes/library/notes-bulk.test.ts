import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { notesBulkActions } from './notes-bulk-model';

/* Bulk select on My notes (Arthur, 20 October 2026, part 2): tick the
 * reader's own notes and act on them together, with actions that fit what is
 * ticked, a select-all for the current list, and a count before a delete. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('My notes offers publish for drafts and unpublish for published notes', () => {
  const always = ['make_private', 'make_public', 'delete'];
  assert.deepEqual(notesBulkActions({ drafts: 2, published: 0, unknown: 0 }), ['publish', ...always]);
  assert.deepEqual(notesBulkActions({ drafts: 0, published: 3, unknown: 0 }), ['unpublish', ...always]);
  assert.deepEqual(notesBulkActions({ drafts: 1, published: 1, unknown: 0 }), ['publish', 'unpublish', ...always]);
  // A row whose status the list did not carry hides neither.
  assert.deepEqual(notesBulkActions({ drafts: 0, published: 1, unknown: 1 }), ['publish', 'unpublish', ...always]);
  // Nothing ticked: every action shows, off.
  assert.deepEqual(notesBulkActions({ drafts: 0, published: 0, unknown: 0 }), ['publish', 'unpublish', ...always]);
});

test('each action is one bulk request, and a delete asks first with the count', () => {
  const bulk = read('notes-bulk.tsx');
  assert.match(bulk, /bulkApi\.notes\(ticked, \{ action: 'publish' \}\)/);
  assert.match(bulk, /bulkApi\.notes\(ticked, \{ action: 'unpublish' \}\)/);
  assert.match(bulk, /bulkApi\.notes\(ticked, \{ action: 'privacy', isPrivate: true \}\)/);
  assert.match(bulk, /bulkApi\.notes\(ticked, \{ action: 'privacy', isPrivate: false \}\)/);
  assert.match(bulk, /bulkApi\.notes\(ticked, \{ action: 'delete' \}\)/);
  assert.match(bulk, /title=\{`Delete \$\{countOf\(select\.count, NOUN\)\}\?`\}/);
  // Only the confirm runs the delete.
  assert.equal(bulk.match(/action: 'delete'/g)?.length, 1);
  assert.match(read('..', '..', 'bulk', 'api.ts'), /post\('\/bulk\/notes', body\)/);
});

test('only My notes can be ticked, and a tab change drops the ticks', () => {
  const page = read('NotesBrowser.tsx');
  assert.match(page, /useNotesBulk\(\{ rows: tab === 'mine' \? rows : NO_ROWS \}\)/);
  assert.match(page, /const selecting = bulk\.selecting && tab === 'mine';/);
  assert.match(page, /\{tab === 'mine' && rows\.length > 0 && !selecting\s*\? bulk\.startButton\(/);
  // On a phone Select is its icon, square, so the tab row stays one line; the word is still read out.
  assert.match(page, /max-sm:size-11 max-sm:px-0/);
  assert.match(read('notes-bulk.tsx'), /<ListChecks aria-hidden className="size-4 sm:hidden" \/>\s*<span className="max-sm:sr-only">Select<\/span>/);
  assert.match(page, /const setTab = \(next: NotesTab\) => \{\s*\/\/ [^\n]*\n\s*bulk\.stop\(\);/);
  // The floating search pill steps aside for the bar.
  assert.match(page, /\{searchAtTop \|\| selecting \? null : \(\s*<ScreenDock>/);
});

test('the outcome says which way the privacy went', () => {
  const bulk = read('notes-bulk.tsx');
  assert.match(bulk, /verb: \{ past: 'Made', pastLower: 'made private', after: 'private' \}/);
  assert.match(bulk, /verb: \{ past: 'Made', pastLower: 'made public', after: 'public' \}/);
  assert.doesNotMatch(bulk, /past: 'Changed'/);
});

test('a ticked note row is its own tick box, and the menu steps aside', () => {
  const row = read('NoteRow.tsx');
  assert.match(row, /\{selecting \? \(\s*<label className=\{cn\(rowClass, 'cursor-pointer', selected && 'bg-secondary\/60'\)\}>\s*<Checkbox/);
  assert.match(row, /\{selecting \? \(\s*<span aria-hidden className="-mr-1\.5 mt-2\.5 size-9 shrink-0" \/>\s*\) : \(\s*<div className="-mr-1\.5 mt-2\.5 shrink-0">\s*<NoteRowMenu/);
});

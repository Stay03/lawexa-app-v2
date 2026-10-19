import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AxiosError, AxiosHeaders } from 'axios';

import { initialAutosaveState, reduceAutosave, updateInputFor } from './autosave-machine';
import { classifySaveFailure } from './save-failure';
import { pickRestoreCandidate } from './use-draft-mirror';

/* Text loss in the note editor (Tester Claude, 19 October 2026, note 1968):
 * a computer saved line P; the phone opened the editor on its cached copy
 * without P, typed Q and saved, and P was gone. Three guards:
 *  (a) the editor opens only on a copy fetched from the server on this open;
 *  (b) a local draft never replaces the server copy without the reader's say;
 *  (c) every save carries the base version, and a 409 stops saving. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const editor = (...parts: string[]) => read('v2', 'features', 'notes', 'editor', ...parts);

const OPENED = { id: 1968, draft: { title: 'TEST', content: '<p>P</p>' }, updatedAt: '2026-10-19T17:27:29Z' };

test('(a) the editor opens only on the copy fetched during this open', () => {
  const screen = editor('EditNoteScreen.tsx');
  assert.match(screen, /refetchOnMount: 'always',/);
  assert.match(screen, /const fresh = note\.isFetchedAfterMount && note\.isSuccess;/);
  assert.match(screen, /const envelope = fresh \? note\.data : undefined;/);
  // Until then: the skeleton, never an editor on the cached copy.
  assert.match(screen, /if \(!envelope\) \{\s*return \(\s*<div className=\{NOTE_PAPER_COLUMN\}>\s*<NoteEditorSkeleton \/>/);
  assert.match(screen, /const record = envelope\.data;/);
});

test('(a) offline: a cached copy is shown read-only, with the line that the latest could not load', () => {
  const screen = editor('EditNoteScreen.tsx');
  assert.match(screen, /if \(!settled && note\.data\) \{/);
  assert.match(screen, /Can&apos;t load the latest copy\./);
  // The reader's document, not the editor: nothing to type into.
  assert.match(screen, /<NoteDocument note=\{note\.data\.data\} editHref=\{null\} \/>/);
});

test('(b) a local draft is only ever offered, and never over a newer server copy', () => {
  const record = { id: 1968, title: 'TEST', content: '<p>P</p>', updated_at: '2026-10-19T17:27:29Z', created_at: '2026-10-19T17:00:00Z' } as never;
  const older = { title: 'TEST', content: '<p>old</p>', updated_at: '2026-10-19T17:10:00Z' } as never;
  assert.equal(pickRestoreCandidate({ mirror: older, orphan: null } as never, record), null);
  // Applying one is the reader's act on the restore bar, nothing else.
  const screen = editor('NoteEditorScreen.tsx');
  assert.match(screen, /<RestoreDraftBar[\s\S]*?onRestore=\{restoreCandidate\}/);
});

test('(c) every update carries the base version, and a save moves it on', () => {
  let state = initialAutosaveState(OPENED);
  assert.equal(state.base, '2026-10-19T17:27:29Z');
  state = reduceAutosave(state, { type: 'edit', draft: { title: 'TEST', content: '<p>PQ</p>' }, at: 0 }).state;
  const sent = reduceAutosave(state, { type: 'flush', at: 1 });
  assert.equal(sent.save?.mode, 'update');
  assert.equal(sent.save?.mode === 'update' && sent.save.base, '2026-10-19T17:27:29Z');
  assert.deepEqual(updateInputFor({ title: 'TEST', content: '<p>PQ</p>' }, '2026-10-19T17:27:29Z'), {
    title: 'TEST',
    content: '<p>PQ</p>',
    base_updated_at: '2026-10-19T17:27:29Z',
  });
  const saved = reduceAutosave(sent.state, {
    type: 'saved',
    noteId: 1968,
    draft: { title: 'TEST', content: '<p>PQ</p>' },
    updatedAt: '2026-10-19T17:40:00Z',
    at: 2,
  });
  assert.equal(saved.state.base, '2026-10-19T17:40:00Z');
  assert.match(read('v2', 'features', 'notes', 'mutations.ts'), /notesApi\.update\(request\.noteId, updateInputFor\(request\.draft, request\.base\)\)/);
});

test('(c) our own publish moves the base, so the next save is not refused', () => {
  let state = initialAutosaveState(OPENED);
  state = reduceAutosave(state, { type: 'rebase', updatedAt: '2026-10-19T17:45:00Z', at: 0 }).state;
  assert.equal(state.base, '2026-10-19T17:45:00Z');
  // A missing stamp keeps the base it had.
  assert.equal(reduceAutosave(state, { type: 'rebase', updatedAt: null, at: 1 }).state.base, '2026-10-19T17:45:00Z');
  assert.match(editor('NoteEditorScreen.tsx'), /onPublished=\{\(next\) => \{[\s\S]*?autosave\.rebase\(next\.updated_at\);/);
});

test('(c) a 409 is a conflict: saving stops for good, and the typed text stays', () => {
  const error = new AxiosError('Conflict', '409', undefined, undefined, {
    status: 409,
    statusText: 'Conflict',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: { success: false, message: 'This note was changed elsewhere.' },
  } as never);
  assert.equal(classifySaveFailure(error, 'update', 0).kind, 'conflict');

  let state = initialAutosaveState(OPENED);
  state = reduceAutosave(state, { type: 'edit', draft: { title: 'TEST', content: '<p>Q</p>' }, at: 0 }).state;
  state = reduceAutosave(state, { type: 'flush', at: 1 }).state;
  state = reduceAutosave(state, { type: 'failed', failure: { kind: 'conflict', message: 'changed' }, at: 2 }).state;
  assert.equal(state.status, 'conflict');
  assert.equal(state.wakeAt, null);
  // Typing on, flushing, or pressing retry sends nothing from this copy.
  const typed = reduceAutosave(state, { type: 'edit', draft: { title: 'TEST', content: '<p>QR</p>' }, at: 3 });
  assert.equal(typed.save, null);
  assert.equal(typed.state.working.content, '<p>QR</p>');
  assert.equal(reduceAutosave(typed.state, { type: 'flush', at: 4 }).save, null);
  assert.equal(reduceAutosave(typed.state, { type: 'retry', at: 5 }).save, null);
  // The editor says so, with the way to the newer copy.
  const screen = editor('NoteEditorScreen.tsx');
  assert.match(screen, /\{autosave\.status === 'conflict' \? \(\s*<EditorNotice tone="alert" title="This note was changed elsewhere">\s*Reload to see the latest\./);
  assert.match(screen, /onClick=\{\(\) => window\.location\.reload\(\)\}/);
});

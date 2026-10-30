import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { DraftNoteDocument } from '@/v2/features/notes/types';
import {
  CATCH_UP_LIMIT_MS,
  CATCH_UP_POLL_MS,
  catchUpClockStart,
  catchUpPoll,
  documentFor,
  draftEditable,
  draftNotesRead,
  newestFinished,
  draftNoteLine,
  draftNoteState,
  revisionAuthorLabel,
  type DraftNotesRead,
} from './draft-note-state';

/* Drafts saved as notes (Stay's "go", 27 October 2026; thread 1e44eb39). The
 * list is woz's shape (a518eaf3); TEST DATA throughout. */

const NOTE = { id: 2141, slug: 'test-data-tenancy', title: 'TEST DATA Tenancy', updated_at: '2026-10-29T02:10:00.000000Z' };

/** "TEST DATA Tenancy" written three times, at drafts 0, 3 and 5; the note caught up and editable. */
function tenancy(overrides: Partial<DraftNoteDocument> = {}): DraftNoteDocument {
  return {
    key: 'id:k3f9q2',
    title: 'TEST DATA Tenancy',
    ordinals: [0, 3, 5],
    latest_ordinal: 5,
    lawexa_version: 3,
    message_id: 88123,
    note_version: 3,
    edited: false,
    can_edit: true,
    note: NOTE,
    note_missing: null,
    ...overrides,
  };
}

const listed = (...documents: DraftNoteDocument[]): DraftNotesRead => ({ status: 'success', notes: true, documents });

/** Draft `ordinal` of the tenancy group, with the chat's newest version at `latest`. */
const at = (ordinal: number, latest = 5, key = 'id:k3f9q2') => ({ ordinal, key, latestOrdinal: latest });

test('the newest version, caught up, opens the note to edit', () => {
  const state = draftNoteState(listed(tenancy()), at(5));
  assert.equal(state.kind, 'editable');
  assert.equal(state.kind === 'editable' && state.note.id, 2141);
  assert.equal(draftEditable(state), true);
  assert.equal(draftNoteLine(state), null);
});

test('an older version is read only and points at the note’s version', () => {
  for (const ordinal of [0, 3]) {
    const state = draftNoteState(listed(tenancy()), at(ordinal));
    assert.equal(state.kind, 'older');
    assert.equal(state.kind === 'older' && state.latestOrdinal, 5);
    assert.equal(draftEditable(state), false);
    assert.equal(draftNoteLine(state), 'An older version, as Lawexa wrote it. Your note is the latest version.');
  }
});

test('while the note still holds the version before, the newest waits, read only, and the list is read again', () => {
  const state = draftNoteState(listed(tenancy({ note_version: 2 })), at(5));
  assert.equal(state.kind, 'catching-up');
  assert.equal(draftEditable(state), false);
  assert.equal(draftNoteLine(state, 0), 'Saving to your notes…');
  assert.equal(catchUpPoll(state, 0), CATCH_UP_POLL_MS);
  assert.equal(catchUpPoll(state, CATCH_UP_LIMIT_MS - 1), CATCH_UP_POLL_MS);
  // Past the limit it stops asking and says so, with Try again.
  assert.equal(catchUpPoll(state, CATCH_UP_LIMIT_MS), false);
  assert.equal(draftNoteLine(state, CATCH_UP_LIMIT_MS), 'Your note hasn’t caught up yet.');
  // Nothing else polls.
  assert.equal(catchUpPoll(draftNoteState(listed(tenancy()), at(5)), 0), false);
  // An older version never waits on the note: it shows Lawexa's own text.
  assert.equal(draftNoteState(listed(tenancy({ note_version: 2 })), at(3)).kind, 'older');
});

test('a reader who may not edit (a Space’s Viewer) reads the note', () => {
  const state = draftNoteState(listed(tenancy({ can_edit: false })), at(5));
  assert.equal(state.kind, 'read-only');
  assert.equal(draftEditable(state), false);
  assert.equal(draftNoteLine(state), 'You can read this draft. Only the Space’s editors can change it.');
});

test('at the note limit no note is made: read only, with the downloads, and it says why', () => {
  const state = draftNoteState(listed(tenancy({ note: null, note_missing: 'limit' })), at(5));
  assert.equal(state.kind === 'missing' && state.reason, 'limit');
  assert.equal(draftEditable(state), false);
  assert.equal(draftNoteLine(state), 'You’ve reached your note limit, so this draft isn’t saved. Download it to keep it.');
  assert.equal(catchUpPoll(state, 0), false);
});

test('a deleted note stays deleted: read only, with the downloads', () => {
  const state = draftNoteState(listed(tenancy({ note: null, note_missing: 'deleted' })), at(5));
  assert.equal(state.kind === 'missing' && state.reason, 'deleted');
  assert.equal(draftEditable(state), false);
  assert.equal(draftNoteLine(state), 'You deleted this draft’s note. Download it to keep a copy.');
  // A server from before the reason: no note can only have been deleted.
  assert.equal(draftNoteLine(draftNoteState(listed(tenancy({ note: null, note_missing: null })), at(5))), 'You deleted this draft’s note. Download it to keep a copy.');
});

test('a chat moved since, or a note the reader may not see: read only, each saying why', () => {
  const moved = draftNoteState(listed(tenancy({ note: null, note_missing: 'moved' })), at(5));
  assert.equal(moved.kind === 'missing' && moved.reason, 'moved');
  assert.equal(draftEditable(moved), false);
  assert.equal(draftNoteLine(moved), 'This chat moved after the draft was saved, so its note stays where it was. Download this version to keep it.');
  const hidden = draftNoteState(listed(tenancy({ note: null, note_missing: 'hidden' })), at(5));
  assert.equal(draftEditable(hidden), false);
  assert.equal(draftNoteLine(hidden), 'This draft’s note isn’t one you can open. Download it to keep a copy.');
  // An older version is older whatever its note: it shows Lawexa's text.
  assert.equal(draftNoteState(listed(tenancy({ note: null, note_missing: 'moved' })), at(3)).kind, 'older');
});

test('a chat that keeps no draft notes (confidential, or a Radar report for now): editing in the page’s memory, no note', () => {
  const state = draftNoteState({ status: 'success', notes: false, documents: [] }, at(0));
  assert.equal(state.kind, 'notes-off');
  assert.equal(draftEditable(state), true);
  // Not "confidential": a Radar report answers `notes: false` too, and is not.
  assert.equal(draftNoteLine(state), 'This draft isn’t saved as a note. Download it to keep it.');
});

test('a list that is loading or failed never opens an editor, and only a failed read says the note couldn’t be reached', () => {
  assert.equal(draftNoteState({ status: 'pending' }, at(5)).kind, 'loading');
  const failed = draftNoteState({ status: 'error' }, at(5));
  assert.equal(failed.kind, 'unlisted');
  assert.equal(draftEditable(failed), false);
  assert.equal(draftNoteLine(failed), 'Your note couldn’t be reached.');
  assert.equal(catchUpPoll(failed, 0), false);
});

/* Arthur's report (30 October 2026, about 15:55): "Your note couldn't be
 * reached" after a first draft, and "hasn't caught up yet" after a later one.
 * The list was read at the draft's closing tag, while Lawexa was still writing
 * the rest of the answer; the server lists a draft only once that answer is
 * saved. TEST DATA throughout. */

test('a first draft the list has not reached yet waits for its note, never “couldn’t be reached”', () => {
  // The list answered, but holds only another draft: this one's answer is not saved yet.
  const letter = tenancy({ key: 'title:test data letter', title: 'TEST DATA Letter' });
  const state = draftNoteState(listed(letter), at(0, 0, 'id:first'));
  assert.equal(state.kind, 'catching-up');
  assert.equal(state.kind === 'catching-up' && state.document, null);
  assert.equal(draftEditable(state), false);
  assert.equal(draftNoteLine(state, 0), 'Saving to your notes…');
  // An empty list is the same: the chat's first draft of all.
  assert.equal(draftNoteState(listed(), at(0, 0, 'id:first')).kind, 'catching-up');
  // Once listed and caught up, it opens the note to edit.
  const first = tenancy({ key: 'id:first', ordinals: [0], latest_ordinal: 0, lawexa_version: 1, note_version: 1 });
  assert.equal(draftNoteState(listed(letter, first), at(0, 0, 'id:first')).kind, 'editable');
});

test('while Lawexa is still writing the answer the list is not read again; once it ends, every 2 s up to the limit', () => {
  const first = draftNoteState(listed(), at(0, 0, 'id:first'));
  const behind = draftNoteState(listed(tenancy()), at(7, 7));
  for (const state of [first, behind]) {
    assert.equal(catchUpPoll(state, 0, false), false);
    assert.equal(catchUpPoll(state, 0, true), CATCH_UP_POLL_MS);
    assert.equal(catchUpPoll(state, CATCH_UP_LIMIT_MS - 1, true), CATCH_UP_POLL_MS);
    assert.equal(catchUpPoll(state, CATCH_UP_LIMIT_MS, true), false);
    assert.equal(draftNoteLine(state, CATCH_UP_LIMIT_MS), 'Your note hasn’t caught up yet.');
  }
});

test('the 30 s wait starts at the first read after the answer ended, so a long answer after the draft never uses it up', () => {
  // Still writing: no clock, whatever the reads.
  assert.equal(catchUpClockStart(10_000, false, null), null);
  // Ended while the panel watched, the newest read then at 4 s: that read and older ones don't start it.
  assert.equal(catchUpClockStart(4_000, true, 4_000), null);
  assert.equal(catchUpClockStart(3_000, true, 4_000), null);
  // The first read after the end starts it.
  assert.equal(catchUpClockStart(52_000, true, 4_000), 52_000);
  // A panel opened on an answer already over starts it at its first read.
  assert.equal(catchUpClockStart(8_000, true, null), 8_000);
});

test('each draft finds its own document among several', () => {
  const letter = tenancy({ key: 'title:test data letter', title: 'TEST DATA Letter', ordinals: [1, 2], latest_ordinal: 2, lawexa_version: 2, note_version: 2, note: { ...NOTE, id: 7 } });
  const documents = [tenancy(), letter];
  assert.equal(documentFor(documents, 'title:test data letter')?.title, 'TEST DATA Letter');
  assert.equal(documentFor(documents, 'id:k3f9q2')?.title, 'TEST DATA Tenancy');
  assert.equal(documentFor(documents, 'id:other'), null);
  const state = draftNoteState(listed(...documents), at(2, 2, 'title:test data letter'));
  assert.equal(state.kind === 'editable' && state.note.id, 7);
  assert.equal(draftNoteState(listed(...documents), at(1, 2, 'title:test data letter')).kind, 'older');
});

test('the history names who wrote each version', () => {
  const viewer = 'u-test-data-reader';
  assert.equal(revisionAuthorLabel({ author: { kind: 'lawexa', user: null }, lawexa_version: 3 }, viewer), 'Lawexa · Version 3');
  assert.equal(revisionAuthorLabel({ author: { kind: 'lawexa', user: null }, lawexa_version: null }, viewer), 'Lawexa');
  assert.equal(
    revisionAuthorLabel({ author: { kind: 'person', user: { uuid: viewer, name: 'TEST DATA Reader' } }, lawexa_version: null }, viewer),
    'You',
  );
  assert.equal(
    revisionAuthorLabel({ author: { kind: 'person', user: { uuid: 'u-other', name: 'TEST DATA Colleague' } }, lawexa_version: null }, viewer),
    'TEST DATA Colleague',
  );
  // A person's revision with no name is never taken for the reader's own.
  assert.equal(revisionAuthorLabel({ author: { kind: 'person', user: null }, lawexa_version: null }, viewer), 'Someone');
  assert.equal(revisionAuthorLabel({ author: { kind: 'person', user: { uuid: viewer, name: 'x' } }, lawexa_version: null }, null), 'x');
});

test('the chat can be ahead of the list: a version just written waits for the note, and the one before turns older at once', () => {
  // Lawexa has just written version 4 at draft 7; the server still lists version 3 at draft 5.
  const behind = listed(tenancy());
  const newest = draftNoteState(behind, at(7, 7));
  assert.equal(newest.kind, 'catching-up');
  assert.equal(draftEditable(newest), false);
  assert.equal(catchUpPoll(newest, 0), CATCH_UP_POLL_MS);
  // The panel still open on version 3 stops editing the note at once: nothing it saves could overwrite version 4.
  const before = draftNoteState(behind, at(5, 7));
  assert.equal(before.kind, 'older');
  assert.equal(before.kind === 'older' && before.latestOrdinal, 7);
  // Once listed and caught up, the newest edits the note.
  const caught = listed(tenancy({ ordinals: [0, 3, 5, 7], latest_ordinal: 7, lawexa_version: 4, note_version: 4 }));
  assert.equal(draftNoteState(caught, at(7, 7)).kind, 'editable');
});

test('a version cut off (Lawexa stopped halfway) never makes the finished one before it older', () => {
  // The chat holds versions at 0, 3 and 5; 5 was stopped halfway and is not finished.
  const finished = new Set([0, 3]);
  const latest = newestFinished([0, 3, 5], (ordinal) => finished.has(ordinal), 3);
  assert.equal(latest, 3);
  // So version 2 (draft 3) is the newest the panel edits; the server agrees (its latest_ordinal is 3).
  const state = draftNoteState(listed(tenancy({ ordinals: [0, 3], latest_ordinal: 3, lawexa_version: 2, note_version: 2 })), at(3, latest));
  assert.equal(state.kind, 'editable');
  // Every version finished: the newest one.
  assert.equal(newestFinished([0, 3, 5], () => true, 3), 5);
  // None finished: the panel's own place.
  assert.equal(newestFinished([0, 3], () => false, 3), 3);
});

test('a failed read again keeps the last good list, so the editor stays; only a list never read is an error', () => {
  const data = { data: { notes: true, documents: [tenancy()] } };
  // A focus refetch, or the server's lock wait ending in a 500, after a good read.
  const kept = draftNotesRead({ isPending: false, data });
  assert.equal(kept.status, 'success');
  assert.equal(draftNoteState(kept, at(5)).kind, 'editable');
  assert.equal(draftNotesRead({ isPending: false, data: undefined }).status, 'error');
  assert.equal(draftNotesRead({ isPending: true, data: undefined }).status, 'pending');
});

test('a document with no note may say note_version null', () => {
  const state = draftNoteState(listed(tenancy({ note: null, note_missing: 'limit', note_version: null })), at(5));
  assert.equal(state.kind === 'missing' && state.reason, 'limit');
});

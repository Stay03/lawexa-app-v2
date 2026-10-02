import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEditorialNotesEid } from './editorial-notes';

test('a notes block under a section, and the Act-level ones, are editorial', () => {
  assert.equal(isEditorialNotesEid('sec_1__notes-1'), true);
  assert.equal(isEditorialNotesEid('sec_9__notes-2'), true);
  assert.equal(isEditorialNotesEid('front__notes-1'), true);
  assert.equal(isEditorialNotesEid('notes-1'), true);
});

test('law text is not: sections, definitions, and words that only contain "notes"', () => {
  assert.equal(isEditorialNotesEid('sec_1__subsec_2'), false);
  assert.equal(isEditorialNotesEid('sec_155__def-promissory-notes'), false);
  assert.equal(isEditorialNotesEid('sec_3__notes'), false);
  assert.equal(isEditorialNotesEid('banknotes-1'), false);
  assert.equal(isEditorialNotesEid(null), false);
  assert.equal(isEditorialNotesEid(undefined), false);
});

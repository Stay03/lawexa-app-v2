import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANNOTATION_COLOURS,
  DEFAULT_ANNOTATION_COLOUR,
  colourOf,
  highlightName,
  isPending,
  isUnplaceable,
  pendingAnnotation,
} from './model';

test('the five colours backend accepts, yellow first as the default', () => {
  assert.deepEqual([...ANNOTATION_COLOURS], ['yellow', 'green', 'blue', 'pink', 'purple']);
  assert.equal(DEFAULT_ANNOTATION_COLOUR, 'yellow');
});

test('no colour stored reads as the default', () => {
  assert.equal(colourOf({ colour: null }), 'yellow');
  assert.equal(colourOf({ colour: 'blue' }), 'blue');
});

test('each colour paints on its own highlight layer', () => {
  assert.equal(highlightName('pink'), 'reader-annotation-pink');
});

test('changed words or a deleted part cannot be placed; a sound one can', () => {
  assert.equal(isUnplaceable({ text_changed: true, detached: false }), true);
  assert.equal(isUnplaceable({ text_changed: false, detached: true }), true);
  assert.equal(isUnplaceable({ text_changed: false, detached: false }), false);
});

test('a stand-in row carries the draft and is marked pending until the server answers', () => {
  const row = pendingAnnotation(
    { eid: 'sec_10__subsec_6', quote: 'claims and objections', prefix: 'As soon as', suffix: 'have been', start_offset: 11, end_offset: 32, body: '', colour: 'green' },
    '2026-09-30T10:00:00Z',
    'a1',
  );
  assert.equal(isPending(row), true);
  assert.equal(row.node?.eid, 'sec_10__subsec_6');
  assert.equal(colourOf(row), 'green');
  assert.equal(isPending({ uuid: '0b8f2c6e-1d2a-4c55-9a51-2f6d8f1a7c10' }), false);
});

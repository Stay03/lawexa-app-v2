import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BULK_MAX,
  batches,
  bulkOutcome,
  mergeResults,
  prunedTo,
  selectAllState,
  selectAllToggled,
  toggled,
  type BulkResult,
} from './model';

/* Bulk select (Arthur, 20 October 2026): tick rows, act on them together. The
 * server takes 50 items a request and answers each item as its own route would. */

test('a long selection goes in batches of 50, and their answers add up to one', () => {
  assert.equal(BULK_MAX, 50);
  const ids = Array.from({ length: 120 }, (_, i) => i + 1);
  assert.deepEqual(batches(ids).map((batch) => batch.length), [50, 50, 20]);
  assert.deepEqual(batches([]), []);
  const merged = mergeResults([
    { results: [{ id: 1, ok: true, code: 200, message: '' }, { id: 2, ok: false, code: 403, message: 'Not yours.' }], done: 1, failed: 1 },
    { results: [{ id: 3, ok: true, code: 200, message: '' }], done: 1, failed: 0 },
  ]);
  assert.equal(merged.done, 2);
  assert.equal(merged.failed, 1);
  assert.equal(merged.results.length, 3);
});

test('a row ticks and unticks; select-all ticks the current list, or clears it when all are ticked', () => {
  let selection: ReadonlySet<string> = new Set();
  selection = toggled(selection, 'a');
  assert.deepEqual([...selection], ['a']);
  selection = toggled(selection, 'a');
  assert.equal(selection.size, 0);

  const list = ['a', 'b', 'c'];
  assert.equal(selectAllState(new Set<string>(), list), false);
  assert.equal(selectAllState(new Set(['a']), list), 'indeterminate');
  assert.equal(selectAllState(new Set(list), list), true);
  assert.deepEqual([...selectAllToggled(new Set(['a']), list)].sort(), list);
  assert.equal(selectAllToggled(new Set(list), list).size, 0);
  // An empty list is never "all ticked".
  assert.equal(selectAllState(new Set<string>(), []), false);
});

test('ticked rows that left the list are dropped, and an unchanged selection keeps its identity', () => {
  const selection = new Set(['a', 'b', 'gone']);
  assert.deepEqual([...prunedTo(selection, ['a', 'b', 'c'])].sort(), ['a', 'b']);
  const kept = new Set(['a']);
  assert.equal(prunedTo(kept, ['a', 'b']), kept);
});

const verb = { past: 'Moved', pastLower: 'moved' };
const noun = { one: 'item', many: 'items' };
const result = (done: number, failed: number, message = 'You can only move your own folders.'): BulkResult => ({
  results: [
    ...Array.from({ length: done }, (_, i) => ({ id: i, ok: true, code: 200, message: '' })),
    ...Array.from({ length: failed }, (_, i) => ({ id: 100 + i, ok: false, code: 403, message })),
  ],
  done,
  failed,
});

test('the outcome is one sentence, and a refusal reads as it would for one item', () => {
  assert.equal(bulkOutcome(result(12, 0), verb, noun), 'Moved 12 items.');
  assert.equal(bulkOutcome(result(1, 0), verb, noun), 'Moved 1 item.');
  assert.equal(bulkOutcome(result(9, 3), verb, noun), "Moved 9 of 12 items. 3 couldn't be moved: You can only move your own folders.");
  assert.equal(bulkOutcome(result(0, 4), verb, noun), 'None of the 4 items could be moved: You can only move your own folders.');
  assert.equal(bulkOutcome(result(0, 1), verb, noun), "The item couldn't be moved: You can only move your own folders.");
  // A failure with no message still reads as a sentence.
  assert.equal(bulkOutcome(result(2, 1, ''), verb, noun), "Moved 2 of 3 items. 1 couldn't be moved.");
});

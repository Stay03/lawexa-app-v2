import { test } from 'node:test';
import assert from 'node:assert/strict';

import { passageLabel, stepPassage } from './pdf-passages';

/* Stepping between a file's passages in the PDF reader's bar (Arthur,
 * 3 November 2026, option 2). */

test('Previous and Next move one passage and stop at the ends', () => {
  assert.equal(stepPassage(0, 3, 1), 1);
  assert.equal(stepPassage(1, 3, 1), 2);
  assert.equal(stepPassage(2, 3, 1), 2);
  assert.equal(stepPassage(2, 3, -1), 1);
  assert.equal(stepPassage(0, 3, -1), 0);
  assert.equal(stepPassage(0, 0, 1), 0);
});

test('the bar says which passage is shown', () => {
  assert.equal(passageLabel(1, 3), 'Passage 2 of 3');
  assert.equal(passageLabel(0, 2), 'Passage 1 of 2');
});

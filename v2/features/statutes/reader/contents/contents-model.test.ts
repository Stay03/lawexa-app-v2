import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { AknOutlineDivision } from '../akn';
import { outlinePosition, owningDivisionOf, splitDivisionLabel, splitSectionLabel } from './contents-model';

/* A statute's Contents (design A, "where you are") reads this model: the
 * label split for the tabular rows, the position for the progress line, and
 * the division that holds the open section. */

const outline: AknOutlineDivision[] = [
  {
    id: 'part-1',
    label: 'Part I — Preliminary',
    sections: [
      { id: 's-1', label: '1. Short title' },
      { id: 's-2', label: '2. Interpretation' },
    ],
  },
  {
    id: 'part-2',
    label: 'Part II — Establishment of the Court',
    sections: [
      { id: 's-3', label: '3. Establishment' },
      { id: 's-12', label: '12. Composition of the Court' },
      { id: 's-12a', label: '12A. Interpretation of Part II', locked: true },
      { id: 's-120', label: '120. Quorum' },
    ],
  },
  {
    id: 'schedule-1',
    label: 'First Schedule',
    sections: [{ id: 'art-1', label: 'Article 1 Definitions' }],
  },
];

test('a section label splits into its number and its title', () => {
  assert.deepEqual(splitSectionLabel('12. Composition of the Court'), {
    num: '12',
    title: 'Composition of the Court',
  });
  assert.deepEqual(splitSectionLabel('12A. Interpretation'), { num: '12A', title: 'Interpretation' });
  assert.deepEqual(splitSectionLabel('7 Jurisdiction'), { num: '7', title: 'Jurisdiction' });
  assert.deepEqual(splitSectionLabel('Article 3 Definitions'), { num: 'Art. 3', title: 'Definitions' });
  assert.deepEqual(splitSectionLabel('Jurisdiction'), { num: null, title: 'Jurisdiction' });
  assert.deepEqual(splitSectionLabel('12.'), { num: null, title: '12.' });
});

test('a division label splits on the em-dash join; a schedule is all title', () => {
  assert.deepEqual(splitDivisionLabel('Part II — Establishment of the Court'), {
    num: 'Part II',
    title: 'Establishment of the Court',
  });
  assert.deepEqual(splitDivisionLabel('First Schedule'), { num: null, title: 'First Schedule' });
});

test('the position counts every entry in document order', () => {
  assert.deepEqual(outlinePosition(outline, null), { index: 0, total: 10, fraction: 0 });
  assert.deepEqual(outlinePosition(outline, 'part-1'), { index: 0, total: 10, fraction: 0 });
  assert.deepEqual(outlinePosition(outline, 's-3'), { index: 4, total: 10, fraction: 4 / 9 });
  assert.deepEqual(outlinePosition(outline, 'art-1'), { index: 9, total: 10, fraction: 1 });
  assert.deepEqual(outlinePosition([], 's-1'), { index: 0, total: 0, fraction: 0 });
});

test('the owning division is the entry itself or its parent, else the first', () => {
  assert.equal(owningDivisionOf(outline, 'part-2'), 'part-2');
  assert.equal(owningDivisionOf(outline, 's-12'), 'part-2');
  assert.equal(owningDivisionOf(outline, null), 'part-1');
  assert.equal(owningDivisionOf(outline, 'missing'), 'part-1');
  assert.equal(owningDivisionOf([], 's-1'), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { AknOutlineDivision } from '../akn';
import {
  contentsVariantOf,
  matchOutline,
  matchRows,
  outlinePosition,
  owningDivisionOf,
  sectionCount,
  splitDivisionLabel,
  splitSectionLabel,
  stepHighlight,
} from './contents-model';

/* The three Contents designs behind `?contents=` (finding 10) share this
 * model: the parameter read, the label split for the tabular rows, the
 * position for the progress line, and the search design B filters with. */

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

test('only a, b and c pick a design; anything else keeps the sheet', () => {
  assert.equal(contentsVariantOf('a'), 'a');
  assert.equal(contentsVariantOf('b'), 'b');
  assert.equal(contentsVariantOf('c'), 'c');
  assert.equal(contentsVariantOf(null), null);
  assert.equal(contentsVariantOf(''), null);
  assert.equal(contentsVariantOf('A'), null);
  assert.equal(contentsVariantOf('d'), null);
});

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

test('an empty query is the whole outline, grouped as it is, sections only', () => {
  const groups = matchOutline(outline, '   ');
  assert.equal(groups.length, 3);
  assert.deepEqual(
    groups.map((group) => [group.division.id, group.divisionMatched, group.sections.length]),
    [['part-1', false, 2], ['part-2', false, 4], ['schedule-1', false, 1]],
  );
  const rows = matchRows(groups);
  assert.equal(rows.length, 7);
  assert.equal(sectionCount(rows), 7);
});

test('a flat act keeps its top-level entries as rows', () => {
  const flat: AknOutlineDivision[] = [
    { id: 's-1', label: '1. Short title', sections: [] },
    { id: 's-2', label: '2. Commencement', sections: [] },
  ];
  assert.deepEqual(
    matchRows(matchOutline(flat, '')).map((row) => [row.kind, row.id]),
    [['division', 's-1'], ['division', 's-2']],
  );
});

test('a number matches section numbers by prefix, across parts', () => {
  const groups = matchOutline(outline, '12');
  assert.deepEqual(
    groups.map((group) => [group.division.id, group.divisionMatched, group.sections.map((s) => s.id)]),
    [['part-2', false, ['s-12', 's-12a', 's-120']]],
  );
  assert.deepEqual(
    matchOutline(outline, '1').flatMap((group) => group.sections.map((s) => s.id)),
    ['s-1', 's-12', 's-12a', 's-120', 'art-1'],
  );
  assert.deepEqual(
    matchOutline(outline, '12a').flatMap((group) => group.sections.map((s) => s.id)),
    ['s-12a'],
  );
  // The number inside a longer label ("12. Composition") is not a match for "2".
  assert.deepEqual(
    matchOutline(outline, '2').flatMap((group) => group.sections.map((s) => s.id)),
    ['s-2'],
  );
});

test('words match titles in any order, ignoring case; a part heading can match on its own', () => {
  assert.deepEqual(
    matchOutline(outline, 'court composition').flatMap((group) => group.sections.map((s) => s.id)),
    ['s-12'],
  );
  const heading = matchOutline(outline, 'establishment');
  assert.deepEqual(
    heading.map((group) => [group.division.id, group.divisionMatched, group.sections.map((s) => s.id)]),
    [['part-2', true, ['s-3']]],
  );
  const rows = matchRows(heading);
  assert.deepEqual(
    rows.map((row) => [row.kind, row.id, row.locked]),
    [['division', 'part-2', false], ['section', 's-3', false]],
  );
  assert.deepEqual(matchOutline(outline, 'zzz'), []);
});

test('a locked entry stays a result and says so', () => {
  const rows = matchRows(matchOutline(outline, 'interpretation of part'));
  assert.deepEqual(rows.map((row) => [row.id, row.locked]), [['s-12a', true]]);
});

test('the highlight wraps at both ends and steps onto the list from nothing', () => {
  assert.equal(stepHighlight(0, -1, 5), 4);
  assert.equal(stepHighlight(4, 1, 5), 0);
  assert.equal(stepHighlight(2, 1, 5), 3);
  assert.equal(stepHighlight(-1, 1, 5), 0);
  assert.equal(stepHighlight(-1, -1, 5), 4);
  assert.equal(stepHighlight(3, 1, 0), -1);
});

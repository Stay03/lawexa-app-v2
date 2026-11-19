import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { TemplateSegment } from '@/types/private-items';
import { applyBlankEdits, blankName, blanksOf, sharedAnswerLine, shortDate, usedLine } from './pages-model';

/* My templates and My skills (Arthur agreed the pages, 19 November 2026,
 * thread 9ae498ae; Backend's shapes the same day). TEST DATA only. */

const T = (text: string): TemplateSegment => ({ type: 'text', text });
const B = (name: string): TemplateSegment => ({ type: 'blank', name });
const DOC: TemplateSegment[] = [
  T('Made between '), B('LANDLORD'), T(' of '), B('LANDLORD ADDRESS'), T(' and '), B('TENANT'), T(' of '), B('TENANT ADDRESS'),
  T('. Rent: '), B('RENT'), T(' a year, citing [2024] LPELR 1. Signed by '), B('LANDLORD'), T('.'),
];

test('a rename changes every chip of that blank and nothing else', () => {
  const after = applyBlankEdits(DOC, [{ op: 'rename', from: 'LANDLORD', to: 'LESSOR' }]);
  assert.equal(after.filter((s) => s.type === 'blank' && s.name === 'LESSOR').length, 2);
  assert.equal(after.filter((s) => s.type === 'blank' && s.name === 'LANDLORD').length, 0);
  assert.equal(after.length, DOC.length);
});

test('a merge gives the blanks one name, and the list counts them as one', () => {
  const after = applyBlankEdits(DOC, [{ op: 'merge', blanks: ['LANDLORD ADDRESS', 'TENANT ADDRESS'], to: 'ADDRESS' }]);
  const address = blanksOf(after).find((b) => b.name === 'ADDRESS');
  assert.equal(address?.count, 2);
  assert.equal(blanksOf(after).some((b) => b.name === 'TENANT ADDRESS'), false);
});

test('"Not a blank" puts the fixed text in its place and joins the words around it', () => {
  const after = applyBlankEdits(DOC, [{ op: 'remove', blank: 'RENT', text: 'N2,000,000' }]);
  assert.equal(after.some((s) => s.type === 'blank' && s.name === 'RENT'), false);
  assert.ok(after.some((s) => s.type === 'text' && s.text === '. Rent: N2,000,000 a year, citing [2024] LPELR 1. Signed by '));
});

test('a passage made a blank becomes a blank everywhere it appears; "[2024]" stays text', () => {
  const after = applyBlankEdits(DOC, [{ op: 'add', passage: ' a year', blank: 'TERM' }]);
  assert.equal(blanksOf(after).find((b) => b.name === 'TERM')?.count, 1);
  assert.ok(after.some((s) => s.type === 'text' && s.text.includes('[2024] LPELR')));
});

test('edits apply in order: undoing is dropping the last one', () => {
  const edits = [
    { op: 'rename' as const, from: 'TENANT', to: 'LESSEE' },
    { op: 'rename' as const, from: 'LESSEE', to: 'OCCUPIER' },
  ];
  assert.equal(blanksOf(applyBlankEdits(DOC, edits)).some((b) => b.name === 'OCCUPIER'), true);
  assert.equal(blanksOf(applyBlankEdits(DOC, edits.slice(0, -1))).some((b) => b.name === 'LESSEE'), true);
});

test('each blank carries short snippets around it, three at most', () => {
  const landlord = blanksOf(DOC).find((b) => b.name === 'LANDLORD');
  assert.equal(landlord?.count, 2);
  assert.equal(landlord?.examples.length, 2);
  assert.match(landlord?.examples[0] ?? '', /^…Made between \[LANDLORD\] of …$/);
});

test('a typed blank name becomes one the server takes', () => {
  assert.equal(blankName('  rent   amount! '), 'RENT AMOUNT');
  assert.equal(blankName("tenant's name"), "TENANT'S NAME");
  assert.equal(blankName('£$%'), '');
});

test('the used line', () => {
  const now = Date.parse('2026-11-19T12:00:00Z');
  assert.equal(usedLine(null, now), 'Not used yet');
  assert.equal(usedLine('2026-11-19T08:00:00Z', now), 'Used today');
  assert.equal(usedLine('2026-11-18T08:00:00Z', now), 'Used yesterday');
  assert.equal(usedLine('2026-11-14T08:00:00Z', now), 'Used 5 days ago');
  assert.equal(usedLine('2026-09-01T08:00:00Z', now), 'Used 2 months ago');
});

test('a Space chat says the answer is shared, in the words agreed', () => {
  assert.equal(sharedAnswerLine('template'), "Everyone in this chat sees Lawexa's answer, which can include this template's wording.");
  assert.equal(sharedAnswerLine('skill'), "Everyone in this chat sees Lawexa's answer, which can follow this skill's steps.");
});

test('a short date', () => {
  assert.equal(shortDate('2026-11-19T10:00:00Z'), '19 Nov 2026');
  assert.equal(shortDate('not a date'), '');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { printedLines } from './printed-lines';

test('text without a line break is one line, unchanged', () => {
  assert.deepEqual(printedLines('A person shall not establish a securities exchange.'), [
    'A person shall not establish a securities exchange.',
  ]);
});

test('a printed form keeps its lines (Electoral Act 2026, Form TF 001)', () => {
  assert.deepEqual(printedLines('HOLDEN AT……\nPetition No……\nBetween\nA.B. ……'), [
    'HOLDEN AT……',
    'Petition No……',
    'Between',
    'A.B. ……',
  ]);
});

test("the exporter's indentation reads as a space (Electoral Act 2022, s.12)", () => {
  assert.deepEqual(printedLines('Area Council\n                    election ; and'), [
    'Area Council election ; and',
  ]);
});

test('indentation around an inline element leaves no line (Companies Code 1963)', () => {
  assert.deepEqual(printedLines('\n                        '), [' ']);
  assert.deepEqual(printedLines('Section\n                      '), ['Section ']);
});

test('a trailing break is not a line', () => {
  assert.deepEqual(printedLines('Secretary\n'), ['Secretary ']);
});

test('Windows line endings count as breaks', () => {
  assert.deepEqual(printedLines('CP = NRP * (1 + EPF)\r\nWhere'), ['CP = NRP * (1 + EPF)', 'Where']);
});

test('a blank line between printed lines gives one break, not an empty line', () => {
  assert.deepEqual(printedLines('Signed ……\n\nA.B ……'), ['Signed …… ', 'A.B ……']);
});

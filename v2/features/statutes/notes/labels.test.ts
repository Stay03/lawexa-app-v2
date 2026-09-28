import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partLabel } from './labels';

test('a section and its subdivisions read as a citation', () => {
  assert.equal(partLabel('part-iv__sec-47__subsec-1'), 's. 47(1)');
  assert.equal(partLabel('part-vii__sec-132__para-a'), 's. 132(a)');
  assert.equal(partLabel('part-i__sec-3'), 's. 3');
  assert.equal(partLabel('sec-9__subsec-2__para-b__subpara-ii'), 's. 9(2)(b)(ii)');
});

test('a form in a schedule reads as its form number', () => {
  assert.equal(partLabel('att-1__group-tf-001'), 'Form TF 001');
  assert.equal(partLabel('att-3__group-ec-3a'), 'Form EC 3A');
});

test('a schedule paragraph reads as the schedule and paragraph (Electoral Act First Schedule)', () => {
  assert.equal(partLabel('att-1__paragraph-25__subpara-2'), 'Sch. 1, para 25(2)');
  assert.equal(partLabel('att-1__paragraph-3'), 'Sch. 1, para 3');
  assert.equal(partLabel('att-1__paragraph-14__subpara-2__item-a__item-iii'), 'Sch. 1, para 14(2)(a)(iii)');
  assert.equal(partLabel('att-1__paragraph-36__item-c'), 'Sch. 1, para 36(c)');
});

test('a schedule with parts and items keeps each level', () => {
  assert.equal(partLabel('att-2__part-i__paragraph-8__item-d'), 'Sch. 2, Part I, para 8(d)');
  assert.equal(partLabel('att-1__part-iii__item-15'), 'Sch. 1, Part III, item 15');
  assert.equal(partLabel('att-4__part-i'), 'Sch. 4, Part I');
  assert.equal(partLabel('att-2__item-1'), 'Sch. 2, item 1');
});

test('a division with nothing more specific names the division', () => {
  assert.equal(partLabel('part-xiii'), 'Part XIII');
  assert.equal(partLabel('part-ix__group-ix-b'), 'Part IX');
  assert.equal(partLabel('att-1'), 'Schedule 1');
  assert.equal(partLabel('att-3__text'), 'Schedule 3');
});

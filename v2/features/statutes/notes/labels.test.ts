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

test('a part or schedule with no section names the division', () => {
  assert.equal(partLabel('part-iv'), 'Part IV');
  assert.equal(partLabel('sched-2'), 'Schedule 2');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCount, pageSummary, pagerItems, parsePageParam } from './pager-model';

test('a short range prints every page', () => {
  assert.deepEqual(pagerItems(1, 1), [1]);
  assert.deepEqual(pagerItems(2, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pagerItems(4, 7), [1, 2, 3, 4, 5, 6, 7]);
});

test('an empty list has no pager items', () => {
  assert.deepEqual(pagerItems(1, 0), []);
});

test('a long range keeps the first and last pages and hides the rest behind gaps', () => {
  assert.deepEqual(pagerItems(1, 1756), [1, 2, 3, 4, 5, 'gap-end', 1756]);
  assert.deepEqual(pagerItems(3, 1756), [1, 2, 3, 4, 5, 'gap-end', 1756]);
  assert.deepEqual(pagerItems(5, 1756), [1, 'gap-start', 4, 5, 6, 'gap-end', 1756]);
  assert.deepEqual(pagerItems(900, 1756), [1, 'gap-start', 899, 900, 901, 'gap-end', 1756]);
  assert.deepEqual(pagerItems(1754, 1756), [1, 'gap-start', 1752, 1753, 1754, 1755, 1756]);
  assert.deepEqual(pagerItems(1756, 1756), [1, 'gap-start', 1752, 1753, 1754, 1755, 1756]);
});

test('a long range is the same width wherever the reader is in it', () => {
  for (const page of [1, 2, 3, 4, 5, 6, 50, 1751, 1752, 1753, 1754, 1755, 1756]) {
    assert.equal(pagerItems(page, 1756).length, 7, `page ${page}`);
    assert.equal(pagerItems(page, 1756, 0).length, 5, `page ${page}, no siblings`);
  }
});

test('a gap never hides a single page', () => {
  assert.deepEqual(pagerItems(4, 8), [1, 2, 3, 4, 5, 'gap-end', 8]);
  assert.deepEqual(pagerItems(5, 8), [1, 'gap-start', 4, 5, 6, 7, 8]);
});

test('the narrow pager keeps only the current page between the ends', () => {
  assert.deepEqual(pagerItems(3, 1756, 0), [1, 2, 3, 'gap-end', 1756]);
  assert.deepEqual(pagerItems(900, 1756, 0), [1, 'gap-start', 900, 'gap-end', 1756]);
  assert.deepEqual(pagerItems(1756, 1756, 0), [1, 'gap-start', 1754, 1755, 1756]);
});

test('a page outside the range is clamped into it', () => {
  assert.deepEqual(pagerItems(99, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pagerItems(0, 1756), [1, 2, 3, 4, 5, 'gap-end', 1756]);
});

test('the page param reads whole numbers from 1 and falls back to page 1', () => {
  assert.equal(parsePageParam('3'), 3);
  assert.equal(parsePageParam(' 12 '), 12);
  assert.equal(parsePageParam('1756'), 1756);
  assert.equal(parsePageParam(null), 1);
  assert.equal(parsePageParam(undefined), 1);
  assert.equal(parsePageParam(''), 1);
  assert.equal(parsePageParam('0'), 1);
  assert.equal(parsePageParam('-2'), 1);
  assert.equal(parsePageParam('3.5'), 1);
  assert.equal(parsePageParam('abc'), 1);
  assert.equal(parsePageParam('2abc'), 1);
  assert.equal(parsePageParam('99999999999999999999'), 1);
});

test('counts and the page line read with thousands separators', () => {
  assert.equal(formatCount(35115), '35,115');
  assert.equal(formatCount(7), '7');
  assert.equal(pageSummary(3, 1756), 'Page 3 of 1,756');
  assert.equal(pageSummary(1, 1), 'Page 1 of 1');
});

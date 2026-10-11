import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrollCorrection } from './scroll-keep';

const safari = { atBottom: false, anchoring: false };

test('a region wholly above the viewport moves scrollTop by its whole change', () => {
  const region = { top: 100, height: 800, scrollTop: 2_000 };
  assert.equal(scrollCorrection(region, 950, safari), 150);
  assert.equal(scrollCorrection(region, 700, safari), -100);
  // Its bottom edge exactly at the viewport's top still counts as above.
  assert.equal(scrollCorrection({ top: 100, height: 800, scrollTop: 900 }, 1_000, safari), 200);
});

test('a region straddling the viewport top moves scrollTop by the share above it', () => {
  // A quarter of the region was above the top: a quarter of the change.
  assert.equal(scrollCorrection({ top: 1_000, height: 800, scrollTop: 1_200 }, 1_200, safari), 100);
});

test('a region starting at or below the viewport top needs nothing', () => {
  assert.equal(scrollCorrection({ top: 1_200, height: 800, scrollTop: 1_200 }, 1_500, safari), 0);
  assert.equal(scrollCorrection({ top: 3_000, height: 800, scrollTop: 1_200 }, 1_500, safari), 0);
});

test('a reader at the bottom is pinned back to the bottom', () => {
  const region = { top: 100, height: 800, scrollTop: 2_000 };
  assert.equal(scrollCorrection(region, 950, { atBottom: true, anchoring: false }), 'bottom');
});

test('with scroll anchoring the browser already kept the place: no correction', () => {
  const region = { top: 100, height: 800, scrollTop: 2_000 };
  assert.equal(scrollCorrection(region, 950, { atBottom: false, anchoring: true }), 0);
  assert.equal(scrollCorrection(region, 950, { atBottom: true, anchoring: true }), 0);
});

test('no height change, no correction', () => {
  assert.equal(scrollCorrection({ top: 100, height: 800, scrollTop: 2_000 }, 800, safari), 0);
});

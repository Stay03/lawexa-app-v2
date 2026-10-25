import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { centredScrollTop, visibleSpan } from './scroll-to-match';

/* The find's jump to a match sets the scroll area's scrollTop from measured
 * boxes (Arthur's iPhone, 25 October 2026: Safari did not move the draft for
 * scrollIntoView). */

// The phone sheet's text area above a keyboard: 124px tall at 281px on screen, 2,400px of draft.
const area = { top: 281, height: 124, clientHeight: 124, scrollTop: 0, scrollHeight: 2400 };

test('a match further down is brought to the middle of the area', () => {
  // A 24px match 1,000px into the draft (at 1,281 on screen while scrolled to the top).
  const next = centredScrollTop(area, { top: 1281, height: 24 });
  // Its top inside the draft is 1,000; the middle puts (124 - 24) / 2 = 50px above it.
  assert.equal(next, 950);
  // After the scroll the match sits at 281 + 50 = 331 to 355, the middle of 281-405.
  assert.equal(1281 - next, 331);
});

test('the area already scrolled: the offset counts from where it is', () => {
  const scrolled = { ...area, scrollTop: 600 };
  // The same match now shows at 1,281 - 600 = 681 on screen.
  assert.equal(centredScrollTop(scrolled, { top: 681, height: 24 }), 950);
  // A match above the visible part (on screen at 100, inside the draft at 419).
  assert.equal(centredScrollTop(scrolled, { top: 100, height: 24 }), 369);
});

test('never above the top or past the end of what can scroll', () => {
  // A match near the top cannot be centred: the area stays at 0.
  assert.equal(centredScrollTop(area, { top: 300, height: 24 }), 0);
  // A match at the very end: the area stops at scrollHeight - clientHeight = 2,276.
  assert.equal(centredScrollTop(area, { top: 281 + 2380, height: 20 }), 2276);
  // A draft shorter than its area never scrolls.
  assert.equal(centredScrollTop({ ...area, scrollHeight: 100 }, { top: 350, height: 24 }), 0);
});

test('a scroller the keyboard covers: the match goes to the middle of the part above the keyboard', () => {
  // The note page's scroller runs 56-844 on a phone and does not shrink; the keyboard's top is at 470.
  const seen = visibleSpan(56, 844, 0, 470);
  assert.deepEqual(seen, { top: 56, height: 414 });
  const page = { top: seen.top, height: seen.height, clientHeight: 788, scrollTop: 0, scrollHeight: 6000 };
  // A 20px match at 2,056 on screen (2,000 into the note) lands at 56 + (414 - 20) / 2 = 253, well above 470.
  const next = centredScrollTop(page, { top: 2056, height: 20 });
  assert.equal(next, 1803);
  assert.equal(2056 - next, 253);
  // Without a keyboard the whole box is seen, and the middle is the box's.
  assert.deepEqual(visibleSpan(56, 844, 0, 844), { top: 56, height: 788 });
  // A box off screen keeps its own extent rather than an empty one.
  assert.deepEqual(visibleSpan(900, 1000, 0, 844), { top: 900, height: 100 });
});

test('the find moves the area itself, not scrollIntoView, and never past a fixed sheet', () => {
  const here = join(process.cwd(), 'v2', 'features', 'notes', 'editor');
  const find = readFileSync(join(here, 'find-replace.ts'), 'utf8');
  assert.match(find, /if \(element instanceof HTMLElement\) scrollMatchToMiddle\(element\);/);
  assert.doesNotMatch(find, /scrollIntoView\(/);
  const helper = readFileSync(join(here, 'scroll-to-match.ts'), 'utf8');
  assert.match(helper, /if \(next !== area\.scrollTop\) area\.scrollTop = next;/);
  assert.match(helper, /if \(position === 'fixed'\) return null;/);
  assert.match(helper, /const viewport = window\.visualViewport;/);
  assert.doesNotMatch(helper.replace(/\/\*\*[\s\S]*?\*\//g, ''), /scrollIntoView/);
});

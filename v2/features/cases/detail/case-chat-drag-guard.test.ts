import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { blocksDrag, type DragScroller, type DragStep } from './case-chat-drag-guard';

/* The phone case chat's drag guard (12 October 2026). In Safari with the keyboard up,
 * a drag the chat does not use pans the visual viewport and the fixed card lags
 * behind it (Arthur's recording: the whole visible area moved up about 95 px). The
 * guard cancels a touchmove only when no scroller under the finger can move the way
 * the finger is going. The decision is pinned by behaviour; the wiring by source.
 *
 * The techlead's conditions, one group of cases each:
 *   (a) the message list scrolls both ways, with momentum, and reaches its top;
 *   (b) wide tables and code blocks in answers still scroll sideways;
 *   (c) long-press selection and the copy menu still work;
 *   (d) the composer's own text scrolls when it has more lines than fit;
 *   (e) nothing changes outside the open phone chat.
 *
 * Finger moving down is dy > 0 (it brings earlier content into view). */

const STILL = { scrollTop: 0, scrollHeight: 0, clientHeight: 0, scrollLeft: 0, scrollWidth: 0, clientWidth: 0 };

/** A vertical scroller: the message list, or the composer's box. */
const column = (scrollTop: number, scrollHeight = 2000, clientHeight = 500): DragScroller => ({
  ...STILL,
  scrollsY: true,
  scrollsX: false,
  scrollTop,
  scrollHeight,
  clientHeight,
  scrollWidth: 390,
  clientWidth: 390,
});

/** A sideways scroller: a wide table or a code block. overflow-x: auto computes
 * overflow-y to auto too, so it reads as both, with no vertical room. */
const wide = (scrollLeft: number, scrollWidth = 900, clientWidth = 350): DragScroller => ({
  ...STILL,
  scrollsY: true,
  scrollsX: true,
  scrollHeight: 200,
  clientHeight: 200,
  scrollLeft,
  scrollWidth,
  clientWidth,
});

const step = (chain: DragScroller[], dx: number, dy: number, extra: Partial<DragStep> = {}): DragStep => ({
  chain,
  dx,
  dy,
  multiTouch: false,
  selecting: false,
  ...extra,
});

test('(a) the message list scrolls up and down in its middle', () => {
  const list = column(700);
  assert.equal(blocksDrag(step([list], 0, -12)), false, 'finger up: later messages');
  assert.equal(blocksDrag(step([list], 0, 12)), false, 'finger down: earlier messages');
});

test('(a) the list reaches its top, and a drag past the top is held, not chained to the screen', () => {
  // One pixel from the top still scrolls, so the list can land on 0.
  assert.equal(blocksDrag(step([column(1)], 0, 12)), false);
  // At the top, a finger moving down has nothing to scroll: cancelled.
  assert.equal(blocksDrag(step([column(0)], 0, 12)), true);
  // At the top, a finger moving up scrolls the list as usual.
  assert.equal(blocksDrag(step([column(0)], 0, -12)), false);
});

test('(a) at the bottom, including a fractional bottom, a drag on is held and a drag back scrolls', () => {
  assert.equal(blocksDrag(step([column(1500)], 0, -12)), true);
  assert.equal(blocksDrag(step([column(1499.5)], 0, -12)), true, 'iOS reads half a pixel short at the end');
  assert.equal(blocksDrag(step([column(1500)], 0, 12)), false);
});

test('(a) a list too short to scroll, the bar and the composer frame hold every drag', () => {
  assert.equal(blocksDrag(step([column(0, 300, 500)], 0, 12)), true, 'short list');
  assert.equal(blocksDrag(step([column(0, 300, 500)], 0, -12)), true, 'short list');
  assert.equal(blocksDrag(step([], 0, -12)), true, 'no scroller under the finger');
  assert.equal(blocksDrag(step([], 8, 0)), true, 'no scroller under the finger, sideways');
});

test('(a) a nested scroller at its end hands the drag to the list around it', () => {
  // A drag on an answer inside the list: the inner box cannot move, the list can.
  assert.equal(blocksDrag(step([column(0, 300, 300), column(700)], 0, 12)), false);
  // Both at their top: held.
  assert.equal(blocksDrag(step([column(0, 600, 300), column(0)], 0, 12)), true);
});

test('(b) a wide table or code block scrolls sideways both ways, and holds at its ends', () => {
  assert.equal(blocksDrag(step([wide(200), column(700)], -15, 2)), false, 'finger left: more columns');
  assert.equal(blocksDrag(step([wide(200), column(700)], 15, 2)), false, 'finger right: back');
  // At the left edge a finger moving right has nothing to scroll sideways: held.
  assert.equal(blocksDrag(step([wide(0), column(700)], 15, 2)), true);
  // At the right edge (fractional too) a finger moving left is held.
  assert.equal(blocksDrag(step([wide(550), column(700)], -15, 2)), true);
  assert.equal(blocksDrag(step([wide(549.5), column(700)], -15, 2)), true);
  // A right-to-left box counts its offset down from 0, and still scrolls.
  assert.equal(blocksDrag(step([wide(-200), column(700)], 15, 2)), false);
});

test('(b) a mostly vertical drag over a table scrolls the list around it', () => {
  // The table has no vertical room; the list does.
  assert.equal(blocksDrag(step([wide(0), column(700)], 3, -14)), false);
  assert.equal(blocksDrag(step([wide(0), column(0)], 3, 14)), true, 'list at its top');
  // A vertical-only scroller never takes a sideways drag.
  assert.equal(blocksDrag(step([column(700)], -15, 2)), true);
});

test('(c) a long-press selection and its handles are never held', () => {
  // Wherever the finger is and whatever it would scroll.
  assert.equal(blocksDrag(step([], 0, 12, { selecting: true })), false);
  assert.equal(blocksDrag(step([column(0)], 0, 12, { selecting: true })), false);
  assert.equal(blocksDrag(step([wide(0)], 15, 0, { selecting: true })), false);
});

test('(c) a still finger and a pinch are never held', () => {
  assert.equal(blocksDrag(step([], 0, 0)), false);
  assert.equal(blocksDrag(step([], 10, 10, { multiTouch: true })), false);
});

test("(d) the composer's own text scrolls when it has more lines than fit", () => {
  // Six lines in a box that shows four, scrolled to its last line: the box is the
  // innermost scroller.
  const box = column(48, 160, 112);
  assert.equal(blocksDrag(step([box], 0, 10)), false, 'back to the first lines');
  assert.equal(blocksDrag(step([box], 0, -10)), true, 'already at the last line');
  assert.equal(blocksDrag(step([column(0, 160, 112)], 0, -10)), false, 'on to the last lines');
  // A box whose text fits holds the drag: nothing under it scrolls.
  assert.equal(blocksDrag(step([column(0, 44, 44)], 0, -10)), true);
});

/* The wiring, by source. */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');
const guard = strip(read('v2', 'features', 'cases', 'detail', 'case-chat-drag-guard.ts'));
const ask = strip(read('v2', 'features', 'cases', 'detail', 'CaseAsk.tsx'));

test('(e) the guard is on the card only while the phone chat is open, and comes off on close', () => {
  assert.match(
    ask,
    /useEffect\(\(\) => \{\s*const card = cardRef\.current;\s*if \(!screenOpen \|\| !card\) return;\s*return guardChatDrags\(card\);\s*\}, \[screenOpen\]\);/,
  );
  // Open on a phone only: `screen` is CaseScreen's phone test.
  assert.match(ask, /const screenOpen = screen && panelOpen;/);
  assert.equal(ask.match(/guardChatDrags\(/g)?.length, 1);
  // Listeners on the card, never on the window or the document.
  assert.doesNotMatch(guard, /(window|document)\.addEventListener/);
  assert.match(guard, /card\.addEventListener\('touchmove', onTouchMove, \{ passive: false \}\);/);
  assert.match(guard, /card\.removeEventListener\('touchmove', onTouchMove\);/);
  assert.equal(guard.match(/addEventListener\(/g)?.length, guard.match(/removeEventListener\(/g)?.length);
});

test('(c) touchstart is passive and never cancelled; only a cancelable touchmove the decision blocks is', () => {
  assert.match(guard, /card\.addEventListener\('touchstart', onTouchStart, \{ passive: true \}\);/);
  const start = guard.slice(guard.indexOf('const onTouchStart'), guard.indexOf('const onTouchMove'));
  assert.doesNotMatch(start, /preventDefault/);
  assert.equal(guard.match(/preventDefault\(\)/g)?.length, 1);
  assert.match(guard, /if \(!event\.cancelable\) return;/);
  assert.match(guard, /if \(block\) event\.preventDefault\(\);/);
  // The selection read is a non-collapsed selection inside the card.
  assert.match(guard, /!selection\.isCollapsed && selection\.anchorNode && card\.contains\(selection\.anchorNode\)/);
  assert.match(guard, /multiTouch: event\.touches\.length > 1,/);
});

test('the chain is every auto or scroll box from the touched element up to the card', () => {
  assert.match(guard, /const SCROLLING = new Set\(\['auto', 'scroll'\]\);/);
  assert.match(guard, /while \(element && card\.contains\(element\)\)/);
  assert.match(guard, /const scrollsY = SCROLLING\.has\(style\.overflowY\);\s*const scrollsX = SCROLLING\.has\(style\.overflowX\);/);
});

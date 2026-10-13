import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readsAtBottom } from './scroll-pin';

// Spaces F4 review S2: a chat stayed away from its newest message after the
// page under it grew (the dock's height on open, the composer growing a line).
// The rule is pure and tested here; the list's wiring cannot render under
// node:test, so its parts are pinned in the source.
const here = dirname(fileURLToPath(import.meta.url));
const list = readFileSync(join(here, 'MessageList.tsx'), 'utf8');
const screen = readFileSync(join(here, 'ConversationScreen.tsx'), 'utf8');

const T = 80;
// A 1000 px page in a 400 px view: the bottom is scrollTop 600.
const at = (scrollTop: number, scrollHeight = 1000) => ({ scrollTop, scrollHeight, clientHeight: 400 });

test('within the threshold the view is at the bottom, whoever moved it', () => {
  assert.equal(readsAtBottom(at(600), null, false, T), true);
  assert.equal(readsAtBottom(at(530), 100, false, T), true);
});

test('growth under a view the list put at the bottom keeps it pinned', () => {
  // The landing wrote 600; the dock's measured height then added 120 px below.
  assert.equal(readsAtBottom(at(600, 1120), 600, true, T), true);
});

test('a reader who scrolled away is detached, even mid-follow', () => {
  assert.equal(readsAtBottom(at(400, 1120), 600, true, T), false);
});

test('the list scrolling a detached reader to keep their place leaves them detached', () => {
  // A block swap's fix while scrolled up is the list's own write.
  assert.equal(readsAtBottom(at(300), 300, false, T), false);
});

test('with no write of its own yet, distance alone decides', () => {
  assert.equal(readsAtBottom(at(400), null, true, T), false);
});

test('every scrollTop write in the list goes through scrollOwn', () => {
  const writes = list.match(/\.scrollTop (?:=|\+=)(?!=)/g) ?? [];
  assert.equal(writes.length, 1, 'one write, inside scrollOwn');
  assert.match(list, /function scrollOwn\(el: HTMLDivElement, ownTop: RefObject<number \| null>, top: number\) \{\s*el\.scrollTop = top;\s*ownTop\.current = el\.scrollTop;\s*\}/);
});

test('the scroll handler reads the pin through readsAtBottom', () => {
  assert.match(list, /const atBottom = readsAtBottom\(el, ownScrollTopRef\.current, atBottomRef\.current, BOTTOM_THRESHOLD_PX\);/);
  // The pill's jump stays a smooth scroll; it re-attaches by distance at its end.
  assert.match(list, /el\.scrollTo\(\{ top: el\.scrollHeight, behavior: 'smooth' \}\)/);
});

test('the follower watches the border box, where the dock height lands', () => {
  assert.match(list, /observer\.observe\(content, \{ box: 'border-box' \}\);/);
  // The dock's height reaches the list only as this bottom padding.
  assert.match(list, /pb-\[calc\(var\(--v2-conv-dock-h,7rem\)\+1rem\)\]/);
  assert.match(screen, /observer\.observe\(dock\)/);
});

test('an empty dock keeps the fallback padding instead of measuring 0', () => {
  // On a cold open the dock holds nothing for the skeleton hold; measured, it
  // read 0 and the page later grew by the composer's height under a landed view.
  assert.match(
    screen,
    /const height = dock\.offsetHeight;[\s\S]*?if \(height === 0\) screen\.style\.removeProperty\('--v2-conv-dock-h'\);\s*else screen\.style\.setProperty\('--v2-conv-dock-h', `\$\{height\}px`\);/,
  );
});

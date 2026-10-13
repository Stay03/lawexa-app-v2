import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { clampedToBottom, followOnResize, readsAtBottom } from './scroll-pin';

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

// The measured cold open (Chromium, iPhone 14 profile, production build of
// bc733ae): a 788 px view landed at 531 on a 1319 px page; the first frame drew
// the estimated rows at their real height, the page fell to 952 and the
// browser clamped the view to 164; the dock's height then grew it to 1070.
const view = (scrollTop: number, scrollHeight: number) => ({ scrollTop, scrollHeight, clientHeight: 788 });

test('a pinned view the browser clamps keeps its pin, and the growth after it snaps', () => {
  const clamped = followOnResize(view(164, 952), 531, true, T);
  assert.deepEqual(clamped, { ownTop: 164, snapTo: null, ease: false });
  // The clamp's scroll event finds the view where the list now says it put it.
  assert.equal(readsAtBottom(view(164, 1070), clamped.ownTop, true, T, 531), true);
  // The dock's 118 px: past the threshold, a snap before paint.
  assert.deepEqual(followOnResize(view(164, 1070), clamped.ownTop, true, T), { ownTop: 164, snapTo: 282, ease: false });
  // Small growth glides; none at all does nothing.
  assert.deepEqual(followOnResize(view(282, 1100), 282, true, T), { ownTop: 282, snapTo: null, ease: true });
  assert.deepEqual(followOnResize(view(282, 1070), 282, true, T), { ownTop: 282, snapTo: null, ease: false });
});

test('a clamp with no input never detaches a pinned view', () => {
  // Without the observer's adoption the clamp read as a scroll away; with it, not.
  assert.equal(readsAtBottom(view(164, 1070), 531, true, T, 531), false, 'the old rule detached');
  const { ownTop } = followOnResize(view(164, 952), 531, true, T);
  assert.equal(readsAtBottom(view(164, 1070), ownTop, true, T, 531), true);
});

test('a detached reader a shrink clamps to the bottom stays detached, with no snap', () => {
  // Scrolled up to 500 on a long page; the page shrinks and clamps them to 164.
  assert.deepEqual(followOnResize(view(164, 952), 300, false, T), { ownTop: 300, snapTo: null, ease: false });
  assert.equal(clampedToBottom(view(164, 952), 500), true);
  assert.equal(readsAtBottom(view(164, 952), 300, false, T, 500), false);
  // Their own scroll down to the bottom still re-attaches them.
  assert.equal(clampedToBottom(view(164, 952), 100), false);
  assert.equal(readsAtBottom(view(164, 952), 300, false, T, 100), true);
});

test('a fraction of a pixel short of the bottom still counts as the bottom', () => {
  // A 3x or 2.625x screen can leave the clamped view at bottom - 0.5 (163.5 here).
  const clamped = followOnResize(view(163.5, 952), 531, true, T);
  assert.deepEqual(clamped, { ownTop: 163.5, snapTo: null, ease: false });
  assert.equal(readsAtBottom(view(163.5, 1070), clamped.ownTop, true, T, 531), true);
  assert.deepEqual(followOnResize(view(163.5, 1070), 163.5, true, T), { ownTop: 163.5, snapTo: 282, ease: false });
  // The list's own position read back as a fraction: kept, no glide for half a pixel.
  assert.deepEqual(followOnResize(view(281.5, 1070), 281.5, true, T), { ownTop: 281.5, snapTo: null, ease: false });
  // A detached reader clamped to bottom - 0.5 is still a clamp, and stays detached.
  assert.equal(clampedToBottom(view(163.5, 952), 500), true);
  assert.equal(readsAtBottom(view(163.5, 952), 300, false, T, 500), false);
});

test('a pinned view the reader moved is left to the reader', () => {
  // Not at the bottom and not where the list put it: the reader's event decides.
  assert.deepEqual(followOnResize(view(100, 1070), 282, true, T), { ownTop: 282, snapTo: null, ease: false });
});

test('the observer follows through followOnResize, its snap through scrollOwn', () => {
  assert.match(
    list,
    /const next = followOnResize\(el, ownScrollTopRef\.current, atBottomRef\.current, BOTTOM_THRESHOLD_PX\);\s*ownScrollTopRef\.current = next\.ownTop;\s*if \(next\.snapTo !== null\) \{\s*scrollOwn\(el, ownScrollTopRef, next\.snapTo\);\s*return;\s*\}\s*if \(next\.ease && followRafRef\.current == null\) \{/,
  );
});

test('the scroll handler reads the pin through readsAtBottom', () => {
  assert.match(
    list,
    /const atBottom = readsAtBottom\(\s*el,\s*ownScrollTopRef\.current,\s*atBottomRef\.current,\s*BOTTOM_THRESHOLD_PX,\s*lastScrollTopRef\.current,\s*\);\s*lastScrollTopRef\.current = el\.scrollTop;/,
  );
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

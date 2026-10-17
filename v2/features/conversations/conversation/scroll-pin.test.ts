import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { clampedToBottom, followOnResize, nearBottom, readsAtBottom } from './scroll-pin';

// Spaces F4 review S2: a chat stayed away from its newest message after the
// page under it grew (the dock's height on open, the composer growing a line).
// The rule is pure and tested here; the list's wiring cannot render under
// node:test, so its parts are pinned in the source.
const here = dirname(fileURLToPath(import.meta.url));
const list = readFileSync(join(here, 'MessageList.tsx'), 'utf8');
const screen = readFileSync(join(here, 'ConversationScreen.tsx'), 'utf8');
// The chat's message box, and the measure of its height, moved to the shell's
// dock (message box B, 17 October 2026).
const dockBox = readFileSync(join(here, 'ChatDock.tsx'), 'utf8');

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

test('a pinned view away from the list\'s own position is still followed', () => {
  // A reader's nudge of 22 px, under the threshold, leaves the view pinned at 240
  // while the list last wrote 262; growth under it must still be followed (the
  // release re-review found the follow dropped here).
  assert.deepEqual(followOnResize(view(240, 1070), 262, true, T), { ownTop: 262, snapTo: null, ease: true });
  // The pill's smooth scroll landing short because the page grew during it.
  assert.deepEqual(followOnResize(view(190, 1070), 150, true, T), { ownTop: 150, snapTo: 282, ease: false });
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

test('the pill re-attaches a reader already at the bottom, where a scroll fires no event', () => {
  // A detached reader a shrink clamped to the bottom: scrollTo moves nothing.
  assert.match(
    list,
    /if \(nearBottom\(el\)\) \{\s*atBottomRef\.current = true;\s*ownScrollTopRef\.current = el\.scrollTop;\s*lastScrollTopRef\.current = el\.scrollTop;\s*if \(detachedAt !== null\) onScrolledUpChange\?\.\(false\);\s*setDetachedAt\(null\);\s*return;\s*\}\s*\/\/[^\n]*\n\s*el\.scrollTo\(/,
  );
  assert.equal(nearBottom(view(163.5, 952)), true);
  assert.equal(nearBottom(view(160, 952)), false);
});

test('the follower watches the border box, where the dock height lands', () => {
  assert.match(list, /observer\.observe\(content, \{ box: 'border-box' \}\);/);
  // The dock's height reaches the list only as this bottom padding.
  assert.match(list, /pb-\[calc\(var\(--v2-conv-dock-h,7rem\)\+1rem\)\]/);
  assert.match(dockBox, /observer\.observe\(dock\)/);
});

test('an empty dock keeps the fallback padding, whatever its safe-area padding measures', () => {
  // On a cold open the dock holds nothing for the skeleton hold. It is tested by
  // its children, not its height: in the iPhone home-screen app its safe-area
  // padding alone measures 34 px, so a height of 0 never came (release re-review).
  assert.match(
    dockBox,
    /if \(dock\.childElementCount === 0\) \{\s*if \(root\.style\.getPropertyValue\(DOCK_HEIGHT_VAR\) !== ''\) root\.style\.removeProperty\(DOCK_HEIGHT_VAR\);\s*return;\s*\}\s*const height = `\$\{dock\.offsetHeight\}px`;/,
  );
  assert.doesNotMatch(dockBox, /offsetHeight === 0/);
  // The dock carries that padding, which is why its height is not the test.
  assert.match(dockBox, /ref=\{dockRef\} className="pointer-events-auto v2-safe-bottom/);
});

test('the dock height is written only when it changes, and a reopen renders the last one', () => {
  // Chat reopen fix, 16 October 2026: writing the variable after the mount
  // restyled the whole transcript (760 elements). It lives on the root element
  // now, written by the shell's box (message box B), and stays there when the
  // box goes, so the next chat's transcript is styled once with the height the
  // box last had.
  assert.match(dockBox, /const DOCK_HEIGHT_VAR = '--v2-conv-dock-h';/);
  assert.match(dockBox, /const root = document\.documentElement;/);
  assert.match(dockBox, /if \(root\.style\.getPropertyValue\(DOCK_HEIGHT_VAR\) !== height\) root\.style\.setProperty\(DOCK_HEIGHT_VAR, height\);/);
  assert.doesNotMatch(dockBox, /useEffect\(\(\) => \(\) => document\.documentElement\.style\.removeProperty/);
  // Before paint, after MessageList's landing read.
  assert.match(dockBox, /useIsomorphicLayoutEffect\(\(\) => \{\s*const dock = dockRef\.current;/);
  assert.match(dockBox, /return \(\) => observer\.disconnect\(\);\s*\}, \[\]\);/);
  // The screen writes no height of its own; under an external composer it pins 0px.
  assert.match(screen, /const NO_DOCK_CLEARANCE = \{ \[DOCK_HEIGHT_VAR\]: '0px' \} as CSSProperties;/);
  assert.match(screen, /style=\{externalComposer \? NO_DOCK_CLEARANCE : undefined\}/);
  assert.doesNotMatch(screen, /setProperty\(DOCK_HEIGHT_VAR/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guard for the sheet cut (10 October 2026). A chat tapped in the side drawer
// closed the drawer in the click: the click task rendered the whole drawer and
// Radix measured its exit, so the chat's frame came 155-218 ms after the tap
// against 60-100 ms from the list, and the closing sheet covered it. Painting
// cannot run under node:test; the film is in the commit.
// 22 October 2026: the drawer no longer takes the cut (it arms a close in the
// tap and slides away over the frame, drawer-close.test.ts); the mechanism
// stays for the case preview's popover and hover card, and is pinned here.
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8');
const moveFirst = read('move-first.tsx');
const css = read('shell.css');
const drawer = read('V2Drawer.tsx');

test('the tap hides the sheet before the frame commits, and only when the link has a sheet to close', () => {
  const tapBody = moveFirst.slice(moveFirst.indexOf('const navigate: Navigate = '));
  const cut = tapBody.indexOf("if (onMove) document.documentElement.setAttribute(SHEET_CUT_ATTR, '');");
  const raise = tapBody.indexOf('raise(href, kind, title, region, restore);');
  assert.ok(cut > 0 && raise > cut, 'attribute set before the flush that paints the frame');
  assert.match(moveFirst, /const SHEET_CUT_ATTR = 'data-v2-sheet-cut';/);
});

test('the sheet closes in the task after the paint, synchronously, then the attribute goes', () => {
  assert.match(moveFirst, /flushSync\(onMove\);\s*document\.documentElement\.removeAttribute\(SHEET_CUT_ATTR\);/);
  const afterPaint = moveFirst.slice(moveFirst.indexOf('const navigateAfterPaint = '), moveFirst.indexOf('const onPopState = '));
  const raf = afterPaint.indexOf('requestAnimationFrame(() => {');
  const task = afterPaint.indexOf('window.setTimeout(() => {', raf);
  const route = afterPaint.indexOf('router.replace(href);', task);
  const settle = afterPaint.indexOf('settle?.();', route);
  assert.ok(raf > 0 && task > raf && route > task && settle > route, 'close after the frame and after the route is asked for');
  // The close runs whatever became of the tap: it sits outside the tap check.
  const check = afterPaint.indexOf('if (tapRef.current === tap) {');
  const closeBrace = afterPaint.lastIndexOf('}', settle);
  assert.ok(check > 0 && closeBrace > check, 'settle after the tap block closes');
});

test('on the current page or without the provider the sheet closes at once, as before', () => {
  assert.match(moveFirst, /if \(!navigate \|\| pathOf\(href\) === pathname\) \{\s*onMove\?\.\(\);\s*return;\s*\}/);
  assert.match(moveFirst, /if \(!region\) \{\s*onMove\?\.\(\);\s*router\.push\(href\);\s*return;\s*\}/);
});

test('a v2 rule hides every sheet while the attribute is set', () => {
  // A case citation's popover or hover card goes the same way (a case opens at once, 17 October 2026).
  assert.match(css, /html\.v2-document-lock\[data-v2-sheet-cut\] \[data-slot='sheet-overlay'\],\s*html\.v2-document-lock\[data-v2-sheet-cut\] \[data-slot='sheet-content'\],\s*html\.v2-document-lock\[data-v2-sheet-cut\] \[data-slot='popover-content'\],\s*html\.v2-document-lock\[data-v2-sheet-cut\] \[data-slot='hover-card-content'\] \{\s*display: none;\s*\}/);
});

test('the drawer\'s chat rows take no cut: the tap arms a close and the drawer is seen leaving', () => {
  const recentRow = drawer.slice(drawer.indexOf('recents.map((conversation)'), drawer.indexOf('</MoveFirstLink>'));
  assert.doesNotMatch(recentRow, /onMove=/);
  assert.match(recentRow, /onClick=\{\(\) => closeFor\(`\/c\/\$\{conversation\.id\}`\)\}/);
  assert.doesNotMatch(drawer, /onMove=/);
});

test('the case preview still takes the cut, so its popover goes in the frame it is tapped in', () => {
  const preview = read('..', 'features', 'conversations', 'conversation', 'markdown', 'CasePreview.tsx');
  assert.equal((preview.match(/onMove=\{onOpen\}/g) ?? []).length, 2);
  const mention = read('..', 'features', 'conversations', 'conversation', 'markdown', 'CaseMentionLink.tsx');
  // The chat rating's "cited case opened" moment rides the same link (onClick).
  assert.match(mention, /<MoveFirstLink href=\{casePath\} kind="case" onClick=\{onOpen\} onMove=\{\(\) => setOpen\(false\)\}/);
});

test('the library behaviour the cut relies on is still there', () => {
  // Radix Presence unmounts with no animation when the element reads display: none.
  const presence = readFileSync(join(root, 'node_modules', '@radix-ui', 'react-presence', 'dist', 'index.mjs'), 'utf8');
  assert.match(presence, /styles\?\.display === "none"/);
  // FocusScope ignores a blur with no related target (the hidden row losing focus).
  const focusScope = readFileSync(join(root, 'node_modules', '@radix-ui', 'react-focus-scope', 'dist', 'index.mjs'), 'utf8');
  assert.match(focusScope, /if \(relatedTarget === null\) return;/);
  // The scroll reset on sheet open (document-lock.tsx) fires only on an open.
  assert.match(read('document-lock.tsx'), /record\.oldValue === null/);
});

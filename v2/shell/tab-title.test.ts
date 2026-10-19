import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { bareTitle, heldTitle, restoredTitle, tabTitleText } from './tab-title';

/* A page whose subject is per-user data names itself in the browser tab once
 * the data has loaded (Tester Claude, 19 October 2026: a note's tab read
 * "Note | Lawexa"). The server title stays generic: it is what a crawler and
 * the first paint get. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('set: the screen’s name in the root template, nothing without a name', () => {
  assert.equal(tabTitleText('Hearing notes'), 'Hearing notes | Lawexa');
  assert.equal(tabTitleText('  Hearing notes  '), 'Hearing notes | Lawexa');
  assert.equal(tabTitleText(''), null);
  assert.equal(tabTitleText(null), null);
  // Next's generic title is replaced; a title already right is not written again.
  assert.equal(heldTitle('Folder | Lawexa', 'Hearing notes | Lawexa'), 'Hearing notes | Lawexa');
  assert.equal(heldTitle('Hearing notes | Lawexa', 'Hearing notes | Lawexa'), 'Hearing notes | Lawexa');
});

test('rename: a new name replaces the old one, and the mention count stays in front', () => {
  assert.equal(heldTitle('Old name | Lawexa', 'New name | Lawexa'), 'New name | Lawexa');
  // app-badge's "(3) " is kept, so the two writers agree and stop.
  assert.equal(heldTitle('(3) Folder | Lawexa', 'Hearing notes | Lawexa'), '(3) Hearing notes | Lawexa');
  assert.equal(heldTitle('(3) Hearing notes | Lawexa', 'Hearing notes | Lawexa'), '(3) Hearing notes | Lawexa');
  assert.equal(bareTitle('(12) Saved | Lawexa'), 'Saved | Lawexa');
});

test('restore: leaving puts back the title found, never over the next page’s own', () => {
  assert.equal(restoredTitle('Hearing notes | Lawexa', 'Hearing notes | Lawexa', 'Folder | Lawexa'), 'Folder | Lawexa');
  // The mention count of the moment survives the restore.
  assert.equal(restoredTitle('(2) Hearing notes | Lawexa', 'Hearing notes | Lawexa', 'Folder | Lawexa'), '(2) Folder | Lawexa');
  // A title written after this screen's (the next page's) is left alone.
  assert.equal(restoredTitle('Saved | Lawexa', 'Hearing notes | Lawexa', 'Folder | Lawexa'), 'Saved | Lawexa');
});

test('the hook holds the title only on its own address, and only while mounted', () => {
  const hook = read('v2', 'shell', 'use-tab-title.ts');
  assert.match(hook, /const hold = \(\) => \{\s*if \(window\.location\.pathname !== path\) return;/);
  assert.match(hook, /observer\.observe\(document\.head, \{ childList: true, subtree: true, characterData: true \}\);/);
  assert.match(hook, /return \(\) => \{\s*observer\.disconnect\(\);\s*if \(window\.location\.pathname !== path\) return;/);
  assert.match(hook, /\}, \[text\]\);/);
});

test('each per-user page names itself in the tab', () => {
  const screens: Array<[string[], RegExp]> = [
    [['v2', 'features', 'notes', 'reader', 'NoteScreen.tsx'], /useTabTitle\(note \? noteDisplayTitle\(note\.title\) : null\);/],
    [['v2', 'features', 'notes', 'editor', 'EditNoteScreen.tsx'], /useTabTitle\(envelope\?\.data \? `Edit \$\{noteDisplayTitle\(envelope\.data\.title\)\}` : null\);/],
    [['v2', 'features', 'folders', 'detail', 'FolderScreen.tsx'], /useTabTitle\(headerRow\?\.name\);/],
    [['v2', 'features', 'radars', 'detail', 'RadarScreen.tsx'], /useTabTitle\(headerTitle\);/],
    [['v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx'], /useTabTitle\(space\?\.name\);/],
    // A channel's `name` is a slug; the shown name comes from channelDisplayName.
    [['v2', 'features', 'channels', 'screen', 'ChannelScreen.tsx'], /useTabTitle\(channel \? channelDisplayName\(channel\) : null\);/],
  ];
  for (const [path, pattern] of screens) assert.match(read(...path), pattern, path.join('/'));
});

test('app-badge writes no title while the page has none, so it never leaves a stray one', () => {
  const badge = read('v2', 'runtime', 'realtime', 'app-badge.ts');
  assert.match(badge, /function syncTitle\(\): void \{[\s\S]*?if \(!document\.querySelector\('title'\)\) return;\s*const next = desiredTitle\(\);/);
});

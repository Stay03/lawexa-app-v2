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

test('a name with a line break reads back as written, so the watch on <head> settles (live freeze, 23 October 2026)', () => {
  // `document.title` reads back with its whitespace collapsed and trimmed. A
  // stand-in with the same getter, and the hook's own compare-then-write.
  let stored = '';
  const doc = {
    get title() {
      return stored.replace(/[\t\n\f\r ]+/g, ' ').trim();
    },
    set title(value: string) {
      stored = value;
    },
  };
  const text = tabTitleText('LAND RIGHTS CLASS 1 (T -1) : NATURE AND SCOPE OF LAND RIGHTS\nLECTURER: DIEKOLOLA DANIELS LLB. BL.');
  assert.equal(text, 'LAND RIGHTS CLASS 1 (T -1) : NATURE AND SCOPE OF LAND RIGHTS LECTURER: DIEKOLOLA DANIELS LLB. BL. | Lawexa');
  let writes = 0;
  const hold = () => {
    const next = heldTitle(doc.title, text ?? '');
    if (doc.title !== next) {
      doc.title = next;
      writes += 1;
    }
  };
  // Each write is a <head> mutation, which runs `hold` again: it must stop.
  for (let pass = 0; pass < 5; pass += 1) hold();
  assert.equal(writes, 1);
  // With the app badge's "(1) " in front (a signed-in reader with a mention), too.
  stored = '(1) Note | Lawexa';
  writes = 0;
  for (let pass = 0; pass < 5; pass += 1) hold();
  assert.equal(writes, 1);
  assert.equal(doc.title, `(1) ${text}`);
  // Tabs and repeated spaces collapse the same way; a no-break space is not whitespace to the browser and stays.
  assert.equal(tabTitleText('A\t\tB  C'), 'A B C | Lawexa');
  assert.equal(tabTitleText('A B'), 'A B | Lawexa');
});

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
  // A new note's first save moves the address under the mounted editor
  // (replaceState): the hold restarts on the new address.
  assert.match(hook, /const routePath = usePathname\(\);/);
  assert.match(hook, /\}, \[text, routePath\]\);/);
});

test('each per-user page names itself in the tab', () => {
  const screens: Array<[string[], RegExp]> = [
    [['v2', 'features', 'notes', 'reader', 'NoteScreen.tsx'], /useTabTitle\(note \? noteDisplayTitle\(note\.title\) : null\);/],
    // The editor names itself from the SAVED note, so a new note follows its first save.
    [['v2', 'features', 'notes', 'editor', 'NoteEditorScreen.tsx'], /useTabTitle\(record \? `Edit \$\{noteDisplayTitle\(record\.title\)\}` : null\);/],
    [['v2', 'features', 'folders', 'detail', 'FolderScreen.tsx'], /useTabTitle\(headerRow\?\.name\);/],
    [['v2', 'features', 'radars', 'detail', 'RadarScreen.tsx'], /useTabTitle\(headerTitle\);/],
    [['v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx'], /useTabTitle\(space\?\.name\);/],
    // A channel's `name` is a slug; the shown name comes from channelDisplayName.
    [['v2', 'features', 'channels', 'screen', 'ChannelScreen.tsx'], /useTabTitle\(channel \? channelDisplayName\(channel\) : null\);/],
  ];
  for (const [path, pattern] of screens) assert.match(read(...path), pattern, path.join('/'));
  // One writer for the editor's tab: the edit page leaves it to the editor.
  assert.doesNotMatch(read('v2', 'features', 'notes', 'editor', 'EditNoteScreen.tsx'), /useTabTitle/);
});

test('app-badge writes no title while the page has none, so it never leaves a stray one', () => {
  const badge = read('v2', 'runtime', 'realtime', 'app-badge.ts');
  assert.match(badge, /function syncTitle\(\): void \{[\s\S]*?if \(!document\.querySelector\('title'\)\) return;\s*const next = desiredTitle\(\);/);
});

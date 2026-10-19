import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* A page whose subject is per-user data names itself in the browser tab once
 * the data has loaded (Tester Claude, 19 October 2026: a note's tab read
 * "Note | Lawexa"). The server title stays generic: it is what a crawler and
 * the first paint get. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('TabTitle renders one string <title> with the root template, and nothing without a name', () => {
  const tab = read('v2', 'shell', 'TabTitle.tsx');
  assert.match(tab, /const text = name\?\.trim\(\);\s*if \(!text\) return null;\s*return <title>\{`\$\{text\} \| Lawexa`\}<\/title>;/);
});

test('each per-user page names itself in the tab', () => {
  const screens: Array<[string[], RegExp]> = [
    [['v2', 'features', 'notes', 'reader', 'NoteScreen.tsx'], /<TabTitle name=\{noteDisplayTitle\(note\.title\)\} \/>/],
    [['v2', 'features', 'notes', 'editor', 'EditNoteScreen.tsx'], /<TabTitle name=\{`Edit \$\{noteDisplayTitle\(record\.title\)\}`\} \/>/],
    [['v2', 'features', 'folders', 'detail', 'FolderScreen.tsx'], /<TabTitle name=\{headerRow\?\.name\} \/>/],
    [['v2', 'features', 'radars', 'detail', 'RadarScreen.tsx'], /<TabTitle name=\{radar\.name\} \/>/],
    [['v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx'], /<TabTitle name=\{space\.name\} \/>/],
    // A channel's `name` is a slug; the shown name comes from channelDisplayName.
    [['v2', 'features', 'channels', 'screen', 'ChannelScreen.tsx'], /<TabTitle name=\{displayName\} \/>/],
  ];
  for (const [path, pattern] of screens) assert.match(read(...path), pattern, path.join('/'));
});

test('app-badge writes no title while the page has none, so it never leaves a stray one', () => {
  const badge = read('v2', 'runtime', 'realtime', 'app-badge.ts');
  assert.match(badge, /function syncTitle\(\): void \{[\s\S]*?if \(!document\.querySelector\('title'\)\) return;\s*const next = desiredTitle\(\);/);
});

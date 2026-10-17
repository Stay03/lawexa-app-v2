import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearHeaderContext, setHeaderContext, snapshotHeaderContext } from '@/v2/shell/header-context';
import { folderPeekFor, rememberFolderPeek } from './folder-peek';

/* Speed step 5, folders (17 October 2026): a tapped row's tile and name draw
 * at once, and on a phone the bar carries the name before the folder answers. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the tap keeps the row\'s tile and name, for that folder only, one entry', () => {
  rememberFolderPeek({ uuid: 'f-1', name: 'Tenancy', hasName: true, tint: '#3366ff' });
  assert.deepEqual(folderPeekFor('f-1'), { uuid: 'f-1', name: 'Tenancy', hasName: true, tint: '#3366ff' });
  assert.equal(folderPeekFor('f-2'), null);
  assert.equal(folderPeekFor(undefined), null);
  rememberFolderPeek({ uuid: 'f-2', name: 'Untitled folder', hasName: false, tint: null });
  assert.equal(folderPeekFor('f-1'), null);
  assert.equal(folderPeekFor('f-2')?.hasName, false);
});

test('the row leaves its facts on the tap, and both waits draw the tile and, from md:, the name', () => {
  assert.match(read('list', 'FolderRow.tsx'), /<Link href=\{row\.href\} onClick=\{\(\) => rememberFolderPeek\(row\)\}/);
  const fallback = read('detail', 'FolderDetailFallback.tsx');
  assert.match(fallback, /const peek = useFolderPeek\(uuidOf\(usePathname\(\)\)\);/);
  assert.match(fallback, /tile=\{peek \? <FolderTile tint=\{peek\.tint\} size="header" \/> : undefined\}/);
  assert.match(fallback, /'hidden text-xl font-semibold tracking-tight md:block'/);
  assert.doesNotMatch(fallback, /from '\.\/FolderScreen'/);
  assert.match(read('detail', 'FolderScreen.tsx'), /if \(folderQuery\.isPending\) return <FolderDetailFallback \/>;/);
});

test('on a phone the bar shows the tapped row\'s name before the folder answers', () => {
  const screen = read('detail', 'FolderScreen.tsx');
  assert.match(screen, /const headerTitle = headerRow\?\.name \?\? peek\?\.name \?\? null;/);
  // The page's own clear on unmount still runs, so no name is left behind.
  assert.match(screen, /useEffect\(\(\) => \(\) => clearHeaderContext\(\), \[\]\);/);
});

test('the wait itself puts the name in the bar, under its own name, before the screen\'s code arrives', () => {
  const fallback = read('detail', 'FolderDetailFallback.tsx');
  assert.match(fallback, /setHeaderContext\(\{ title: peek\.name, confidential: false \}, FALLBACK_PUBLISHER\);/);
  assert.match(fallback, /return \(\) => clearHeaderContext\(FALLBACK_PUBLISHER\);/);
  assert.match(fallback, /export const FALLBACK_PUBLISHER = 'folder-detail-fallback';/);
  // The screen publishes with no name of its own, which is what lets the
  // wait's clear leave the screen's title alone (next test).
  assert.match(read('detail', 'FolderScreen.tsx'), /setHeaderContext\(\{ title: headerTitle, confidential: false \}\);/);
});

test('the hand-off: the wait goes and the screen\'s title stays', () => {
  const publisher = 'folder-detail-fallback';
  setHeaderContext({ title: 'Tenancy', confidential: false }, publisher);
  assert.equal(snapshotHeaderContext().context.title, 'Tenancy');
  // The screen mounts and publishes; the wait is deleted and clears.
  setHeaderContext({ title: 'Tenancy', confidential: false });
  clearHeaderContext(publisher);
  assert.equal(snapshotHeaderContext().context.title, 'Tenancy');
  // A wait left alone (the tap went nowhere) takes its own title with it.
  setHeaderContext({ title: 'Lease', confidential: false }, publisher);
  clearHeaderContext(publisher);
  assert.equal(snapshotHeaderContext().context.title, null);
});

test('the tile and the name do not fade when the folder arrives under them', () => {
  assert.match(read('detail', 'FolderScreen.tsx'), /arrival === 'peeked'\s*\? 'v2-folder-arrive-peeked'/);
  assert.match(
    read('detail', 'folder-arrive.css'),
    /\.v2-folder-arrive-peeked > :not\(header\),\s*\.v2-folder-arrive-peeked > header > div > :not\(h1\)/,
  );
});

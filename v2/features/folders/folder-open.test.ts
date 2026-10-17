import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

test('the tile and the name do not fade when the folder arrives under them', () => {
  assert.match(read('detail', 'FolderScreen.tsx'), /arrival === 'peeked'\s*\? 'v2-folder-arrive-peeked'/);
  assert.match(
    read('detail', 'folder-arrive.css'),
    /\.v2-folder-arrive-peeked > :not\(header\),\s*\.v2-folder-arrive-peeked > header > div > :not\(h1\)/,
  );
});

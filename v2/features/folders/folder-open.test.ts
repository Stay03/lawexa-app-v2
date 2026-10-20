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

test('the tap keeps the row\'s name, for that folder only, one entry', () => {
  rememberFolderPeek({ uuid: 'f-1', name: 'Tenancy', hasName: true });
  assert.deepEqual(folderPeekFor('f-1'), { uuid: 'f-1', name: 'Tenancy', hasName: true });
  assert.equal(folderPeekFor('f-2'), null);
  assert.equal(folderPeekFor(undefined), null);
  rememberFolderPeek({ uuid: 'f-2', name: 'Untitled folder', hasName: false });
  assert.equal(folderPeekFor('f-1'), null);
  assert.equal(folderPeekFor('f-2')?.hasName, false);
});

test('the row leaves its facts on the tap, and both waits draw the name at every width', () => {
  assert.match(read('list', 'FolderRow.tsx'), /<Link href=\{row\.href\} onClick=\{\(\) => rememberFolderPeek\(row\)\}/);
  const fallback = read('detail', 'FolderDetailFallback.tsx');
  assert.match(fallback, /const peek = useFolderPeek\(uuidOf\(usePathname\(\)\)\);/);
  // Folder page B (20 October 2026): the header has no tile, so neither has the wait.
  assert.doesNotMatch(fallback, /FolderTile|tile=/);
  // Item 7 (Arthur, 17 October 2026): the name is the page's heading on a
  // phone too, so the wait draws it there, in the live heading's type.
  assert.match(fallback, /'line-clamp-2 break-words',\s*FOLDER_HEADING_TYPE,/);
  assert.doesNotMatch(fallback, /hidden text-xl|md:block/);
  assert.doesNotMatch(fallback, /from '\.\/FolderScreen'/);
  assert.match(read('detail', 'FolderScreen.tsx'), /if \(folderQuery\.isPending\) return <FolderDetailFallback \/>;/);
});

test('the folder’s name is the page heading at every width, and the bar stays empty while it shows', () => {
  const screen = read('detail', 'FolderScreen.tsx');
  assert.match(screen, /const headingRef = useScrolledTitle\(headerRow\?\.name \?\? null\);/);
  assert.match(screen, /<h1\s+ref=\{headingRef\}/);
  assert.match(screen, /'line-clamp-2 min-w-0 flex-1 break-words',\s*FOLDER_HEADING_TYPE,/);
  assert.doesNotMatch(screen, /sr-only md:not-sr-only/);
  // Neither the wait nor the screen puts the name in the bar on arrival.
  assert.doesNotMatch(read('detail', 'FolderDetailFallback.tsx'), /setHeaderContext/);
  assert.doesNotMatch(screen, /setHeaderContext|clearHeaderContext/);
  // The bar's slot for a folder never shimmers.
  const pushed = read('..', '..', 'shell', 'pushed-route.ts');
  assert.match(pushed, /backLabel: 'Back to folders',\s*title: SCROLLED_TITLE,/);
  assert.doesNotMatch(pushed, /kind: 'published'/);
  assert.match(read('..', '..', 'shell', 'V2Header.tsx'), /expectsContext=\{false\}/);
});

test('the bar shows the name once the heading scrolls away, and takes it back on return', () => {
  const hook = read('detail', 'use-scrolled-title.ts');
  assert.match(hook, /const \[onScreen, setOnScreen\] = useState\(true\);/);
  assert.match(hook, /new IntersectionObserver\(\(\[entry\]\) => setOnScreen\(entry\.isIntersecting\), \{\s*root: document\.getElementById\(V2_SHELL_CONTENT_ID\),/);
  assert.match(
    hook,
    /if \(title !== null && !onScreen\) setHeaderContext\(\{ title, confidential: false \}, FOLDER_TITLE_PUBLISHER\);\s*else clearHeaderContext\(FOLDER_TITLE_PUBLISHER\);/,
  );
  assert.match(hook, /useEffect\(\(\) => \(\) => clearHeaderContext\(FOLDER_TITLE_PUBLISHER\), \[\]\);/);
});

test('the folder’s clear is owned: a title another screen published since stays', () => {
  const publisher = 'folder-screen';
  setHeaderContext({ title: 'Tenancy', confidential: false }, publisher);
  assert.equal(snapshotHeaderContext().context.title, 'Tenancy');
  // A chat tapped from the folder publishes its own title; the folder then
  // unmounts and clears under its own name, which leaves the chat's alone.
  setHeaderContext({ title: 'Lease question', confidential: false }, 'conversation-1');
  clearHeaderContext(publisher);
  assert.equal(snapshotHeaderContext().context.title, 'Lease question');
  clearHeaderContext('conversation-1');
  // A folder left alone takes its own title with it.
  setHeaderContext({ title: 'Lease', confidential: false }, publisher);
  clearHeaderContext(publisher);
  assert.equal(snapshotHeaderContext().context.title, null);
});

test('the name does not fade when the folder arrives under it', () => {
  assert.match(read('detail', 'FolderScreen.tsx'), /arrival === 'peeked'\s*\? 'v2-folder-arrive-peeked'/);
  assert.match(
    read('detail', 'folder-arrive.css'),
    /\.v2-folder-arrive-peeked > :not\(header\),\s*\.v2-folder-arrive-peeked > header > :not\(h1\)/,
  );
});

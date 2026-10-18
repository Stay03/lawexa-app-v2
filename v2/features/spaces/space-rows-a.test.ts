import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Version A of the space's list (Stay, 17 October 2026, 22:19 UTC) and
 * Arthur's iOS items of the same night: 1 (one members count), 2 (no message
 * box on Folders or People), 5 (a folder's time on its name line), 6 (rename
 * and "Change space" on a folder in a space). */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const rows = () => read('v2', 'features', 'spaces', 'detail', 'content', 'feed-rows.tsx');

test('every kind is one row: a plain icon, the name and time, one fact under them', () => {
  const source = rows();
  assert.match(source, /<Icon\s+aria-hidden\s+className=\{cn\(\s*'size-5 shrink-0',/);
  // The time sits on the name line for every kind, a folder's too (item 5).
  assert.match(
    source,
    /\{line\.title\}\s*<\/span>\s*\{line\.time \? \(\s*<span className="shrink-0 text-xs tabular-nums text-muted-foreground">\{line\.time\}<\/span>/,
  );
  assert.match(source, /meta: folderCountsLabel\(row\.itemsCount, row\.childrenCount\),\s*time: formatRelativeTime\(row\.trailAt, now\),/);
  // No tile behind any icon.
  assert.doesNotMatch(source, /FolderTile|FileMark|rounded-lg bg-secondary/);
});

test('a folder in a space: rename for its owner, and the move reads "Change space" (item 6)', () => {
  assert.match(rows(), /moveLabel="Change space"/);
  const menu = read('v2', 'features', 'folders', 'FolderActionsMenu.tsx');
  assert.match(menu, /moveLabel = 'Move to space',/);
  assert.match(menu, /<Boxes \/>\s*\{moveLabel\}/);
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(panel, /intent=\{\{ mode: 'rename', folder: \{ uuid: renaming\.uuid, name: renaming\.name \} \}\}/);
  // A rename or delete shows in the space's list at once: the space reads are
  // marked stale with the folder reads.
  const mutations = read('v2', 'features', 'folders', 'folder-mutations.ts');
  assert.equal(
    mutations.match(/invalidates: \[foldersQueries\.lists\(\), foldersQueries\.details\(\), spacesQueries\.all\],/g)?.length,
    2,
  );
});

test('a muted room reads quiet, and its @you count stays in the right column', () => {
  const source = rows();
  assert.match(source, /quiet: grammar\.muted,/);
  assert.match(source, /quiet: state === 'none' \|\| grammar\.muted \|\| knownThreadStatus\(thread\.status\)\?\.value === 'closed',/);
});

test('the People tab has no count line of its own (item 1)', () => {
  const people = read('v2', 'features', 'spaces', 'detail', 'people', 'SpacePeoplePanel.tsx');
  assert.match(people, /<div className="flex flex-wrap items-center justify-end gap-3">/);
  assert.doesNotMatch(people, /CountLabel/);
});

test('the skeleton is the feed row, so the list lands without moving', () => {
  const states = read('v2', 'features', 'spaces', 'detail', 'content', 'states.tsx');
  assert.match(states, /<Skeleton className="size-5 shrink-0 rounded" \/>/);
  assert.match(states, /<span aria-hidden className="size-9 shrink-0" \/>/);
  assert.doesNotMatch(states, /ConversationsListSkeleton/);
});

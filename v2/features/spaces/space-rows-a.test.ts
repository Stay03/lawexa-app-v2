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
  // The time ends the name line for every kind, a folder's too (item 5).
  assert.match(
    source,
    /\{line\.time \? \(\s*<span className="ml-auto shrink-0 pl-1 text-xs tabular-nums text-muted-foreground">\{line\.time\}<\/span>/,
  );
  assert.match(source, /meta: folderCountsLabel\(row\.itemsCount, row\.childrenCount\),\s*time: formatRelativeTime\(row\.trailAt, now\),/);
  // No tile behind any icon.
  assert.doesNotMatch(source, /FolderTile|FileMark|rounded-lg bg-secondary/);
});

test('a folder in a space: its page ⋮ holds what its row did (item 6; Stay, 18 October 2026)', () => {
  const page = read('v2', 'features', 'folders', 'detail', 'FolderScreen.tsx');
  // Rename and Delete for the folder's creator only; the move reads "Change
  // space" for a folder in a space; Remove from space for the space's Owner.
  assert.match(page, /const ownerActions: ScreenAction\[\] = owned\s*\?/);
  assert.match(page, /label: folder\.space \? 'Change space' : 'Move to space',/);
  assert.match(page, /folder\.space && ownsSpace\s*\?\s*\[\s*\{\s*id: 'remove-from-space',/);
  assert.match(page, /const ownsSpace = spaceDetail !== null && canRemoveFromSpace\(spaceDetail\);/);
  assert.match(page, /const deleteAction: ScreenAction\[\] = owned\s*\?/);
  assert.match(page, /<RemoveFromSpaceDialog\s+key=\{`remove-\$\{removing\.key\}`\}/);
  // The row has no menu any more.
  assert.doesNotMatch(rows(), /FolderActionsMenu/);
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { foldersBulkActions } from './folders-bulk-model';

/* Bulk select on the Folders page and inside a folder (Arthur, 20 October
 * 2026, part 1): tick rows, act on them together, with actions that fit what
 * is ticked, a select-all for the current list, and a count before a delete or
 * a removal. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the Folders page offers the actions that fit what is ticked', () => {
  assert.deepEqual(foldersBulkActions({ folders: 3, files: 0 }), ['move', 'space', 'make_private', 'make_public', 'delete']);
  assert.deepEqual(foldersBulkActions({ folders: 0, files: 2 }), ['add_to_folder', 'space', 'delete']);
  assert.deepEqual(foldersBulkActions({ folders: 1, files: 1 }), ['space', 'delete']);
  assert.deepEqual(foldersBulkActions({ folders: 0, files: 0 }), ['space', 'delete']);
});

test('the Folders page sends one bulk request per kind, and a delete asks first with the count', () => {
  const bulk = read('folders-bulk.tsx');
  assert.match(bulk, /bulkApi\.folders\(tickedFolders, \{ action: 'delete' \}\)/);
  assert.match(bulk, /bulkApi\.files\(tickedFiles, \{ action: 'delete' \}\)/);
  assert.match(bulk, /title=\{`Delete \$\{countOf\(select\.count, NOUN\)\}\?`\}/);
  // A move offers the top level and refuses a ticked folder as its own destination.
  assert.match(bulk, /topLevel\s+excluded=\{new Set\(tickedFolders\)\}/);
  assert.match(bulk, /action: 'move', parentId: to\?\.uuid \?\? null/);
  // The rows tick instead of opening while selecting; the files' ids come from the section's own query.
  const page = read('FoldersBrowser.tsx');
  assert.match(page, /useInfiniteQuery\(\{ \.\.\.foldersQueries\.looseFiles\(\{ viewerId \}\), enabled: signedIn && !activeSearch \}\)/);
  assert.match(page, /onToggleSelect=\{selecting \? toggleFolder : undefined\}/);
});

test('inside a folder, its items are taken out (asked first) or added to another folder; nothing is deleted', () => {
  const bulk = read('..', 'detail', 'folder-items-bulk.tsx');
  assert.match(bulk, /bulkApi\.folderItems\(folderUuid, ticked, 'remove'\)/);
  assert.match(bulk, /bulkApi\.folderItems\(to\.uuid, ticked, 'add'\)/);
  assert.match(bulk, /title=\{`Remove \$\{countOf\(select\.count, NOUN\)\} from this folder\?`\}/);
  assert.doesNotMatch(bulk, /action: 'delete'|Delete/);
  // Only those who may take items out get "Select".
  assert.match(read('..', 'detail', 'FolderScreen.tsx'), /\{canManageItems && itemRows\.length > 0 && !selecting\s*\? bulk\.startButton\(/);
});

test('a ticked row is its own tick box, and the menu steps aside', () => {
  const row = read('..', 'file-list', 'FileListRow.tsx');
  assert.match(row, /<label className=\{cn\(FILE_LIST_OPEN_CLASS, 'cursor-pointer'\)\}>\s*<Checkbox/);
  assert.match(row, /\{select \? \(\s*<span aria-hidden className="size-9 shrink-0" \/>/);
});

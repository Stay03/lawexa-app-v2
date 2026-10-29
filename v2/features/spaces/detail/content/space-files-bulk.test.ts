import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { spaceFileIdOf, spaceFilesBulkActions, spaceItemsOf, spaceRowKeyOf } from './space-files-bulk-model';

/* Bulk select on a Space's Files tab (Arthur, 20 October 2026, part 3): tick
 * the tab's files and act on them together, with actions that fit the
 * reader's role, a select-all for the tab, and a count before a removal or a
 * delete. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('every member may copy; the Owner may remove; delete follows the ticked files', () => {
  // The Owner: every file is theirs to remove and delete.
  assert.deepEqual(spaceFilesBulkActions({ ticked: 3, deletable: 3, canRemove: true, mayDelete: true }), ['copy_to_mine', 'remove', 'delete']);
  // An Editor with one of their own files ticked among others.
  assert.deepEqual(spaceFilesBulkActions({ ticked: 3, deletable: 1, canRemove: false, mayDelete: true }), ['copy_to_mine', 'delete']);
  // An Editor with only other people's files ticked: nothing to delete.
  assert.deepEqual(spaceFilesBulkActions({ ticked: 2, deletable: 0, canRemove: false, mayDelete: true }), ['copy_to_mine']);
  // A Viewer.
  assert.deepEqual(spaceFilesBulkActions({ ticked: 2, deletable: 0, canRemove: false, mayDelete: false }), ['copy_to_mine']);
  // Nothing ticked: what the role could do, off.
  assert.deepEqual(spaceFilesBulkActions({ ticked: 0, deletable: 0, canRemove: false, mayDelete: true }), ['copy_to_mine', 'delete']);
  assert.deepEqual(spaceFilesBulkActions({ ticked: 0, deletable: 0, canRemove: false, mayDelete: false }), ['copy_to_mine']);
});

test("a result's file id is read off the {type, id} the server echoes", () => {
  assert.equal(spaceFileIdOf({ type: 'file', id: 41 }), 41);
  assert.equal(spaceFileIdOf({ type: 'file', id: '41' }), 41);
  assert.equal(spaceFileIdOf(41), null);
  assert.equal(spaceFileIdOf({ type: 'file', id: 'x' }), null);
});

test("the Owner's ticked folders and files go out as the {type, id} the server names", () => {
  assert.deepEqual(spaceItemsOf(['folder:f-1', 'file:41']), [
    { type: 'folder', id: 'f-1' },
    { type: 'file', id: 41 },
  ]);
  assert.equal(spaceRowKeyOf({ type: 'folder', id: 'f-1' }), 'folder:f-1');
  assert.equal(spaceRowKeyOf({ type: 'file', id: '41' }), 'file:41');
  assert.equal(spaceRowKeyOf({ type: 'file', id: 'x' }), null);
  assert.equal(spaceRowKeyOf('f-1'), null);
});

test('each action is one bulk request; remove and delete ask first with the count', () => {
  const bulk = read('space-files-bulk.tsx');
  assert.match(bulk, /bulkApi\.spaceFiles\(space\.uuid, ticked, 'copy_to_mine'\)/);
  // Remove takes the ticked folders and files out together (the Owner's).
  assert.match(bulk, /bulkApi\.spaceItemsOut\(space\.uuid, spaceItemsOf\(tickedKeys\)\)/);
  assert.match(
    read('..', '..', '..', 'bulk', 'api.ts'),
    /post\('\/bulk\/space-items', \{ action: 'remove', space, items: batch \}\)/,
  );
  // Copy and Delete are files only: off while only folders are ticked.
  assert.match(bulk, /const filesOff = ticked\.length === 0 \|\| busy;/);
  assert.match(bulk, /bulkApi\.spaceFiles\(space\.uuid, ticked, 'delete'\)/);
  assert.match(bulk, /title=\{`Remove \$\{countOf\(select\.count, removeNoun\)\} from this space\?`\}/);
  assert.match(bulk, /title=\{`Delete \$\{countOf\(deletable \|\| ticked\.length, NOUN\)\}\?`\}/);
  assert.match(
    read('..', '..', '..', 'bulk', 'api.ts'),
    /post\('\/bulk\/space-items', \{ action, space, items: batch\.map\(\(id\) => \(\{ type: 'file', id \}\)\) \}\)/,
  );
});

test('only the Folders pill ticks: its files, and its folders for the Owner', () => {
  const panel = read('SpaceContentPanel.tsx');
  // The old Files pill's Select moved to the Folders pill (Stay, 22 October
  // 2026: "only folder tab"), over the same read the list shows.
  assert.match(panel, /const selecting = bulk\.selecting && tab === 'folders';/);
  assert.match(panel, /\.\.\.spacesQueries\.looseFiles\(space\.uuid, \{ viewerId \}\),\s*enabled: enabled && tab === 'folders',/);
  assert.match(panel, /const canSelect = files\.length \+ folderUuids\.length > 0;/);
  // Why a Space's folder had no tick (Arthur, 29 October 2026, 07:05Z): the
  // pill drew its folders with no selection. The Owner's folders tick now.
  assert.match(panel, /tab === 'folders' && canRemove && feedPages/);
  assert.match(panel, /const bulk = useSpaceFilesBulk\(\{ space, folders: folderUuids, files, canRemove, viewerId \}\);/);
  assert.match(panel, /onToggleSelect=\{ticks\.selecting && ticks\.folders \? ticks\.toggleFolder : undefined\}\s*onStartSelect=\{!ticks\.selecting && ticks\.folders \? ticks\.startWithFolder : undefined\}\s*selecting=\{ticks\.selecting\}/);
  assert.match(panel, /<FileListHead dateLabel=\{FOLDERS_DATE_LABEL\} selectAll=\{ticks\.head\} \/>/);
  assert.match(panel, /onStartSelect=\{ticks\.selecting \? undefined : ticks\.startWithFile\}/);
  // The head's tick, before ticking, starts select mode with every row ticked.
  assert.match(read('space-files-bulk.tsx'), /onToggle: select\.active \? select\.toggleAll : select\.startAll,/);
  // Its bar leaves select-all to the head from `sm:` up.
  assert.match(read('space-files-bulk.tsx'), /noun=\{folders\.length > 0 \? ITEM_NOUN : NOUN\}\s*selectAllInHead/);
  assert.match(panel, /<SpaceLooseFiles[\s\S]{0,240}?fileSelect=\{fileSelect\}/);
  const loose = read('SpaceLooseFiles.tsx');
  assert.match(loose, /\? \{ checked: fileSelect\.isSelected\(file\.id\), onToggle: \(\) => fileSelect\.toggle\(file\.id\) \}/);
  assert.match(panel, /const changeTab = \(next: SpaceTab\) => \{\s*\/\/ [^\n]*\n\s*bulk\.stop\(\);/);
  assert.match(panel, /<div className=\{selecting \? 'hidden' : 'contents'\}>\s*<SpaceChatDock/);
  const rows = read('feed-rows.tsx');
  assert.match(rows, /select \? \(\s*<label[\s\S]*?<Checkbox[\s\S]*?onCheckedChange=\{\(\) => select\.toggle\(file\.id\)\}/);
});

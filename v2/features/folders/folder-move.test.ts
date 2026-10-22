import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MoveHalfDoneError } from './item-mutations';
import { pickerDescription } from './picker/picker-model';

/* Moving a file between folders (Stay, 22 October 2026: "Moving a file
 * between folders should work too"): a file's row menu in a folder offers
 * "Move to folder"; the picker (on the space's folders in a space folder)
 * files it into the chosen folder, then takes it out of this one, the order
 * backend set the same day (POST /folders/{new}/items first, then DELETE
 * /folders/{old}/items: a failed second half leaves it in both and loses
 * nothing). */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the move is the add, then the removal; a destination that already holds it is the add done', () => {
  const mutations = read('item-mutations.ts');
  const move = mutations.slice(mutations.indexOf('export function useMoveFolderItem('));
  const add = move.indexOf('await foldersApi.addItem(toFolderUuid, { type, id: contentId });');
  const remove = move.indexOf('return await foldersApi.removeItem(folderUuid, { type, id: contentId });');
  assert.ok(add > -1 && remove > add, 'POST to the new folder first, then DELETE from the old');
  assert.match(move, /catch \(error\) \{\s*if \(!isAlreadyInFolder\(error\)\) throw error;\s*\}/);
  assert.match(move, /catch \(error\) \{\s*throw new MoveHalfDoneError\(error\);\s*\}/);
  // The same lane as every other write to the item's membership, and the same
  // caches re-asked (the space's contents among them).
  assert.match(move, /scope: \{ id: folderItemScopeId\(target\) \},\s*meta: \{ silentError, invalidates: FOLDER_ITEM_INVALIDATES \},/);
  // Optimistic as the removal: the row leaves, both counts move, a failure puts all three back.
  assert.match(move, /const removal = removeItemFromFolderLists\(queryClient, folderUuid, type, contentId\);\s*const left = writeFolderItemCount\(queryClient, folderUuid, -1\);\s*const entered = writeFolderItemCount\(queryClient, toFolderUuid, 1\);/);
  assert.match(move, /onError: \(error, _variables, context\) => \{\s*context\?\.rollback\(\);/);
  // Half done: the destination really changed, so the caches re-ask now.
  assert.match(move, /if \(error instanceof MoveHalfDoneError\) \{\s*for \(const queryKey of FOLDER_ITEM_INVALIDATES\)/);
  // A move in flight keeps its row off the folder page, as a removal does.
  assert.match(mutations, /const FOLDER_ITEM_LEAVE_KEY = \['folders', 'item'\] as const;/);
  assert.match(mutations, /const MOVE_FOLDER_ITEM_MUTATION_KEY = \['folders', 'item', 'move'\] as const;/);
  assert.match(mutations, /filters: \{ mutationKey: FOLDER_ITEM_LEAVE_KEY, status: 'pending' \},/);

  const half = new MoveHalfDoneError(new Error('Item not found in folder.'));
  assert.equal(half.message, 'It was added to the folder, but could not be taken out of the one it was in.');
  assert.equal((half.reason as Error).message, 'Item not found in folder.');
});

test('the picker moves when told what the file leaves, and says so', () => {
  assert.equal(
    pickerDescription('file', { from: { name: 'Pleadings' } }),
    'Pick the folder this file moves to. It leaves “Pleadings”.',
  );
  const picker = read('picker', 'FolderPicker.tsx');
  assert.match(picker, /from\?: \{ uuid: string; name: string \};/);
  // The folder being left is marked as holding it from the start, and again after a close.
  assert.match(picker, /useState<ReadonlySet<string>>\(\(\) => heldAtStart\(from\)\);/);
  assert.match(picker, /setKnownHeld\(heldAtStart\(from\)\);/);
  // Pressing it moves nothing: out of its only folder would be nowhere.
  assert.match(picker, /if \(folder\.uuid === from\.uuid\) \{\s*setNotice\(`Already in \$\{folder\.name\}`\);\s*return;\s*\}/);
  assert.match(picker, /move\.mutate\(\s*\{ \.\.\.target, folderUuid: from\.uuid, toFolderUuid: folder\.uuid \},/);
  assert.match(picker, /onSuccess: \(\) => \{\s*changeOpen\(false\);\s*confirmMoved\(folder, from\);\s*\}/);
  assert.match(picker, /onError: \(error\) => setInlineError\(moveRefusal\(error, folder, from\)\)/);
  // "Moved to", with the same move back as its Undo; the undo is not silent.
  assert.match(picker, /toast\.success\(`Moved to “\$\{folder\.name\}”`, \{/);
  assert.match(picker, /undoMove\.mutate\(\{ \.\.\.target, folderUuid: folder\.uuid, toFolderUuid: left\.uuid \}\)/);
  assert.match(picker, /const move = useMoveFolderItem\(target, \{ silentError: true \}\);\s*const undoMove = useMoveFolderItem\(target\);/);
  assert.match(picker, /const writing = add\.isPending \|\| create\.isPending \|\| move\.isPending;/);
  // A half-done move names both folders in place.
  assert.match(picker, /It’s in “\$\{to\.name\}” now, but couldn’t be taken out of “\$\{from\.name\}”\./);
  // The add path is untouched: no `from`, the same add and the same toast.
  assert.match(picker, /onSuccess: \(response\) => \{\s*changeOpen\(false\);\s*confirmAdded\(folder, filedContentId\(response, target\.contentId\)\);/);
});

test('a folder made during a move takes the file, then the old folder lets go', () => {
  const create = read('picker', 'create-and-add.ts');
  assert.match(create, /from\?: \{ uuid: string; name: string \};/);
  assert.match(create, /if \(from\) \{\s*try \{\s*await foldersApi\.removeItem\(from\.uuid, \{ type: target\.type, id: target\.contentId \}\);/);
  assert.match(create, /status: 'added-not-moved',/);
  const picker = read('picker', 'FolderPicker.tsx');
  assert.match(picker, /if \(from\) confirmMoved\(result\.folder, from\);\s*else confirmAdded\(result\.folder, result\.contentId\);/);
  assert.match(picker, /if \(result\.status === 'added-not-moved'\) \{[\s\S]*?toast\.error\(/);
});

test("a file's row offers Move to folder, and the folder page opens the picker on its own list", () => {
  const row = read('detail', 'FolderItemRow.tsx');
  assert.match(row, /onMoveToFolder\?: \(row: FolderItemRowModel\) => void;/);
  // Files only: the other kinds sit in as many folders as they are added to.
  assert.match(row, /\{row\.type === 'file' && onMoveToFolder \? \(\s*<DropdownMenuItem onSelect=\{\(\) => onMoveToFolder\(row\)\}>\s*<FolderInput \/>\s*Move to folder/);
  // Above "Remove from this folder", which stays.
  assert.ok(row.indexOf('Move to folder') < row.indexOf('Remove from this folder'));
  const screen = read('detail', 'FolderScreen.tsx');
  assert.match(screen, /<FolderItemRow[\s\S]*?canRemove=\{canManageItems\}\s*onMoveToFolder=\{openMoveToFolder\}/);
  assert.match(screen, /const openMoveToFolder = useCallback\(/);
  assert.match(
    screen,
    /<FolderPicker\s+key=\{`move-to-folder-\$\{moveToFolder\.key\}`\}\s+target=\{moveToFolder\.target\}\s+title="Move to folder"\s+\/\/ [^\n]*\n\s*space=\{space \?\? undefined\}\s+from=\{\{ uuid: folder\.uuid, name: row\.name \}\}/,
  );
});

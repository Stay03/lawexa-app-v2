import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { filedContentId } from './filed-content';

/* A note filed into a space folder is filed as the space's COPY (Stay, 18
 * October 2026, 23:02 UTC). The picker's Undo must remove the copy, by the id
 * the add's 201 names; removing the pressed note's id would 404 and leave the
 * copy filed. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('a note filed into a space folder: Undo gets the copy’s id from the 201', () => {
  const response = {
    success: true,
    message: 'Item added to folder successfully',
    data: { content: { id: 9123, slug: 'contract-notes-copy' } },
  };
  // The pressed note is 412; the space's copy is 9123.
  assert.equal(filedContentId(response, 412), 9123);
});

test('a personal folder: the 201 names the content itself, so the id is unchanged', () => {
  const response = { success: true, message: 'Item added to folder successfully', data: { content: { id: 412 } } };
  assert.equal(filedContentId(response, 412), 412);
});

test('a 201 without the content falls back to the pressed id', () => {
  assert.equal(filedContentId({ success: true, message: 'ok' }, 412), 412);
  assert.equal(filedContentId({ success: true, message: 'ok', data: {} }, 412), 412);
  assert.equal(filedContentId(undefined, 412), 412);
});

test('the picker’s Undo removes what the add filed, on both ways in', () => {
  const picker = read('picker', 'FolderPicker.tsx');
  // `PickerFolder` since the picker can browse a space's folders (22 October 2026).
  assert.match(picker, /const confirmAdded = \(folder: PickerFolder, filedId: number\) => \{/);
  assert.match(picker, /undoAdd\.mutate\(\{\s*type: target\.type,\s*contentId: filedId,/);
  assert.doesNotMatch(picker, /contentId: target\.contentId/);
  // Pressing a folder in the list.
  assert.match(picker, /onSuccess: \(response\) => \{\s*changeOpen\(false\);\s*confirmAdded\(folder, filedContentId\(response, target\.contentId\)\);/);
  // Creating a folder and adding in one go.
  assert.match(picker, /confirmAdded\(result\.folder, result\.contentId\);/);
  const create = read('picker', 'create-and-add.ts');
  assert.match(create, /return \{ status: 'added', folder, contentId: filedContentId\(added, target\.contentId\) \};/);
  // The wire layer hands the 201 through.
  const api = read('api.ts');
  assert.match(api, /addItem: async \(uuid: string, data: FolderItemInput\): Promise<FolderItemAddResponse> =>/);
});

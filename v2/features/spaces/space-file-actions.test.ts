import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { canDeleteSpaceFile, spaceFileRefusal } from './content-model';

/* A space's files belong to the space (Stay, 15 October 2026). A member keeps
 * one by saving a copy to their own files; the Owner deletes any file, a
 * Contributor what they uploaded (backend's contract the same day). */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('who may delete a space file: the Owner any, a Contributor their own, a Viewer none', () => {
  assert.equal(canDeleteSpaceFile({ my_content_role: 'owner' }, 9, 2), true);
  assert.equal(canDeleteSpaceFile({ my_content_role: 'editor' }, 2, 2), true);
  assert.equal(canDeleteSpaceFile({ my_content_role: 'editor' }, 9, 2), false);
  assert.equal(canDeleteSpaceFile({ my_content_role: 'viewer' }, 2, 2), false);
  assert.equal(canDeleteSpaceFile({ my_content_role: null }, 2, 2), false);
  assert.equal(canDeleteSpaceFile({ my_content_role: 'editor' }, 2, null), false);
});

test('a refused copy or delete says why', () => {
  assert.equal(spaceFileRefusal('delete', 403, 'You cannot delete this file.'), 'You cannot delete this file.');
  assert.equal(spaceFileRefusal('copy', 404, 'File not found in this space.'), 'This file is no longer in the space.');
  assert.equal(spaceFileRefusal('copy', 500, null), 'Couldn’t save a copy. Please try again.');
  assert.equal(spaceFileRefusal('delete', 0, null), 'Couldn’t delete the file. Please try again.');
});

test('the calls, the menu rows and the delete confirm', () => {
  const api = read('lib', 'api', 'collab.ts');
  assert.match(api, /apiClient\.post<ApiResponse<UserFile>>\(\s*`\/spaces\/\$\{spaceUuid\}\/files\/\$\{fileId\}\/copy-to-mine`\s*\)/);
  assert.match(api, /await apiClient\.delete\(`\/spaces\/\$\{spaceUuid\}\/files\/\$\{fileId\}`\);/);
  const row = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceFileRow.tsx');
  assert.match(row, /<DropdownMenuItem onSelect=\{\(\) => onCopyToMine\(file\)\}>\s*<Copy \/>\s*Save a copy to my files/);
  assert.match(row, /<DropdownMenuItem variant="destructive" onSelect=\{\(\) => onDelete\(file\)\}>\s*<Trash2 \/>\s*Delete file/);
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  // Every member may copy; delete only where the role allows.
  assert.match(panel, /onCopyToMine=\{copyFile\}/);
  assert.match(panel, /canDeleteSpaceFile\(\{ my_content_role: access\.contentRole \}, file\.uploader\.id, viewerId\)\s*\?\s*deleteFile\s*:\s*undefined/);
  const dialog = read('v2', 'features', 'spaces', 'detail', 'content', 'DeleteSpaceFileDialog.tsx');
  assert.match(dialog, /It is deleted from \$\{spaceName\} for every member\. A copy anyone saved to their own files stays\./);
  assert.match(dialog, /variant="destructive"/);
  // A file the Owner takes out goes to the Owner's own files now.
  const remove = read('v2', 'features', 'spaces', 'detail', 'content', 'RemoveFromSpaceDialog.tsx');
  assert.match(remove, /so it moves to your own files\./);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { visibleNavItems } from '@/v2/shell/nav.config';

/* v2 Stage 1, item 4 (Stay, 19 October 2026, 16:33 UTC: "Build 6 Push 4"): a
 * file filed in a folder opens on tap. The menu gets no Files row: the Folders
 * page becomes the top level for files instead (picture 6). */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

const libraryLeaves = (role: Parameters<typeof visibleNavItems>[0]['role']) =>
  visibleNavItems({ role, canAccessTeamChannels: false })
    .find((item) => item.label === 'Library')
    ?.items?.map((leaf) => `${leaf.label} ${leaf.href}`);

test('the Library group has no Files row, for anyone', () => {
  for (const role of ['user', 'researcher', 'admin', 'guest', 'bot', null] as const) {
    assert.deepEqual(libraryLeaves(role), ['Cases /cases', 'Statutes /statutes', 'Notes /notes', 'Folders /folders'], String(role));
  }
});

test('a file in a folder is a button that opens it with a fresh link, and says why when it cannot', () => {
  const row = read('detail', 'FolderItemRow.tsx');
  assert.match(row, /\{row\.type === 'file' \? \(\s*<FileOpenRow fileId=\{row\.contentId\}>\{identity\}<\/FileOpenRow>/);
  assert.match(row, /const \{ open, opening, failed, gone \} = useOpenFileInNewTab\(\);/);
  assert.match(row, /<button\s+type="button"\s+onClick=\{\(\) => open\(fileId\)\}/);
  assert.match(row, /This file is no longer available\./);
  assert.match(row, /Couldn&rsquo;t open it\.[\s\S]*?Try again/);
  // Still never a link to the payload's presigned URL, which expires.
  assert.doesNotMatch(read('item-row-model.ts'), /href: content\.url/);
});

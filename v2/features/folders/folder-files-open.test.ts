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
  assert.match(row, /if \(row\.type === 'file'\) \{\s*return \(\s*<FileEntryRow\s+fileId=\{row\.contentId\}/);
  // The open is its own file, shared with the Folders page's loose files (build 6).
  assert.match(row, /import \{ FileEntryRow \} from '\.\.\/file-list\/FileEntryRow';/);
  const open = read('file-list', 'FileEntryRow.tsx');
  // A link that SHOWS a PDF or a picture in the tab (Tester, 20:51Z: the PDF
  // downloaded into a blank tab); a Download control keeps the plain link.
  assert.match(open, /const \{ open, opening, failed, gone \} = useShowFileInNewTab\(\);/);
  const urls = readFileSync(join(here, '..', 'channels', 'feed', 'use-file-url.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(urls, /export function useShowFileInNewTab\(\): OpenInNewTab \{\s*return useOpenUrlInNewTab\(mintInlineFileUrl\);/);
  assert.match(urls, /filesApi\.getDownloadUrl\(id, \{ inline: true \}\)/);
  assert.match(urls, /async function mintFileUrl\(id: number\): Promise<string \| null> \{\s*return \(await filesApi\.getDownloadUrl\(id\)\)/);
  const api = readFileSync(join(here, '..', '..', '..', 'lib', 'api', 'files.ts'), 'utf8');
  assert.match(api, /params: options\.inline \? \{ inline: 1 \} : undefined,/);
  // v1's folder card opens the same way; v1's Download buttons keep the plain link.
  const root = (...parts: string[]) => readFileSync(join(here, '..', '..', '..', ...parts), 'utf8');
  assert.match(root('components', 'folders', 'FolderItemCard.tsx'), /const downloadFile = useDownloadFile\(\{ inline: true \}\);/);
  assert.match(root('lib', 'hooks', 'useFiles.ts'), /mutationFn: \(id: number\) => filesApi\.getDownloadUrl\(id, \{ inline \}\),/);
  for (const plain of [['components', 'collab', 'files', 'FileRow.tsx'], ['app', '(main)', 'files', 'page.tsx']]) {
    assert.match(root(...plain), /useDownloadFile\(\)/, plain.join('/'));
  }
  // A picture or media opens here instead, when the host passes `onView`
  // (`files/viewable.ts`, 21 October 2026); the tab stays for the rest.
  assert.match(open, /<button\s+type="button"\s+onClick=\{onView \?\? \(\(\) => open\(fileId\)\)\}/);
  assert.match(open, /This file is no longer available\./);
  assert.match(open, /Couldn&rsquo;t open it\.[\s\S]*?Try again/);
  // Still never a link to the payload's presigned URL, which expires.
  assert.doesNotMatch(read('item-row-model.ts'), /href: content\.url/);
});

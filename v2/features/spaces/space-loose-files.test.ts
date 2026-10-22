import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { spacesQueries } from './queries';

/* Space files at the top level, like the Folders page (Stay, 22 October
 * 2026): the Folders pill lists, under the folders, the space's files in
 * none of the space's folders (`GET /spaces/{uuid}/files?unfiled=1`, backend
 * e76a5957, confirmed the same day). Each one's card offers "Move to folder"
 * to the Owner and Contributors, the picker on the space's own folders;
 * filing it takes it off the top level on the next read. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const content = (file: string) => read('v2', 'features', 'spaces', 'detail', 'content', file);

test('the list is the space’s file list with the unfiled flag, page-numbered, under the space’s contents', () => {
  const api = read('lib', 'api', 'collab.ts');
  assert.match(
    api,
    /getUnfiledFiles: async \([\s\S]*?apiClient\.get<SpaceFileListResponse>\(\s*`\/spaces\/\$\{spaceUuid\}\/files`,\s*\{\s*params: \{\s*unfiled: 1,/,
  );
  const options = spacesQueries.looseFiles('s-1', { viewerId: 4 });
  assert.deepEqual(options.queryKey, ['spaces', 'contents', 's-1', 'loose-files', { viewerId: 4 }]);
  assert.deepEqual(spacesQueries.looseFilesOf('s-1'), ['spaces', 'contents', 's-1', 'loose-files']);
  assert.equal(options.initialPageParam, 1);
  const queries = read('v2', 'features', 'spaces', 'queries.ts');
  assert.match(queries, /spacesApi\.getUnfiledFiles\(spaceUuid, \{ per_page: SPACE_CONTENT_PER_PAGE, page: pageParam \}\)/);
});

test('the files sit under the folders on the Folders pill only, held while the folders load', () => {
  const panel = content('SpaceContentPanel.tsx');
  assert.match(
    panel,
    /\{tab === 'folders' \? \(\s*<SpaceLooseFiles\s+spaceUuid=\{spaceUuid\}\s+viewerId=\{viewerId\}\s+enabled=\{enabled\}\s+held=\{query\.isPending\}\s+now=\{now\}\s+menus=\{rowMenus\}\s+\/>\s*\) : null\}/,
  );
  const section = content('SpaceLooseFiles.tsx');
  // The feed's own row, so a file reads here as on the Files pill and opens the same card.
  assert.match(section, /const entry: SpaceItem = \{ type: 'file', sort_at: file\.created_at, item: file \};/);
  assert.match(section, /renderFeedRow\(\{ entry, now, menus, key: `file:\$\{file\.id\}` \}\)/);
  // Its own heading under the day groups; nothing when nothing is loose, and
  // a refusal hides it rather than show an error under the folders.
  assert.match(section, /export const SPACE_LOOSE_FILES_TITLE = 'Files not in a folder';/);
  assert.match(section, /<LobbySection title=\{SPACE_LOOSE_FILES_TITLE\}>/);
  assert.match(section, /const refused = status >= 400 && status < 500;/);
  assert.match(
    section,
    /const showList = enabled && !held && !refused && \(query\.isPending \|\| query\.isError \|\| files\.length > 0\);/,
  );
  // Each file once across pages, and a skeleton with no heading while it loads.
  assert.match(section, /uniqueRowsById\(pages, \(file\) => file\.id\)/);
  assert.match(section, /query\.isPending \? \(\s*<SpaceLooseFilesSkeleton \/>/);
  assert.match(content('states.tsx'), /export function SpaceLooseFilesSkeleton\(/);
  // The sentinel measures against the pane, found once at mount.
  assert.match(section, /closest<HTMLElement>\('\[data-v2-scroller\]'\)/);
  assert.match(section, /rootRef: paneRef,\s*rootMargin: '320px',/);
});

test('Move to folder: in the card’s ⋮, for whoever may add, on the space’s own folders', () => {
  const panel = content('SpaceContentPanel.tsx');
  // The server's rule for a space folder's items: the Owner and Contributors,
  // whoever uploaded the file (backend, 22 October 2026). Never the uploader rule.
  assert.match(panel, /onMoveToFolder: tab === 'folders' && canAdd \? moveToFolder : undefined,/);
  assert.match(
    panel,
    /<FolderPicker\s+key=\{`folder-\$\{filing\.key\}`\}\s+target=\{\{ type: 'file', contentId: filing\.fileId \}\}\s+title="Move to folder"\s+space=\{\{ uuid: spaceUuid, name: spaceName \}\}/,
  );
  const menu = content('SpaceFileMenu.tsx');
  assert.match(menu, /\{onMoveToFolder \? \(\s*<DropdownMenuItem onSelect=\{\(\) => onMoveToFolder\(file\)\}>\s*<FolderInput \/>\s*Move to folder/);
  const card = content('SpaceFileCard.tsx');
  assert.match(card, /onMoveToFolder=\{then\(actions\.onMoveToFolder\)\}/);
});

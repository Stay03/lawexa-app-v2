import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { spacesQueries } from './queries';

/* Space files at the top level, like the Folders page (Stay, 22 October
 * 2026): the Folders pill lists, under the folders, the space's files in
 * none of the space's folders (`GET /spaces/{uuid}/files?unfiled=1`, backend
 * e76a5957, confirmed the same day), drawn EXACTLY as the Folders page draws
 * its own (Stay, the same day: "Why didn't you make it consistent with
 * folders as is already?"): the same folder and file rows, no headings.
 * Each file's ⋯ offers "Move to folder" to the Owner and Contributors, the
 * picker on the space's own folders; filing it takes it off the top level on
 * the next read. */

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

test('the Folders pill is the Folders page: its header, its folder rows, no day headings, the files after', () => {
  const panel = content('SpaceContentPanel.tsx');
  assert.match(
    panel,
    /\{tab === 'folders' \? \([\s\S]{0,700}?<FileListHead dateLabel=\{FOLDERS_DATE_LABEL\} \/>\s*<ul className="mt-1 flex flex-col divide-y divide-border\/40">\s*\{items\.map\(\(entry, index\) =>\s*entry\.type === 'folder' \? \(\s*<FolderRow key=\{itemKey\(entry\)\} row=\{folderRow\(entry\.item\)\} index=\{index\} now=\{now\} \/>/,
  );
  assert.match(
    panel,
    /\{tab === 'folders' \? \(\s*<SpaceLooseFiles\s+spaceUuid=\{spaceUuid\}\s+viewerId=\{viewerId\}\s+enabled=\{enabled\}\s+held=\{query\.isPending\}\s+now=\{now\}\s+actionsFor=\{fileActions\}\s+fileSelect=\{fileSelect\}\s+\/>\s*\) : null\}/,
  );
  const section = content('SpaceLooseFiles.tsx');
  // The Folders page's own file row, dividers and top rule; no heading at all.
  assert.match(section, /<section aria-label="Files in no folder" className="border-t border-border\/40">/);
  assert.match(section, /<ul className="flex flex-col divide-y divide-border\/40">/);
  assert.match(section, /<FileEntryRow\s+key=\{file\.id\}\s+fileId=\{row\.id\}\s+kind=\{row\.kind\}\s+name=\{row\.title\}\s+named=\{row\.hasTitle\}\s+date=\{formatEntryDate\(row\.createdAt, now\)\}\s+index=\{index\}\s+onView=\{row\.view \? \(\) => openView\(file\) : undefined\}\s+menu=\{<SpaceFileMenu file=\{file\} look="row" \{\.\.\.actionsFor\(file\)\} \/>\}/);
  assert.doesNotMatch(section, /LobbySection|SPACE_LOOSE_FILES_TITLE|Files not in a folder/);
  assert.doesNotMatch(content('states.tsx'), /SpaceLooseFilesSkeleton/);
  // The same tap as there: a picture, a video or a recording in the list's viewer.
  assert.match(section, /<FileViewers viewer=\{viewer\} pictures=\{pictures\} place="space" \/>/);
  // Nothing when nothing is loose; a refusal hides it rather than show an error.
  assert.match(section, /const refused = status >= 400 && status < 500;/);
  assert.match(
    section,
    /const showList = enabled && !held && !refused && \(query\.isPending \|\| query\.isError \|\| files\.length > 0\);/,
  );
  // Each file once across pages, and the Folders page's skeleton while it loads.
  assert.match(section, /uniqueRowsById\(pages, \(file\) => file\.id\)/);
  assert.match(section, /query\.isPending \? \(\s*<LooseFilesSkeleton \/>/);
  // The sentinel measures against the pane, found once at mount.
  assert.match(section, /closest<HTMLElement>\('\[data-v2-scroller\]'\)/);
  assert.match(section, /rootRef: paneRef,\s*rootMargin: '320px',/);
  // The row's ⋯ is a file list row's, as on the Folders page.
  const menu = content('SpaceFileMenu.tsx');
  assert.match(menu, /look === 'row' \? \(\s*<DropdownMenuTrigger\s+className=\{cn\(ROW_MENU_TRIGGER_CLASS, FOCUS_RING\)\}\s+aria-label=\{`Actions for \$\{file\.original_name\}`\}/);
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

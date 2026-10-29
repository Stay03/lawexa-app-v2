import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { UserFile } from '@/types/file';
import { isMigratedToV2 } from '@/v2/routes.manifest';
import { FOLDER_ITEM_INVALIDATES } from './item-mutations';
import { looseFileRow, UNNAMED_FILE } from './loose-file-row-model';
import { foldersQueries } from './queries';

/* Build 6 (Stay, 19 October 2026, 16:33 UTC: "Build 6 Push 4"; picture 6):
 * the Folders page is the top level. Under the folders, "Files · not in a
 * folder" lists the viewer's own files in none of their own live folders
 * (`GET /files?unfiled=1`), each opening on tap, with "⋯" → Move to folder and
 * Delete file, and "Upload a file" beside "New folder". v1's `/files` address
 * redirects to `/folders` for a v2 reader. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');
const readRoot = (...parts: string[]) =>
  readFileSync(join(here, '..', '..', '..', ...parts), 'utf8').replace(/\r\n/g, '\n');

const file = (overrides: Partial<UserFile> = {}): UserFile => ({
  id: 7,
  url: null,
  original_name: 'Witness statement.docx',
  mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  size: 1_258_291,
  category: 'document',
  upload_status: 'completed',
  created_at: '2026-10-19T10:00:00Z',
  ...overrides,
});

test('a loose file reads as its name, its kind and size, and when it was added', () => {
  assert.deepEqual(looseFileRow(file()), {
    id: 7,
    title: 'Witness statement.docx',
    hasTitle: true,
    kind: 'Word',
    size: '1.2 MB',
    createdAt: '2026-10-19T10:00:00Z',
    // A Word file opens in a tab; a picture or media would open here (21 October 2026).
    view: null,
  });
  // No name: the fallback, marked as one. No usable size or type: not claimed.
  const bare = looseFileRow(file({ original_name: '  ', mime_type: '', size: Number.NaN, created_at: '' }));
  assert.equal(bare.title, UNNAMED_FILE);
  assert.equal(bare.hasTitle, false);
  assert.equal(bare.kind, null);
  assert.equal(bare.size, null);
  assert.equal(bare.createdAt, null);
  assert.equal(bare.view, null);
});

test('the list asks for the unfiled files, under its own key, kept on the device', () => {
  const options = foldersQueries.looseFiles({ viewerId: 93 });
  assert.deepEqual(options.queryKey, ['folders', 'loose-files', { viewerId: 93 }]);
  assert.deepEqual(foldersQueries.looseFilesKey(), ['folders', 'loose-files']);
  assert.equal(options.meta?.persist, 'list');
  assert.match(read('queries.ts'), /filesApi\.getList\(\{ unfiled: true, per_page: FOLDERS_PAGE_SIZE, page: pageParam \}\)/);
  assert.match(readRoot('lib', 'api', 'files.ts'), /unfiled: params\.unfiled \? 1 : undefined,/);
});

test('every write that files, unfiles or deletes a file re-asks the loose list', () => {
  // Filing (the picker, its undo, create-and-add, a folder upload) and taking
  // a file out of its last folder.
  assert.ok(FOLDER_ITEM_INVALIDATES.some((key) => key.join('/') === 'folders/loose-files'));
  const mutations = read('file-mutations.ts');
  // Upload: every file, pictures included, to POST /files/documents, in no
  // folder. POST /files saves a picture as a note's content image, which the
  // Folders page never lists (backend's local run, 22 October 2026).
  assert.match(mutations, /mutationFn: \(file: File\) => filesApi\.uploadDocument\(file\),/);
  assert.doesNotMatch(mutations, /uploadImage/);
  assert.doesNotMatch(mutations, /addItem/);
  assert.match(mutations, /invalidates: \[foldersQueries\.looseFilesKey\(\)\] \}/);
  // Delete: the file leaves every folder that held it too.
  assert.match(
    mutations,
    /filesApi\.deleteFile\(fileId\),[\s\S]*?foldersQueries\.looseFilesKey\(\),\s*foldersQueries\.lists\(\),\s*foldersQueries\.details\(\),\s*foldersQueries\.itemLists\(\),/,
  );
});

test('the files continue the folder list, open on tap, and offer Move to folder and Delete', () => {
  const browser = read('list', 'FoldersBrowser.tsx');
  assert.match(browser, /<LooseFilesSection\s+viewerId=\{viewerId\}\s+now=\{now\}\s+enabled=\{!activeSearch\}\s+held=\{showSkeleton\}\s+selection=\{looseSelection\}\s+onStartSelect=\{startWithFile\}\s+\/>/);
  // The upload pill sits before "New folder" in the same row.
  // "Upload a file" is one flex item, so the pill's gap never splits it.
  assert.match(browser, /onClick=\{upload\.pick\}[\s\S]*?<span>\s*Upload<span className="sr-only sm:not-sr-only"> a file<\/span>\s*<\/span>[\s\S]*?New folder/);

  const section = read('list', 'LooseFilesSection.tsx');
  // No heading over them (Stay, 20 October 2026: "a clean file system").
  assert.match(section, /<section aria-label="Files in no folder" className="border-t border-border\/40">/);
  assert.doesNotMatch(section, /<h2|not in a folder<\/span>/);
  // Nothing loose, a search, or the folders still loading: no section.
  assert.match(
    section,
    /const showList =\s*enabled && !held && !refused && \(query\.isPending \|\| query\.isError \|\| rows\.length > 0\);/,
  );
  // A refusal (4xx) hides the section; only a blip offers Try again.
  assert.match(section, /const refused = status >= 400 && status < 500;/);
  // Filing the last loose file must not unmount its open picker (its Undo).
  assert.match(section, /\) : null\}\n\n      \{\/\* Held after closing so the picker's exit plays; each open bumps the key\. \*\/\}\n      \{moving \? \(/);
  assert.match(section, /<FolderPicker\s+key=\{moving\.key\}\s+target=\{\{ type: 'file', contentId: moving\.fileId \}\}\s+title="Move to folder"/);
  assert.match(section, /uploadAsync\(file\)\.then\(/);

  const row = read('list', 'LooseFileRow.tsx');
  assert.match(row, /<FileEntryRow\s+fileId=\{row\.id\}/);
  assert.match(row, /<DropdownMenuItem onSelect=\{\(\) => onMove\(row\)\}>\s*<FolderInput \/>\s*Move to folder/);
  assert.match(row, /<DropdownMenuItem variant="destructive" onSelect=\{\(\) => onDelete\(row\)\}>\s*<Trash2 \/>\s*Delete file/);

  // Delete asks first, and stays open until the server answers.
  const dialog = read('list', 'DeleteLooseFileDialog.tsx');
  assert.match(dialog, /variant="destructive"[\s\S]*?event\.preventDefault\(\);\s*confirm\(\);/);
});

test('the picker can say "Move to folder", and says "Add to folder" everywhere else', () => {
  const picker = read('picker', 'FolderPicker.tsx');
  assert.match(picker, /title = 'Add to folder',/);
  assert.match(picker, /<DialogTitle>\{title\}<\/DialogTitle>/);
  assert.match(picker, /<SheetTitle>\{title\}<\/SheetTitle>/);
});

test('the loading frame reserves the upload pill, and imports nothing new', () => {
  const fallback = read('list', 'FoldersFallback.tsx');
  assert.match(fallback, /<div className="h-11 w-24 rounded-full border border-border sm:w-36" \/>\s*<div className="h-11 w-11 rounded-full bg-primary\/60 sm:w-32" \/>/);
  const states = read('list', 'states.tsx');
  assert.doesNotMatch(states, /from '\.\.\/(picker|file-mutations|queries)/);
});

test("v1's /files address goes to /folders for a v2 reader", () => {
  assert.equal(isMigratedToV2('/files'), true);
  assert.equal(isMigratedToV2('/files/12'), false);
  assert.match(readRoot('app', 'v2', 'files', 'page.tsx'), /redirect\('\/folders'\);/);
});

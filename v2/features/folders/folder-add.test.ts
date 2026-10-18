import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { uploadPrecheck } from '../spaces/content-model';

/* Arthur's folder page items 8 and 9 (17 October 2026): one labelled "Add"
 * with the ways into a folder, and an empty folder that starts adding from
 * right there. Chats stay out of folders for now (techlead, 18 October 2026,
 * option A: decision 4 holds). */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the "+" is a labelled Add with the folder’s ways in', () => {
  const add = read('detail', 'FolderAdd.tsx');
  assert.match(add, /<Plus aria-hidden className="size-4" \/>\s*Add\s*<\/DropdownMenuTrigger>/);
  assert.match(add, /\{choices\.fromSpace \? \(\s*<DropdownMenuItem onSelect=\{choices\.fromSpace\}>\s*<Boxes \/>\s*Files from this space/);
  assert.match(add, /<DropdownMenuItem onSelect=\{choices\.upload\}>\s*<Upload \/>\s*Upload a file/);
  assert.match(add, /<DropdownMenuItem onSelect=\{choices\.newSubfolder\}>\s*<FolderPlus \/>\s*New subfolder/);
  const screen = read('detail', 'FolderScreen.tsx');
  assert.doesNotMatch(screen, /<span className="sr-only sm:not-sr-only">New subfolder<\/span>/);
  assert.match(screen, /\{addChoices \? <FolderAddMenu choices=\{addChoices\} \/> : null\}/);
});

test('only the folder’s creator gets Add, as the server allows', () => {
  const screen = read('detail', 'FolderScreen.tsx');
  assert.match(screen, /const canEdit = viewerId !== null && folder\?\.user\?\.id === viewerId;/);
  assert.match(screen, /const addChoices: AddChoices \| null = canEdit\s*\?/);
  // "Files from this space" only for a folder in a space.
  assert.match(screen, /fromSpace: space \? \(\) => setSpaceFiles\(/);
});

test('only the folder’s creator gets "Remove from folder" on its rows, as the server allows', () => {
  // `FolderService::canEdit` authorises add and remove alike: a member of the
  // folder's space who did not make it gets a 403 (techlead, 18 October 2026).
  const screen = read('detail', 'FolderScreen.tsx');
  assert.match(screen, /<FolderItemRow[\s\S]*?canRemove=\{canEdit\}/);
  const row = read('detail', 'FolderItemRow.tsx');
  assert.match(row, /canRemove: boolean;/);
  assert.match(row, /\{canRemove \? <RemoveFromFolderButton row=\{row\} folderUuid=\{folderUuid\} \/> : null\}/);
});

test('an upload goes to its store first, then into the folder', () => {
  const add = read('detail', 'FolderAdd.tsx');
  // A space folder's file belongs to the space; a personal one's to the reader.
  assert.match(
    add,
    /const stored = folder\.space\s*\? await spacesApi\.uploadFile\(folder\.space\.uuid, file\)\s*: isImageAttachment\(file\)\s*\? await filesApi\.uploadImage\(file\)\s*: await filesApi\.uploadDocument\(file\);/,
  );
  assert.match(add, /await foldersApi\.addItem\(folder\.uuid, \{ type: 'file', id: stored\.data\.id \}\);/);
  // A file that uploaded but was not filed says where it is.
  assert.match(add, /uploaded, but couldn’t be added to \$\{folder\.name\}\. \$\{where\}\./);
  assert.match(add, /const refusal = uploadPrecheck\(file, place\);/);
});

test('the refusal names a folder when the upload is a folder’s', () => {
  const file = (name: string, type: string, size: number) => ({ name, type, size });
  assert.match(uploadPrecheck(file('setup.exe', 'application/x-msdownload', 1), 'a folder') ?? '', /A folder takes PDF, Word, RTF and image files/);
  assert.match(uploadPrecheck(file('big.pdf', 'application/pdf', 11 * 1024 * 1024), 'a folder') ?? '', /the most a folder takes\./);
  // A space's own upload keeps its words.
  assert.match(uploadPrecheck(file('setup.exe', 'application/x-msdownload', 1)) ?? '', /A space takes PDF/);
});

test('files from the space are offered, chats are not', () => {
  const add = read('detail', 'FolderAdd.tsx');
  assert.match(add, /spacesQueries\.items\(space\.uuid, \{ viewerId, type: 'files' \}\)/);
  assert.match(add, /entry\.type === 'file' \? \[entry\.item\] : \[\]/);
  assert.doesNotMatch(add, /type: 'conversation'/);
  // A file the folder already holds is done, not failed.
  assert.match(add, /setState\(isAlreadyInFolder\(error\) \? 'already' : 'failed'\)/);
});

test('the empty folder says anything can go in and starts from there', () => {
  const states = read('detail', 'states.tsx');
  assert.match(states, /title="Nothing in this folder yet"/);
  assert.match(states, /`Anything can go in a folder: \$\{files\} cases, statutes, notes and subfolders\. Start here\.`/);
  assert.match(states, /'Anything can go in a folder\. Only the person who made it adds to it\.'/);
  assert.doesNotMatch(states, /<Link href="\/cases">Browse cases<\/Link>/);
  // The loading frame imports this file, so the buttons come from the screen.
  assert.doesNotMatch(states, /from '\.\/FolderAdd'/);
  assert.match(read('detail', 'FolderScreen.tsx'), /add=\{addChoices \? <FolderAddButtons choices=\{addChoices\} \/> : null\}/);
});

test('cases, statutes and notes are added from the folder too (the second push)', () => {
  const add = read('detail', 'FolderAdd.tsx');
  assert.match(add, /<DropdownMenuItem onSelect=\{choices\.library\}>\s*<BookOpen \/>\s*Cases, statutes and notes/);
  assert.match(add, /<Button type="button" size="sm" variant="outline" onClick=\{choices\.library\}>/);
  const picker = read('detail', 'LibraryPicker.tsx');
  // The three libraries v2 already reads, searched by the server.
  assert.match(picker, /casesQueries\.infiniteList\(\{ viewerId, search: term \|\| undefined \}\)/);
  assert.match(picker, /statutesQueries\.infiniteList\(\{ viewerId, search: term \|\| undefined \}\)/);
  assert.match(picker, /notesQueries\.mine\(\{ viewerId, search: term \|\| undefined \}\)/);
  assert.match(picker, /const search = useServerSearch\(\);/);
  // Every row files itself with its own numeric id, the same row the space's
  // files use; a duplicate reads as done.
  assert.match(picker, /target=\{\{ type, contentId: row\.id \}\}/);
  assert.match(add, /export function AddChoiceRow\(/);
  assert.match(add, /setState\(isAlreadyInFolder\(error\) \? 'already' : 'failed'\)/);
  // A new tab is a fresh list, so no rows of the last kind show under its name.
  assert.match(picker, /<CaseResults key="case"/);
  // The screen opens it only for whoever may add.
  assert.match(read('detail', 'FolderScreen.tsx'), /library: \(\) => setLibrary\(\(previous\) => \(\{ open: true, key: previous\.key \+ 1 \}\)\),/);
});

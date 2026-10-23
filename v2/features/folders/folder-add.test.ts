import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FILES_ACCEPT, fileTypeLabel, uploadPrecheck } from '../spaces/content-model';
import { ACCEPTED_FILE_TYPES } from '../conversations/attachment-rules';

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

test('Add is for whoever the server lets add: a personal folder’s creator, a space’s Owner and Contributors', () => {
  // Stay, 18 October 2026: "a space is a cowork place so any contributor can
  // 'contribute' so add is allowed" (`FolderService::canManageItems`).
  const screen = read('detail', 'FolderScreen.tsx');
  assert.match(
    screen,
    /const canManageItems =\s*viewerId !== null &&\s*\(folderSpace === null \? folder\?\.user\?\.id === viewerId : spaceDetail !== null && canAddContent\(spaceDetail\)\);/,
  );
  assert.match(screen, /const addChoices: AddChoices \| null = canManageItems\s*\?/);
  // Rename, move and delete of the folder stay with its creator.
  assert.match(screen, /const owned = viewerId !== null && folder\.user\?\.id === viewerId;\s*const ownerActions: ScreenAction\[\] = owned/);
  assert.match(screen, /const deleteAction: ScreenAction\[\] = owned/);
  // "Files from this space" only for a folder in a space.
  assert.match(screen, /fromSpace: space \? \(\) => setSpaceFiles\(/);
});

test('whoever may add also gets "Remove from folder" on its rows, as the server allows', () => {
  // `FolderService::canManageItems` authorises add and remove alike: in a
  // space, any Contributor removes (Stay, 18 October 2026).
  const screen = read('detail', 'FolderScreen.tsx');
  assert.match(screen, /<FolderItemRow[\s\S]*?canRemove=\{canManageItems\}/);
  assert.doesNotMatch(screen, /canEdit/);
  const row = read('detail', 'FolderItemRow.tsx');
  assert.match(row, /canRemove: boolean;/);
  // The menu carries the file's move too (22 October 2026); still only for whoever may take items out.
  assert.match(row, /const menu = canRemove \? \(\s*<ItemMenu row=\{row\} folderUuid=\{folderUuid\} onMoveToFolder=\{onMoveToFolder\} \/>\s*\) : undefined;/);
  assert.match(row, /<FolderMinus \/>\s*Remove from this folder/);
});

test('an upload goes to its store first, then into the folder', () => {
  const add = read('detail', 'FolderAdd.tsx');
  // A space folder's file belongs to the space; a personal one's to the reader.
  assert.match(
    add,
    /const stored = folder\.space\s*\? await spacesApi\.uploadFile\(folder\.space\.uuid, file\)\s*: await filesApi\.uploadDocument\(file\);/,
  );
  // A picture too: POST /files would save it as a note's content image,
  // which no file list shows (backend's local run, 22 October 2026).
  assert.doesNotMatch(add, /uploadImage/);
  assert.match(add, /await foldersApi\.addItem\(folder\.uuid, \{ type: 'file', id: stored\.data\.id \}\);/);
  // A file that uploaded but was not filed says where it is, and a picked file
  // is checked first (folder-upload.ts, each file on its own toast).
  const send = read('detail', 'folder-upload.ts');
  assert.match(send, /uploaded, but couldn’t be added to \$\{folder\.name\}\. \$\{where\}\./);
  assert.match(send, /const refusal = uploadPrecheck\(file, folder\.space \? 'a space' : 'a folder'\);/);
});

test('the refusal names a folder when the upload is a folder’s', () => {
  const file = (name: string, type: string, size: number) => ({ name, type, size });
  assert.match(uploadPrecheck(file('setup.exe', 'application/x-msdownload', 1), 'a folder') ?? '', /A folder takes PDF, Word, RTF, image \(JPG, PNG, WebP\), video and audio files/);
  assert.match(uploadPrecheck(file('big.pdf', 'application/pdf', 11 * 1024 * 1024), 'a folder') ?? '', /the most a folder takes\./);
  // A space's own upload keeps its words.
  assert.match(uploadPrecheck(file('setup.exe', 'application/x-msdownload', 1)) ?? '', /A space takes PDF/);
});

test('a space and a folder take video and audio up to 100 MB; the chat composer does not', () => {
  const file = (name: string, type: string, size: number) => ({ name, type, size });
  const MB = 1024 * 1024;
  // Stay, 20 October 2026: "Yes all files" (backend: the space and document routes take them).
  for (const [name, type] of [
    ['hearing.mp4', 'video/mp4'],
    ['call.mov', 'video/quicktime'],
    ['clip.webm', 'video/webm'],
    ['note.mp3', 'audio/mpeg'],
    ['memo.m4a', 'audio/x-m4a'],
    ['record.wav', 'audio/wav'],
    ['voice.ogg', 'audio/ogg'],
  ]) {
    assert.equal(uploadPrecheck(file(name, type, 90 * MB), 'a folder'), null, name);
    assert.equal(uploadPrecheck(file(name, type, 90 * MB)), null, name);
  }
  // A media file a system sent with no type is judged by its name.
  assert.equal(uploadPrecheck(file('hearing.mp4', '', 5 * MB), 'a folder'), null);
  assert.match(uploadPrecheck(file('long.mp4', 'video/mp4', 101 * MB), 'a folder') ?? '', /larger than 100 MB, the most a folder takes for a video or audio file/);
  // Documents and pictures keep their caps.
  assert.match(uploadPrecheck(file('big.pdf', 'application/pdf', 11 * MB), 'a folder') ?? '', /larger than 10 MB/);
  // The pickers: a space and a folder offer media; the chat composer keeps documents and pictures.
  assert.match(FILES_ACCEPT, /\.mp4/);
  assert.match(FILES_ACCEPT, /\.ogg/);
  assert.doesNotMatch(ACCEPTED_FILE_TYPES, /\.mp4|\.mp3/);
  assert.match(read('detail', 'FolderAdd.tsx'), /accept=\{FILES_ACCEPT\}/);
  assert.match(read('list', 'LooseFilesSection.tsx'), /accept=\{FILES_ACCEPT\}/);
  // Their rows say what they are.
  assert.equal(fileTypeLabel({ mime_type: 'video/mp4', original_name: 'hearing.mp4' }), 'Video');
  assert.equal(fileTypeLabel({ mime_type: 'audio/mpeg', original_name: 'note.mp3' }), 'Audio');
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
  assert.match(states, /'Anything can go in a folder\. The space’s Owner and Contributors add to it\.'/);
  assert.doesNotMatch(states, /<Link href="\/cases">Browse cases<\/Link>/);
  // The loading frame imports this file, so the buttons come from the screen.
  assert.doesNotMatch(states, /from '\.\/FolderAdd'/);
  assert.match(read('detail', 'FolderScreen.tsx'), /add=\{addChoices \? <FolderAddButtons choices=\{addChoices\} \/> : null\}/);
});

test('cases, statutes and notes are added From Library (the second push)', () => {
  const add = read('detail', 'FolderAdd.tsx');
  assert.match(add, /<DropdownMenuItem onSelect=\{choices\.library\}>\s*<BookOpen \/>\s*From Library/);
  assert.match(add, /<BookOpen aria-hidden className="size-4" \/>\s*From Library/);
  assert.doesNotMatch(add, /Cases, statutes and notes/);
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

test('the picker is "Add from Library", and in a space My notes says the note is copied', () => {
  const picker = read('detail', 'LibraryPicker.tsx');
  assert.match(picker, /<DialogTitle>Add from Library<\/DialogTitle>/);
  // Said before the tap (Stay, 18 October 2026: "my original one remains as is").
  assert.match(
    picker,
    /\{tab === 'note' && folder\.space \? \(\s*<p className="text-sm text-muted-foreground">Adds a copy to the space\. Your note stays yours\.<\/p>\s*\) : null\}/,
  );
  assert.match(read('detail', 'FolderScreen.tsx'), /<LibraryPicker[\s\S]*?folder=\{\{ uuid: folder\.uuid, name: row\.name, space \}\}/);
});

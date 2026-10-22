import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { spacesQueries } from '@/v2/features/spaces/queries';
import { FOLDER_ITEM_INVALIDATES } from './item-mutations';
import { createDestinationLabel, pickerDescription, pickerWords } from './picker/picker-model';

/* The folder picker can browse one space's folders (Stay, 22 October 2026,
 * "Space files at the top level, like your Folders page"): a space's file is
 * filed among the space's folders, which are every member's, so the viewer's
 * own list is the wrong one to offer. With `space` the picker reads
 * `GET /spaces/{uuid}/folders` one level at a time, names the space at the
 * trail's root, and its create row makes a space folder. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

const space = { uuid: 's-1', name: 'Moot team' };

test('the words name whose folders are being browsed', () => {
  const own = pickerWords(undefined);
  assert.equal(own.root, 'Your folders');
  assert.equal(own.field, 'Search your folders');
  assert.equal(own.searchAll, 'Search all your folders');
  assert.equal(own.none.title, 'You have no folders yet.');
  const theirs = pickerWords(space);
  assert.equal(theirs.root, 'Moot team');
  assert.equal(theirs.field, 'Search folders in Moot team');
  assert.equal(theirs.loading, 'Loading the folders in Moot team');
  assert.equal(theirs.failed, 'The folders in Moot team could not be loaded');
  assert.equal(theirs.searchAll, 'Search all folders in Moot team');
  assert.deepEqual(theirs.none, {
    title: 'No folders in Moot team yet.',
    detail: 'A folder made here is open to everyone in Moot team.',
  });
});

test('a space folder is never called private, since everyone in the space can open it', () => {
  const inside = [{ uuid: 'f-1', name: 'Pleadings' }];
  assert.equal(createDestinationLabel([]), 'New private folder in your folders');
  assert.equal(createDestinationLabel(inside), 'New private folder in Pleadings');
  assert.equal(createDestinationLabel([], space), 'New folder in Moot team');
  assert.equal(createDestinationLabel(inside, space), 'New folder in Pleadings');
  assert.equal(pickerDescription('file'), 'Pick a folder for this file. It can sit in more than one.');
  assert.equal(
    pickerDescription('file', { space }),
    'Pick a folder in Moot team for this file. It can sit in more than one.',
  );
});

test("a space's folders are read one level at a time, under the space's contents key", () => {
  const root = spacesQueries.folders('s-1', { viewerId: 4 });
  assert.deepEqual(root.queryKey, ['spaces', 'contents', 's-1', 'folders', { parentUuid: null, search: null }, { viewerId: 4 }]);
  const level = spacesQueries.folders('s-1', { viewerId: 4, parentUuid: 'f-1', search: 'plead' });
  assert.deepEqual(level.queryKey, ['spaces', 'contents', 's-1', 'folders', { parentUuid: 'f-1', search: 'plead' }, { viewerId: 4 }]);
  assert.equal(root.initialPageParam, 1);
  const queries = readFileSync(join(here, '..', 'spaces', 'queries.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(queries, /spacesApi\.getFolders\(spaceUuid, \{\s*parent_id: parentUuid \?\? undefined,\s*search,\s*per_page: SPACE_CONTENT_PER_PAGE,\s*page: pageParam,\s*\}\)/);
});

test('filing re-asks every space’s contents: folder counts and the files in no folder', () => {
  assert.ok(FOLDER_ITEM_INVALIDATES.some((key) => key.join('/') === 'spaces/contents'));
});

test('the body asks one of two routes, and the picker hands the space down', () => {
  const body = read('picker', 'PickerBody.tsx');
  assert.match(body, /const inSpace = space !== undefined;/);
  assert.match(body, /\.\.\.foldersQueries\.level\(\{[\s\S]*?\}\),\s*enabled: !inSpace,/);
  assert.match(body, /\.\.\.spacesQueries\.folders\(space\?\.uuid \?\? '', \{[\s\S]*?\}\),\s*enabled: inSpace,/);
  assert.match(body, /const level: LevelQuery = inSpace \? spaceLevel : ownLevel;/);
  // The words, not the viewer's, at the root, the field and the empty level.
  assert.match(body, /<TrailStep label=\{words\.root\} onClick=\{\(\) => goTo\(\[\]\)\} \/>/);
  assert.match(body, /const fieldLabel = here \? `Search in \$\{here\.name\}` : words\.field;/);
  assert.match(body, /destination: createDestinationLabel\(trail, space\),/);
  assert.doesNotMatch(body, /'Your folders'|'Search your folders'|You have no folders yet/);

  const picker = read('picker', 'FolderPicker.tsx');
  assert.match(picker, /space\?: ContentSpaceStub;/);
  assert.match(picker, /const create = useCreateFolderAndAdd\(target, \{ space \}\);/);
  assert.match(picker, /<PickerBody\s+surface=\{surface\}\s+space=\{space\}/);
  assert.match(picker, /const description = pickerDescription\(noun, \{ space \}\);/);

  // The create row makes a space folder in a space, the dialog's own request.
  const create = read('picker', 'create-and-add.ts');
  assert.match(create, /\? \(await spacesApi\.createFolder\(space\.uuid, spaceFolderPayload\(name, parentUuid\)\)\)\.data/);
  assert.match(create, /invalidates: space \? CREATE_IN_SPACE_INVALIDATES : FOLDER_ITEM_INVALIDATES,/);

  // The rows read one shape off both lists; nothing is cast.
  const rows = read('picker', 'PickerRows.tsx');
  assert.match(rows, /folder: PickerFolder;/);
  assert.doesNotMatch(rows, /FolderRecord| as SpaceFolder| as FolderRecord/);
});

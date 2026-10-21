import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { folderRow } from './folder-row-model';
import type { FolderRecord } from './types';

/* The Space folder mark (Arthur picked 2a, 21 October 2026, 13:07Z, in place
 * of Stay's C1 disc): on the personal Folders page, a folder in a Space wears
 * the Space cubes in folder yellow, about half over the folder's bottom-right
 * corner, with no disc; "In <Space>" on hover on a computer; ", in <Space>"
 * for a screen reader; and the folder's own page says which Space, as a link.
 * A personal folder has no mark. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), 'v2', 'features', 'folders', ...parts), 'utf8').replace(/\r\n/g, '\n');

const record = (space: FolderRecord['space']): FolderRecord => ({
  id: 1,
  uuid: 'f1',
  name: 'FIXTURE Shared precedents',
  slug: 'fixture-shared-precedents',
  slug_path: 'fixture-shared-precedents',
  icon: null,
  color: null,
  is_private: true,
  children_count: 0,
  items_count: 0,
  is_bookmarked: false,
  created_at: '2026-10-20T10:00:00Z',
  user: { id: 1, name: 'FIXTURE Folder Tester', avatar_url: null },
  ...(space === undefined ? {} : { space }),
});

test('only a folder in a Space carries a Space name to mark', () => {
  assert.equal(folderRow(record({ uuid: 's1', name: 'Okafor & Co chambers' })).spaceName, 'Okafor & Co chambers');
  assert.equal(folderRow(record(null)).spaceName, null);
  assert.equal(folderRow(record(undefined)).spaceName, null);
});

test('the Folders page marks Space folders, with the tooltip and the screen-reader words naming the Space', () => {
  const row = read('list', 'FolderRow.tsx');
  assert.match(row, /const space = markSpace \? row\.spaceName : null;/);
  assert.match(row, /iconMark=\{space \? <SpaceFolderMark spaceName=\{space\} ground="row" tooltip \/> : undefined\}/);
  assert.match(row, /srNote=\{space \? spaceFolderNote\(space\) : undefined\}/);
  assert.match(read('list', 'FoldersBrowser.tsx'), /onMove=\{openMove\}\s*markSpace\s/);
  // The folder's own page lists its subfolders without the mark: they are all the Space's.
  assert.doesNotMatch(read('detail', 'FolderScreen.tsx'), /markSpace/);

  const mark = read('space-mark.tsx');
  assert.match(mark, /<TooltipContent side="top" sideOffset=\{6\}>\s*In \{spaceName\}\s*<\/TooltipContent>/);
  assert.match(mark, /return `, in \$\{spaceName\}`;/);
  // The Space cubes in the folder's own yellow, half over the corner, on a
  // square of the ground behind them; no disc and no people glyph.
  assert.match(mark, /<Boxes aria-hidden className="size-full stroke-\[2\.6\]" \/>/);
  assert.match(mark, /absolute -bottom-0\.5 -right-0\.5 flex size-\[11px\]/);
  assert.match(mark, /'text-amber-500 dark:text-amber-400'/);
  assert.match(mark, /bg-background group-hover:bg-\[color-mix/);
  assert.doesNotMatch(mark, /rounded-full|Users/);
  // The words come after the name, never before it.
  const fileRow = read('file-list', 'FileListRow.tsx');
  assert.match(fileRow, /\{name\}\s*\{srNote \? <span className="sr-only">\{srNote\}<\/span> : null\}/);
});

test("a Space folder's own page names its Space as a link", () => {
  assert.match(read('detail', 'FolderScreen.tsx'), /\{folder\.space \? <SpaceFolderLine space=\{folder\.space\} \/> : null\}/);
  const mark = read('space-mark.tsx');
  const line = mark.slice(mark.indexOf('export function SpaceFolderLine'));
  assert.match(line, /<span className="shrink-0">In<\/span>/);
  assert.match(line, /href=\{`\/spaces\/\$\{space\.uuid\}`\}/);
});

test('the Add to folder picker wears the same mark on its tiles', () => {
  const picker = read('picker', 'PickerRows.tsx');
  assert.match(picker, /\{folder\.space \? <SpaceFolderMark spaceName=\{folder\.space\.name\} ground="tile" \/> : null\}/);
  assert.match(picker, /spaceFolderNote\(folder\.space\.name\)/);
});

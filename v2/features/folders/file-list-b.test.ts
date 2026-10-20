import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { entryLook, formatEntryDate } from './file-list/entry-look';

/* Folder page B (Stay, 20 October 2026, 00:49 UTC), and the Folders page in
 * the same look (00:54 UTC: "make it look like a clean file system"): one line
 * per folder or file, a coloured type glyph and the name, nothing under them;
 * on a computer a date column under a "Name" head; the header is the name. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('each kind has its own glyph colour, and an unknown file kind stays muted', () => {
  assert.match(entryLook({ type: 'folder' }).tone, /text-amber-500/);
  assert.match(entryLook({ type: 'case' }).tone, /text-violet-600/);
  assert.match(entryLook({ type: 'statute' }).tone, /text-emerald-600/);
  assert.match(entryLook({ type: 'note' }).tone, /text-sky-600/);
  assert.match(entryLook({ type: 'file', kind: 'PDF' }).tone, /text-red-600/);
  assert.match(entryLook({ type: 'file', kind: 'Word' }).tone, /text-blue-600/);
  assert.equal(entryLook({ type: 'file', kind: 'ZIP' }).tone, 'text-muted-foreground');
  assert.equal(entryLook({ type: 'file', kind: null }).tone, 'text-muted-foreground');
  // Every tone has a dark-theme ink too.
  for (const type of ['folder', 'case', 'statute', 'note'] as const) {
    assert.match(entryLook({ type }).tone, /dark:text-/, type);
  }
});

test('the date column reads "17 Oct" this year and carries the year before it', () => {
  const now = Date.parse('2026-10-20T01:00:00Z');
  assert.equal(formatEntryDate('2026-10-17T09:00:00Z', now), '17 Oct');
  assert.equal(formatEntryDate('2025-03-02T09:00:00Z', now), '2 Mar 2025');
  assert.equal(formatEntryDate(null, now), '');
  assert.equal(formatEntryDate('not a date', now), '');
});

test('a row is one line: the glyph, the name, the computer date column and the "⋯"', () => {
  const row = read('file-list', 'FileListRow.tsx');
  assert.match(row, /'v2-interactive flex h-13 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-left sm:h-10'/);
  // One hover tint for the whole row, with the "⋯" inside it (first pictures, 20 October 2026).
  assert.match(row, /<div className="group flex min-w-0 items-center gap-1 rounded-lg transition-colors hover:bg-secondary\/50">/);
  assert.match(row, /'hidden text-xs text-muted-foreground tabular-nums sm:block'/);
  // The "⋯" shows on hover where the pointer can hover, and always on touch.
  assert.match(row, /\[@media\(hover:hover\)\]:opacity-0 \[@media\(hover:hover\)\]:group-hover:opacity-100/);
  // Nothing under the name on any kind: no counts, sizes, authors or "added N ago".
  for (const file of [['list', 'FolderRow.tsx'], ['list', 'LooseFileRow.tsx'], ['detail', 'FolderItemRow.tsx']]) {
    const source = read(...file);
    assert.doesNotMatch(source, /folderCountsLabel|formatRelativeTime|FolderPublicMark|row\.size|row\.author|row\.citation|row\.preview|added \{/, file.join('/'));
    assert.match(source, /formatEntryDate\(/, file.join('/'));
  }
});

test('a folder keeps its legacy colour, and every menu keeps its actions', () => {
  const folder = read('list', 'FolderRow.tsx');
  assert.match(folder, /look=\{\{ \.\.\.entryLook\(\{ type: 'folder' \}\), color: row\.tint \}\}/);
  assert.match(folder, /<FolderActionsMenu/);
  const item = read('detail', 'FolderItemRow.tsx');
  assert.match(item, /aria-label=\{`Actions for \$\{row\.title\}`\}/);
  // No Download in any row menu until Stay answers.
  for (const file of [['list', 'LooseFileRow.tsx'], ['detail', 'FolderItemRow.tsx'], ['FolderActionsMenu.tsx']]) {
    assert.doesNotMatch(read(...file), /Download/, file.join('/'));
  }
});

test('the folder page header is the name and Add, over a "Name / Added" head', () => {
  const screen = read('detail', 'FolderScreen.tsx');
  assert.match(screen, /<header className="flex items-start gap-3 pb-3 sm:mt-3">\s*<h1/);
  assert.match(screen, /\{addChoices \? <FolderAddMenu choices=\{addChoices\} \/> : null\}\s*<\/header>/);
  assert.doesNotMatch(screen, /FolderTile|countLabel|folderCountsLabel/);
  assert.match(screen, /<FileListHead \/>\s*<ul className="mt-1 flex flex-col divide-y divide-border\/40">/);
  // The wait draws the same head, so the rows do not move at the hand-off.
  assert.match(read('detail', 'states.tsx'), /<FileListHead \/>\s*<div className="mt-1">\s*<FolderStreamSkeleton \/>/);
});

test('the Folders page header is "Folders" with Upload and New folder, and the files continue the list', () => {
  const browser = read('list', 'FoldersBrowser.tsx');
  assert.match(browser, /<ScreenTitle className="mb-0 min-w-0 truncate" \/>\s*\{actions\}/);
  assert.match(browser, /<PageShell actions=\{actions\}>/);
  assert.doesNotMatch(browser, /'folder' : 'folders'|No more folders/);
  assert.match(browser, /<FileListHead dateLabel=\{FOLDERS_DATE_LABEL\} \/>/);
  assert.match(read('list', 'states.tsx'), /export const FOLDERS_DATE_LABEL = 'Modified';/);
  const fallback = read('list', 'FoldersFallback.tsx');
  assert.match(fallback, /<ScreenTitle className="mb-0 min-w-0 truncate" \/>\s*<div className="flex shrink-0 items-center gap-2">/);
});

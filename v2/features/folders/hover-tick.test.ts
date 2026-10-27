import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* A tick box on hover to select a folder (Arthur, 27 October 2026: "hovering
 * over an item should show the tick at the side of the item just as it shows
 * the three dots"): on a computer, a folder row's hover or focus shows a tick
 * box beside the "⋯"; ticking it starts select mode with that folder ticked.
 * On a touch screen nothing changes. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the box is drawn only where the pointer can hover, and shows on hover or focus', () => {
  const row = read('file-list', 'FileListRow.tsx');
  assert.match(row, /\{!select && onStartSelect \? \(\s*<span className="hidden size-9 shrink-0 items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 \[@media\(hover:hover\)\]:flex">/);
  // A real tick box with the row's name, so a keyboard reaches it and a screen reader names it.
  assert.match(row, /<Checkbox\s*checked=\{false\}\s*onCheckedChange=\{onStartSelect\}\s*aria-label=\{`Select \$\{name\}`\}\s*\/>/);
});

test('ticking it starts select mode with that folder ticked', () => {
  const selection = readFileSync(join(here, '..', 'bulk', 'use-bulk-selection.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(selection, /const startWith = useCallback\(\(key: K\) => \{\s*setRaw\(new Set\(\[key\]\)\);\s*setActive\(true\);\s*\}, \[\]\);/);
  assert.match(read('list', 'folders-bulk.tsx'), /startWith: select\.startWith,/);
  const browser = read('list', 'FoldersBrowser.tsx');
  assert.match(browser, /const startWithFolder = useCallback\(\(uuid: string\) => startWith\(folderKey\(uuid\)\), \[startWith\]\);/);
  // Offered only before selecting; once selecting, every row shows its own box.
  assert.match(browser, /onToggleSelect=\{selecting \? toggleFolder : undefined\}\s*onStartSelect=\{selecting \? undefined : startWithFolder\}/);
  assert.match(read('list', 'FolderRow.tsx'), /onStartSelect=\{onStartSelect \? \(\) => onStartSelect\(row\.uuid\) : undefined\}/);
});

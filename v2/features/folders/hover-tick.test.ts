import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { escapeClearsSelection, selectAllState, selectAllToggled, stillSelecting } from '../bulk/model';
import { tickCircleClass, tickGutterClass } from './file-list/tick-gutter';

/* The tick is on the left (Arthur, 29 October 2026, 07:05Z, thread 8aa04be0:
 * "the tick box appears on the right and i have to go all the left to
 * continue ticking others and also the way to untick all is unintuitive ...
 * put the ticks to the left of the items. also why is there no tick in the
 * space folder"). It replaces the right-side hover tick of 27 October. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');
const fromRoot = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the tick column shows while ticking, else only where the pointer can hover', () => {
  assert.equal(tickGutterClass(true), 'flex');
  assert.equal(tickGutterClass(false), 'hidden [@media(hover:hover)]:flex');
  // While ticking every circle shows; before that a row's shows on its hover or focus.
  assert.equal(tickCircleClass(true), 'opacity-100');
  assert.match(tickCircleClass(false), /^opacity-0 .*group-hover:opacity-100 group-focus-within:opacity-100$/);
});

test('the head tick reads none, some or all, and ticks all or clears all', () => {
  const rows = ['a', 'b', 'c'];
  assert.equal(selectAllState(new Set<string>(), rows), false);
  assert.equal(selectAllState(new Set(['b']), rows), 'indeterminate');
  assert.equal(selectAllState(new Set(rows), rows), true);
  assert.deepEqual([...selectAllToggled(new Set(['b']), rows)].sort(), rows);
  assert.equal(selectAllToggled(new Set(rows), rows).size, 0);
});

test('select mode begun from a tick ends with the last tick cleared; begun from Select it waits for Done', () => {
  assert.equal(stillSelecting({ active: true, origin: 'tick', count: 2 }), true);
  assert.equal(stillSelecting({ active: true, origin: 'tick', count: 0 }), false);
  assert.equal(stillSelecting({ active: true, origin: 'button', count: 0 }), true);
  assert.equal(stillSelecting({ active: false, origin: 'button', count: 0 }), false);
});

test('Escape clears the ticks, but not while typing or with a dialog or menu open', () => {
  const press = { key: 'Escape', defaultPrevented: false, typing: false, layerOpen: false };
  assert.equal(escapeClearsSelection(press), true);
  assert.equal(escapeClearsSelection({ ...press, key: 'Enter' }), false);
  assert.equal(escapeClearsSelection({ ...press, typing: true }), false);
  assert.equal(escapeClearsSelection({ ...press, layerOpen: true }), false);
  assert.equal(escapeClearsSelection({ ...press, defaultPrevented: true }), false);
  const hook = fromRoot('v2', 'features', 'bulk', 'use-bulk-selection.ts');
  assert.match(hook, /document\.addEventListener\('keydown', onKeyDown\);\s*return \(\) => document\.removeEventListener\('keydown', onKeyDown\);/);
  assert.match(hook, /if \(escapeClearsSelection\(press\)\) stop\(\);/);
});

test('the round tick sits before the icon, and no tick is left on the right', () => {
  const row = read('file-list', 'FileListRow.tsx');
  const body = row.slice(row.indexOf('  return (\n    <li'), row.indexOf('export function FileListHead'));
  // The column comes first in the row, before the open control that holds the icon.
  const gutter = body.indexOf('<span className={cn(TICK_GUTTER_WIDTH');
  assert.ok(gutter > 0 && gutter < body.indexOf('renderOpen(FILE_LIST_OPEN_CLASS, content)'));
  assert.ok(gutter < body.indexOf('<label htmlFor={tickId}'));
  // After the open control only the "⋯" slot remains: no tick there.
  const after = body.slice(body.indexOf('renderOpen(FILE_LIST_OPEN_CLASS, content)'));
  assert.doesNotMatch(after, /RowTick|Checkbox/);
  assert.doesNotMatch(row, /\{!select && onStartSelect \? \(\s*<span className="hidden size-9/);
  // Round, and named by the row.
  assert.match(row, /className=\{cn\('size-\[18px\] rounded-full', className\)\}/);
  assert.equal((body.match(/aria-label=\{`Select \$\{name\}`\}/g) ?? []).length, 2);
});

test('the list head carries the select-all tick in the same column', () => {
  const row = read('file-list', 'FileListRow.tsx');
  const head = row.slice(row.indexOf('export function FileListHead'), row.indexOf('function RowTick'));
  assert.ok(head.indexOf('<RowTick') < head.indexOf('Name</span>'));
  assert.match(head, /checked=\{selectAll\.state\}\s*onCheckedChange=\{selectAll\.onToggle\}\s*aria-label=\{selectAll\.label\}/);
  // Before ticking, the head's tick starts select mode with every row ticked.
  for (const parts of [
    ['list', 'folders-bulk.tsx'],
    ['detail', 'folder-items-bulk.tsx'],
  ] as const) {
    assert.match(read(...parts), /onToggle: select\.active \? select\.toggleAll : select\.startAll,/);
  }
  assert.match(read('list', 'FoldersBrowser.tsx'), /<FileListHead dateLabel=\{FOLDERS_DATE_LABEL\} selectAll=\{bulk\.headSelectAll\} \/>/);
  assert.match(read('detail', 'FolderScreen.tsx'), /<FileListHead selectAll=\{canManageItems && itemRows\.length > 0 \? bulk\.headSelectAll : undefined\} \/>/);
});

test('ticking a row starts select mode with that row ticked, on every folder list', () => {
  const selection = fromRoot('v2', 'features', 'bulk', 'use-bulk-selection.ts');
  assert.match(selection, /const startWith = useCallback\(\(key: K\) => \{\s*setRaw\(new Set\(\[key\]\)\);\s*setOrigin\('tick'\);\s*setStarted\(true\);\s*\}, \[\]\);/);
  const browser = read('list', 'FoldersBrowser.tsx');
  assert.match(browser, /onToggleSelect=\{selecting \? toggleFolder : undefined\}\s*onStartSelect=\{selecting \? undefined : startWithFolder\}/);
  assert.match(browser, /selection=\{looseSelection\}\s*onStartSelect=\{startWithFile\}/);
  assert.match(read('list', 'FolderRow.tsx'), /onStartSelect=\{onStartSelect \? \(\) => onStartSelect\(row\.uuid\) : undefined\}/);
  // Inside a folder, the reader's own or a Space's, for whoever may take items out.
  const screen = read('detail', 'FolderScreen.tsx');
  assert.match(screen, /onStartSelect=\{canManageItems && !selecting \? startWithItem : undefined\}/);
  // A subfolder cannot be ticked there, but keeps the column so the names line up.
  assert.match(screen, /onRename=\{openRename\}\s*selecting=\{selecting\}/);
});

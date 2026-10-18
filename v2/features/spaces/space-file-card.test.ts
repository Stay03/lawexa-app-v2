import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Tapping a file in a space's list opens its card (Stay, 18 October 2026,
 * 12:50 UTC, option a): its name, type, size and uploader, "Open file", and
 * the ⋮ with the file's actions. No row in the list has a "…". */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const card = () => read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceFileCard.tsx');
const panel = () => read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');

test('the card: a bottom sheet with the name, the facts, the ⋮ and "Open file"', () => {
  const source = card();
  assert.match(source, /<SheetContent\s+side="bottom"\s+showCloseButton=\{false\}/);
  assert.match(source, /<SheetTitle[^>]*>\{file\.original_name\}<\/SheetTitle>/);
  assert.match(source, /\{type\} · \{formatBytes\(file\.size\)\} ·/);
  assert.match(source, /<span className="min-w-0 truncate">\{file\.uploader\.name\}<\/span>/);
  assert.match(source, /<SpaceFileMenu\s+file=\{file\}/);
  assert.match(source, /onClick=\{\(\) => open\(file\.id\)\}\s+disabled=\{opening\}/);
  assert.match(source, /Open file/);
});

test('the open: the tap-first opener, its refusals under the button', () => {
  const source = card();
  assert.match(source, /const \{ open, opening, failed, gone \} = useOpenFileInNewTab\(\);/);
  // A gone file says so and offers no button; a refused open offers Try again.
  assert.match(source, /\{gone \? \(\s*<p role="status"[^>]*>\s*This file is no longer available\./);
  assert.match(source, /\{failed \? \([\s\S]*?Couldn&rsquo;t open it\.[\s\S]*?Try again/);
  // A fresh opener per file, so one file's failure never shows on the next.
  assert.match(source, /<CardBody key=\{file\.id\}/);
});

test('an action closes the card before its own dialog opens', () => {
  const source = card();
  assert.match(source, /\(target: SpaceFile\) => \{\s*close\(\);\s*act\(target\);\s*\}/);
  for (const handler of ['onMove', 'onRemoveFromSpace', 'onCopyToMine', 'onDelete']) {
    assert.match(source, new RegExp(`${handler}=\\{then\\(actions\\.${handler}\\)\\}`));
  }
});

test('the ⋮ is the vertical dots, named for its file', () => {
  const menu = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceFileMenu.tsx');
  assert.match(menu, /<MoreVertical aria-hidden className="size-4" \/>/);
  assert.match(menu, /aria-label=\{`More actions for \$\{file\.original_name\}`\}/);
  assert.doesNotMatch(menu, /MoreHorizontal/);
});

test('the list holds one card, keeps its file while it closes, and gives it the row rules', () => {
  const source = panel();
  assert.match(source, /useState<\{ file: SpaceFile; row: HTMLElement; bottomClearance: number; open: boolean \} \| null>\(\s*null,\s*\)/);
  assert.match(source, /setCard\(\{ file, row, bottomClearance, open: true \}\);/);
  // The card keeps clear of the space's floating message box (measured at the tap).
  assert.match(source, /document\.querySelector\('\[data-space-chat-dock\]'\)/);
  assert.match(source, /anchor=\{card\?\.row \?\? null\}/);
  assert.match(source, /onOpenChange=\{\(open\) => setCard\(\(previous\) => \(previous \? \{ \.\.\.previous, open \} : previous\)\)\}/);
  assert.match(source, /actions=\{card \? fileActions\(card\.file\) : \{\}\}/);
  // The same rules the row's "…" had: move for the uploader, remove for the
  // Owner, copy for every member, delete where the role allows.
  assert.match(source, /onMove: ownsItem\(file\.uploader\.id, viewerId\) \? moveFile : undefined,/);
  assert.match(source, /onRemoveFromSpace: canRemove \? removeFile : undefined,/);
  const rows = read('v2', 'features', 'spaces', 'detail', 'content', 'feed-rows.tsx');
  assert.match(rows, /openFile: \(file: SpaceFile, row: HTMLElement\) => void;/);
  assert.doesNotMatch(rows, /SpaceFileMenu|MoreHorizontal/);
});

test('on a computer the card hangs from the tapped row: 22rem, no overlay, one frame at a time', () => {
  // Stay, 18 October 2026, 19:46 UTC: option 1 ("horrible on web" was the
  // phone's sheet across the whole window over a dimmed app).
  const source = card();
  assert.match(source, /const wide = useCardBreakpoint\(\);/);
  assert.match(source, /if \(wide && anchorRef\) \{/);
  assert.match(source, /<PopoverAnchor virtualRef=\{anchorRef\} \/>/);
  assert.match(source, /side="bottom"\s+align="start"/);
  assert.match(source, /w-\[22rem\]/);
  assert.match(source, /collisionPadding=\{\{ top: 16, right: 16, bottom: bottomClearance, left: 16 \}\}/);
  assert.match(read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceFileMenu.tsx'), /<DropdownMenuContent align="end" collisionPadding=\{16\}>/);
  // The phone keeps the sheet; a popover has no overlay.
  assert.match(source, /<SheetContent\s+side="bottom"/);
  assert.doesNotMatch(source, /SheetOverlay|PopoverOverlay/);
  // The sheet's title belongs to its dialog; the popover's is a plain heading.
  assert.match(source, /<h2 className=\{titleClass\}>\{file\.original_name\}<\/h2>/);
  const query = read('v2', 'features', 'spaces', 'detail', 'content', 'use-card-breakpoint.ts');
  assert.match(query, /const QUERY = '\(min-width: 48rem\)';/);
  assert.match(query, /useSyncExternalStore\(subscribe, getSnapshot, getServerSnapshot\)/);
});

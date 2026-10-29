import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf8');

// Stay, 29 October 2026, 01:11Z, on the select bar: "those buttons are horrible".
const SCREENS = [
  ['v2', 'features', 'folders', 'list', 'folders-bulk.tsx'],
  ['v2', 'features', 'folders', 'detail', 'folder-items-bulk.tsx'],
  ['v2', 'features', 'conversations', 'list', 'conversations-bulk.tsx'],
  ['v2', 'features', 'notes', 'library', 'notes-bulk.tsx'],
  ['v2', 'features', 'spaces', 'detail', 'content', 'space-files-bulk.tsx'],
  ['v2', 'features', 'bookmarks', 'list', 'bookmarks-bulk.tsx'],
] as const;

test('the select bar is one quiet row: words never wrap, the count is "N selected", the rest is in More', () => {
  const bar = read('v2', 'features', 'bulk', 'BulkBar.tsx');
  assert.doesNotMatch(bar, /flex-wrap|flex-col/);
  assert.match(bar, /`\$\{count\} selected`/);
  // Every label holds one line, and a phone shows the icon alone.
  assert.match(bar, /const ACTION =\s*'[^']*whitespace-nowrap/);
  assert.match(bar, /<span aria-hidden className="max-sm:hidden">\s*\{label\}/);
  assert.match(bar, /aria-label="More actions"/);
  // Red is for a destructive action's word, never a border or a fill.
  assert.match(bar, /destructive \? 'text-destructive hover:bg-destructive\/10' : 'text-foreground'/);
  assert.doesNotMatch(bar, /border border-border px-3 text-xs/);
});

test('every screen keeps only its main actions on the bar and the rest in More', () => {
  for (const parts of SCREENS) {
    const screen = read(...parts);
    const chats = parts.at(-1) === 'conversations-bulk.tsx';
    for (const word of ['Move to a space', 'Make private', 'Make public', 'Unpublish', 'Remove from space']) {
      if (chats && word === 'Move to a space') continue;
      assert.doesNotMatch(screen, new RegExp(`<BulkBarAction[^>]*label="${word}"`), `${parts.at(-1)}: ${word} belongs in More`);
    }
  }
  // A chat's one move is into a space: it stays beside Delete.
  assert.match(read(...SCREENS[2]), /<BulkBarAction icon=\{Blocks\} label="Move to a space"/);
});

test('nothing shows behind the bar: the Folders search pill steps aside while rows are ticked', () => {
  const folders = read('v2', 'features', 'folders', 'list', 'FoldersBrowser.tsx');
  assert.match(folders, /\{searchAtTop \|\| selecting \? null : \(\s*<ScreenDock>/);
  for (const parts of [
    ['v2', 'features', 'notes', 'library', 'NotesBrowser.tsx'],
    ['v2', 'features', 'conversations', 'list', 'ConversationsList.tsx'],
  ] as const) {
    assert.match(read(...parts), /\{searchAtTop \|\| (bulk\.)?selecting \? null : \(/);
  }
});

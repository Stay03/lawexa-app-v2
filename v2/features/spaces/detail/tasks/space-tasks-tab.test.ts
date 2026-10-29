import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf8');

test('the Tasks pill draws the task board, with no feed read, no file drop and no message box', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  // The owner and editors work the board; the Thread field lists rooms only
  // where the space shows them.
  assert.match(
    panel,
    /tab === 'tasks' \? \(\s*<SpaceTasksPanel spaceUuid=\{space\.uuid\} canEdit=\{access\.canAdd\} rooms=\{rooms\} \/>/,
  );
  assert.match(panel, /const OWN_LIST_TABS: ReadonlySet<SpaceTab> = new Set<SpaceTab>\(\['people', 'radars', 'tasks'\]\);/);
  assert.match(panel, /enabled: enabled && !ownList,/);
  assert.match(panel, /access\.canAdd && !ownList \?/);
  // The message box is for chats, folders and Radars, not for the board.
  assert.match(panel, /const DOCK_TABS: ReadonlySet<SpaceTab> = new Set<SpaceTab>\(\['all', 'conversations', 'folders', 'radars'\]\);/);
});

test('the board reads one list, and its only colour is each stage’s thread-status dot', () => {
  const queries = read('v2', 'features', 'spaces', 'queries.ts');
  assert.match(queries, /queryKey: \[\.\.\.spacesQueries\.tasksOf\(spaceUuid\), \{ viewerId \}\] as const,/);
  const api = read('lib', 'api', 'collab.ts');
  assert.match(api, /`\/spaces\/\$\{encodeURIComponent\(spaceUuid\)\}\/tasks`/);
  // Stay's B (29 October 2026): no chips, badges or coloured fills; the stage
  // colour is the small dot in a column's head and the phone's switcher.
  const board = read('v2', 'features', 'spaces', 'detail', 'tasks', 'SpaceTasksPanel.tsx');
  assert.doesNotMatch(board, /<ThreadStatusChip\b/);
  const dots = board.match(/<ThreadStatusDot [^>]*\/>/g) ?? [];
  assert.equal(dots.length, 3);
  for (const tag of dots) assert.match(tag, /value=\{TASK_STAGE_TONE(\[[\w.]+\]|\.done)\}/);
});

test('every pill keeps the same page column; only the board widens, so the pills never jump', () => {
  // Arthur, 29 October 2026, 19:11Z: on Tasks the whole page moved ~90px left
  // and his next click landed on the wrong pill.
  const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
  assert.match(screen, /<div className=\{SPACE_PANE\}>\s*<div className=\{SPACE_PAGE_COLUMN\}>/);
  assert.doesNotMatch(screen, /tab === 'tasks' \?/);
  assert.doesNotMatch(screen, /SPACE_BOARD_COLUMN/);
  const parts = read('v2', 'features', 'spaces', 'detail', 'lobby-parts.tsx');
  assert.match(parts, /export const SPACE_PANE = '@container /);
  assert.match(parts, /export const SPACE_BOARD_BLEED =\s*'md:mx-\[calc\(\(100%_-_min\(72rem,_100cqw_-_2rem\)\)_\/_2\)\]';/);
  // The bleed wraps the board alone: the filter row stays in the column.
  const board = read('v2', 'features', 'spaces', 'detail', 'tasks', 'SpaceTasksPanel.tsx');
  assert.match(board, /<div className=\{SPACE_BOARD_BLEED\}>\s*<Board /);
});

test('the board follows .task.changed on the space channel, and the last board to unmount leaves it', () => {
  const protocol = read('v2', 'runtime', 'realtime', 'protocol.ts');
  assert.match(protocol, /export function spaceChannelName\(spaceUuid: string\): string \{\s*return `spaces\.\$\{spaceUuid\}`;/);
  assert.match(protocol, /export const EVT_TASK_CHANGED = '\.task\.changed';/);
  const live = read('v2', 'features', 'spaces', 'detail', 'tasks', 'use-task-board-live.ts');
  assert.match(live, /const echo = getV2Echo\(\);\s*if \(!echo\) return;/);
  assert.match(
    live,
    /const name = spaceChannelName\(spaceUuid\);\s*const channel = echo\.private\(name\);\s*channel\.listen\(EVT_TASK_CHANGED, onChanged\);\s*retainChannel\(name\);/,
  );
  // The uuids seen deleted go with every event, so a late update cannot revive one.
  assert.match(live, /if \(event\.action === 'deleted'\) deleted\.add\(event\.task\.uuid\);/);
  assert.match(live, /applyTaskChanged\(list, event, deleted\)/);
  // The techlead's review and recheck: stop this listener, and leave only when no board listens.
  assert.match(
    live,
    /return \(\) => \{\s*channel\.stopListening\(EVT_TASK_CHANGED, onChanged\);\s*if \(releaseChannel\(name\) === 0\) echo\.leave\(name\);\s*\};/,
  );
  const board = read('v2', 'features', 'spaces', 'detail', 'tasks', 'SpaceTasksPanel.tsx');
  assert.match(board, /useTaskBoardLive\(spaceUuid, session\.userId, eligible\);/);
});

test('a card opens the task sheet, and only the owner and editors get New task', () => {
  const board = read('v2', 'features', 'spaces', 'detail', 'tasks', 'SpaceTasksPanel.tsx');
  assert.match(board, /<button\s+type="button"\s+onClick=\{onOpen\}/);
  assert.match(board, /const newTask = canEdit \? \(\) => openSheet\(\{ kind: 'new' \}\) : null;/);
  const sheet = read('v2', 'features', 'spaces', 'detail', 'tasks', 'TaskSheet.tsx');
  // A viewer gets no Save, Delete or queue moves.
  assert.match(sheet, /\{canEdit \? \(\s*<SheetFooter/);
  assert.match(sheet, /\{task && canEdit && task\.stage === 'queued' \? <QueueOrder/);
  // Right on a computer, bottom on a phone, as the case page's panel picks.
  assert.match(sheet, /const side = useSheetSide\(\);/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf8');

test('the Tasks pill draws the task board, with no feed read, no file drop and no message box', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(panel, /tab === 'tasks' \? \(\s*<SpaceTasksPanel spaceUuid=\{space\.uuid\} \/>/);
  assert.match(panel, /const OWN_LIST_TABS: ReadonlySet<SpaceTab> = new Set<SpaceTab>\(\['people', 'radars', 'tasks'\]\);/);
  assert.match(panel, /enabled: enabled && !ownList,/);
  assert.match(panel, /access\.canAdd && !ownList \?/);
  // The message box is for chats, folders and Radars, not for the board.
  assert.match(panel, /const DOCK_TABS: ReadonlySet<SpaceTab> = new Set<SpaceTab>\(\['all', 'conversations', 'folders', 'radars'\]\);/);
});

test('the board reads one list, and its stage chip is the thread status chip under the stage’s word', () => {
  const queries = read('v2', 'features', 'spaces', 'queries.ts');
  assert.match(queries, /queryKey: \[\.\.\.spacesQueries\.tasksOf\(spaceUuid\), \{ viewerId \}\] as const,/);
  const api = read('lib', 'api', 'collab.ts');
  assert.match(api, /`\/spaces\/\$\{encodeURIComponent\(spaceUuid\)\}\/tasks`/);
  const chip = read('v2', 'features', 'collab', 'kit', 'ThreadStatusChip.tsx');
  assert.match(chip, /\{label \?\? threadStatusLabel\(value\)\}/);
  // No new colours (techlead, 28 October 2026): every chip on the board takes a stage's thread tone.
  const board = read('v2', 'features', 'spaces', 'detail', 'tasks', 'SpaceTasksPanel.tsx');
  const chips = board.match(/<ThreadStatusChip [^>]*\/>/g) ?? [];
  assert.equal(chips.length, 2);
  for (const tag of chips) assert.match(tag, /value=\{TASK_STAGE_TONE\[[\w.]+\]\} label=\{TASK_STAGE_LABELS\[[\w.]+\]\}/);
});

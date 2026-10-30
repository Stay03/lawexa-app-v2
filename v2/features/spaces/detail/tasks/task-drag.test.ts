import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SpaceTask } from '@/types/collab';
import {
  changedWhileDragged,
  DRAG_WORDS,
  dropId,
  dropOutcome,
  HOLD_TO_DRAG_MS,
  movedTask,
  POINTER_DRAG_DISTANCE,
  stageBeside,
  stageOfDrop,
} from './task-drag-model';

/* Dragging a card to another column changes its stage (Arthur, 30 October
 * 2026, 18:38Z, thread 7aa0c6d8; the plan d589d99c, approved with the task
 * box, 11aefe48). */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const here = (file: string) => read('v2', 'features', 'spaces', 'detail', 'tasks', file);

const task = (over: Partial<SpaceTask> = {}): SpaceTask =>
  ({
    uuid: 't1',
    title: 'TEST DATA Draft the lease',
    stage: 'working',
    stage_note: null,
    waiting_on: null,
    owner: null,
    thread: null,
    position: 1,
    started_at: null,
    stage_changed_at: '2026-10-30T10:00:00Z',
    stage_changed_by: null,
    via: 'app',
    ...over,
  }) as SpaceTask;

test('a drop target names its stage, from a column, a phone tab or the folded Done strip', () => {
  assert.equal(stageOfDrop(dropId('column', 'paused')), 'paused');
  assert.equal(stageOfDrop(dropId('tab', 'done')), 'done');
  assert.equal(stageOfDrop(dropId('strip', 'done')), 'done');
  assert.equal(stageOfDrop('column:archived'), null);
  assert.equal(stageOfDrop('t1'), null, 'a card is not a target');
  assert.equal(stageOfDrop(undefined), null);
});

test('Working, Queued and Done move at once; Paused and Waiting ask first; the same column does nothing', () => {
  assert.deepEqual(dropOutcome(task(), 'working'), { kind: 'none' });
  assert.deepEqual(dropOutcome(task(), 'done'), { kind: 'move', stage: 'done', payload: { stage: 'done' } });
  const paused = dropOutcome(task(), 'paused');
  assert.equal(paused.kind, 'ask');
  // The sheet's own rule: a new stage starts with an empty note.
  if (paused.kind === 'ask') assert.equal(paused.draft.stageNote, '');
  assert.equal(dropOutcome(task(), 'waiting').kind, 'ask');
  // Leaving Paused sends only the stage: the server clears the reason itself.
  const leaving = dropOutcome(task({ stage: 'paused', stage_note: 'Back after the hearing' }), 'queued');
  assert.deepEqual(leaving, { kind: 'move', stage: 'queued', payload: { stage: 'queued' } });
});

test('the card moves at once as the server will have it, and keeps its time when the stage stays', () => {
  const moved = movedTask(task({ stage: 'paused', stage_note: 'Why' }), { stage: 'done' }, '2026-10-30T11:00:00Z');
  assert.equal(moved.stage, 'done');
  assert.equal(moved.stage_note, null, 'leaving Paused clears the reason');
  assert.equal(moved.waiting_on, null);
  assert.equal(moved.stage_changed_at, '2026-10-30T11:00:00Z');
  const person = { uuid: 'u2', name: 'TEST DATA Editor', username: null, avatar_url: null, is_agent: false };
  const waiting = movedTask(task(), { stage: 'waiting', waiting_on: 'u2', stage_note: 'A or B' }, '2026-10-30T11:00:00Z', person);
  assert.equal(waiting.waiting_on?.name, 'TEST DATA Editor');
  assert.equal(waiting.stage_note, 'A or B');
  assert.equal(movedTask(task(), { title: 'New' }, 'later').stage_changed_at, '2026-10-30T10:00:00Z');
});

test('a change by someone else while the card is in the air cancels the drop', () => {
  const start = task();
  assert.equal(changedWhileDragged(start, task()), false);
  assert.equal(changedWhileDragged(start, undefined), true, 'deleted meanwhile');
  assert.equal(changedWhileDragged(start, task({ stage: 'done' })), true);
  assert.equal(changedWhileDragged(start, task({ stage_changed_at: '2026-10-30T10:05:00Z' })), true);
  assert.equal(changedWhileDragged(start, task({ title: 'Renamed' })), true);
});

test('the keyboard steps one column at a time and stops at the ends', () => {
  assert.equal(stageBeside('working', 1), 'paused');
  assert.equal(stageBeside('working', -1), 'working');
  assert.equal(stageBeside('queued', 1), 'done');
  assert.equal(stageBeside('done', 1), 'done');
  assert.match(DRAG_WORDS.instructions, /Space to pick it up, Left or Right/);
  assert.equal(DRAG_WORDS.end('T', 'waiting'), 'Dropped “T” in Waiting.');
});

test('a mouse drags after 8px, a finger after a 300ms hold, the keyboard on Space only', () => {
  assert.equal(POINTER_DRAG_DISTANCE, 8);
  assert.equal(HOLD_TO_DRAG_MS, 300);
  const dnd = here('board-dnd.ts');
  assert.match(dnd, /event\.pointerType !== 'touch' && !fromNoDrag\(event\.target\)/);
  assert.match(dnd, /activationConstraint: \{ delay: HOLD_TO_DRAG_MS, tolerance: 8 \}/);
  // Enter stays the key that opens the task.
  assert.match(dnd, /keyboardCodes: \{ start: \['Space'\], cancel: \['Escape'\], end: \['Space'\] \}/);
  // Nothing inside [data-no-dnd] (the card's rename field) starts a drag.
  assert.match(dnd, /target\.closest\('\[data-no-dnd\]'\) !== null/);
});

test('the board: owners and editors drag, every column and phone tab takes a drop, and the move is optimistic', () => {
  const board = here('SpaceTasksPanel.tsx');
  assert.match(board, /useDraggable\(\{\s*id: task\.uuid,\s*data: \{ task \},\s*disabled: !canDrag,\s*\}\)/);
  assert.match(board, /canDrag=\{canEdit\}/);
  assert.match(board, /useDroppable\(\{ id: dropId\('column', stage\), disabled: !canDrag \}\)/);
  assert.match(board, /useDroppable\(\{ id: dropId\('tab', stage\), disabled: !droppable \}\)/);
  assert.match(board, /id: dropId\('strip', 'done'\),/);
  assert.match(board, /if \(!current \|\| changedWhileDragged\(start, current\)\) \{\s*toast\(MOVED_BY_SOMEONE_ELSE\);/);
  assert.match(board, /shown: movedTask\(task, payload, new Date\(\)\.toISOString\(\), waitingOn\)/);
  const mutations = here('task-mutations.ts');
  assert.match(mutations, /onMutate: async \(\{ shown \}\) => \{[\s\S]*?write\(\(list\) => upsertTask\(list, shown\)\);/);
  assert.match(mutations, /onError: \(_error, \{ task \}\) => write\(\(list\) => upsertTask\(list, task\)\),/);
});

test('Paused and Waiting ask with the sheet’s own fields and checks', () => {
  const dialog = here('TaskMoveDialog.tsx');
  assert.match(dialog, /import \{ ChoiceSelect, FieldBlock \} from '\.\/TaskSheet';/);
  assert.match(dialog, /const found = checkDraft\(draft\);/);
  assert.match(dialog, /const payload = updatePayload\(draft, pending\.task\);/);
  assert.match(dialog, /label=\{waiting \? 'Note \(optional\)' : 'Why is it paused\?'\}/);
});

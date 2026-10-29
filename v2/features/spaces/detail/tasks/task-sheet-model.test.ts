import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { SpaceTask, SpaceTaskMove, SpaceTaskPerson } from '@/types/collab';
import {
  checkDraft,
  createPayload,
  draftFromTask,
  hasErrors,
  moveLine,
  serverFieldErrors,
  updatePayload,
  type TaskDraft,
} from './task-sheet-model';

const person = (uuid: string, name: string, is_agent = false): SpaceTaskPerson => ({
  uuid,
  name,
  username: null,
  avatar_url: null,
  is_agent,
});
const ADA = person('u-ada', 'Ada Obi');
const BACKEND = person('u-backend', 'Backend Claude', true);
const STAY = person('u-stay', 'Stay');

function task(overrides: Partial<SpaceTask> = {}): SpaceTask {
  return {
    uuid: 't1',
    title: 'Task board',
    stage: 'queued',
    stage_note: null,
    waiting_on: null,
    owner: ADA,
    thread: null,
    position: 0,
    started_at: null,
    stage_changed_at: '2026-10-29T10:00:00Z',
    stage_changed_by: null,
    via: 'app',
    created_at: '2026-10-28T10:00:00Z',
    created_by: null,
    ...overrides,
  };
}

const draft = (overrides: Partial<TaskDraft> = {}): TaskDraft => ({ ...draftFromTask(task(), null), ...overrides });

test('a new task starts in Queued with the viewer as its owner', () => {
  assert.deepEqual(draftFromTask(null, 'u-me'), {
    title: '',
    stage: 'queued',
    stageNote: '',
    waitingOn: null,
    owner: 'u-me',
    thread: null,
  });
});

test('the title is required and at most 200 characters', () => {
  assert.equal(checkDraft(draft({ title: '   ' })).title, 'Give the task a title.');
  assert.match(checkDraft(draft({ title: 'x'.repeat(201) })).title ?? '', /200/);
  assert.equal(hasErrors(checkDraft(draft())), false);
});

test('paused needs a reason; waiting needs a person and not a note', () => {
  assert.equal(checkDraft(draft({ stage: 'paused' })).stage_note, 'Say why it is paused.');
  assert.equal(hasErrors(checkDraft(draft({ stage: 'paused', stageNote: 'Switched' }))), false);
  const waiting = checkDraft(draft({ stage: 'waiting' }));
  assert.equal(waiting.waiting_on, 'Choose who it is waiting on.');
  assert.equal(waiting.stage_note, undefined);
  assert.equal(hasErrors(checkDraft(draft({ stage: 'waiting', waitingOn: 'u-stay' }))), false);
  assert.match(checkDraft(draft({ stage: 'waiting', waitingOn: 'u-stay', stageNote: 'x'.repeat(141) })).stage_note ?? '', /140/);
});

test('a 422 puts the server’s first message under each field the sheet shows', () => {
  assert.deepEqual(
    serverFieldErrors({ waiting_on: ['Must be an active member.', 'Second'], other: ['Ignored'] }),
    { waiting_on: 'Must be an active member.' },
  );
  assert.deepEqual(serverFieldErrors(null), {});
});

test('a new task sends only the fields that say something', () => {
  assert.deepEqual(createPayload(draftFromTask(null, 'u-me')), { title: '', stage: 'queued', owner: 'u-me' });
  assert.deepEqual(
    createPayload({ ...draftFromTask(null, null), title: ' Fix it ', stage: 'waiting', waitingOn: 'u-stay', stageNote: ' A or B ' }),
    { title: 'Fix it', stage: 'waiting', stage_note: 'A or B', waiting_on: 'u-stay' },
  );
});

test('Save sends only what changed, with null to clear, and nothing when nothing changed', () => {
  const saved = task({ thread: { uuid: 'th1', name: 'Board', channel_uuid: 'c1' } });
  assert.equal(updatePayload(draftFromTask(saved, null), saved), null);
  assert.deepEqual(updatePayload({ ...draftFromTask(saved, null), owner: null, thread: null }, saved), {
    owner: null,
    thread: null,
  });
  assert.deepEqual(updatePayload({ ...draftFromTask(saved, null), stage: 'paused', stageNote: 'Later' }, saved), {
    stage: 'paused',
    stage_note: 'Later',
  });
  // Leaving Waiting sends the stage only: the server clears the person and the note.
  const waiting = task({ stage: 'waiting', waiting_on: STAY, stage_note: 'A or B' });
  assert.deepEqual(updatePayload({ ...draftFromTask(waiting, null), stage: 'working' }, waiting), { stage: 'working' });
  // A changed person while still waiting goes alone.
  assert.deepEqual(updatePayload({ ...draftFromTask(waiting, null), waitingOn: 'u-ada' }, waiting), {
    waiting_on: 'u-ada',
  });
});

const move = (overrides: Partial<SpaceTaskMove>): SpaceTaskMove => ({
  from: 'queued',
  to: 'working',
  from_owner: BACKEND,
  to_owner: BACKEND,
  note: null,
  by: BACKEND,
  via: 'agent',
  at: '2026-10-29T10:00:00Z',
  ...overrides,
});

test('a history line says who moved it and where, in plain words', () => {
  assert.equal(moveLine(move({})), 'Backend Claude moved it from Queued to Working');
  assert.equal(moveLine(move({ from: null, to: 'queued', by: STAY })), 'Stay added it to Queued for Backend Claude');
  assert.equal(
    moveLine(move({ from: 'queued', to: 'queued', from_owner: null, to_owner: ADA, by: STAY })),
    'Stay gave it to Ada Obi',
  );
  assert.equal(moveLine(move({ from: 'queued', to: 'queued', from_owner: null, to_owner: STAY, by: STAY })), 'Stay took it');
  assert.equal(
    moveLine(move({ from: 'working', to: 'queued', to_owner: null, by: STAY })),
    'Stay moved it from Working to Queued and made it nobody’s',
  );
  assert.equal(moveLine(move({ by: null, from: 'working', to: 'done' })), 'Lawexa moved it from Working to Done');
  assert.equal(moveLine(move({ from: 'paused', to: 'paused', by: STAY })), 'Stay changed it in Paused');
});

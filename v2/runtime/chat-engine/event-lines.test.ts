import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ApiMessage, ChatMessage, ConversationData, EventMessage } from '@/types/chat';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import { isStorableAnswer } from '@/v2/runtime/persist/policy';
import { isTurnRow, lastTurnIndex, lastTurnRow, turnRowCount } from '@/v2/runtime/turn-rows';
import { createChatEngine } from './engine';
import { applySnapshotEvents, placeEvent, removeEvent } from './event-rows';
import type { EngineMessage } from './types';

/* The draft "edited" line (Stay, 30 October 2026, 02:16Z, thread 1e44eb39;
 * design 9b43f942): the server stores it as a message with role `event`. v2
 * draws a `draft_edit` row as a quiet line in its place in time; v1 never
 * receives one; any other event type is dropped. A line is never a turn, so
 * every "last row" rule reads the last turn. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const T0 = Date.parse('2026-10-30T10:00:00Z');
const iso = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString();

function turn(id: number, role: 'user' | 'assistant', minutes: number, content = `row ${id}`): ApiMessage {
  return { id, conversation_id: 'conv-1', agent_id: null, role, content, metadata: {}, created_at: iso(minutes) };
}

function line(id: number, minutes: number, extra: Partial<NonNullable<ApiMessage['metadata']>> = {}): ApiMessage {
  return {
    id,
    conversation_id: 'conv-1',
    agent_id: null,
    role: 'event',
    content: "Stay edited 'Lease agreement'",
    metadata: {
      type: 'draft_edit',
      note_uuid: 'note-1',
      draft_title: 'Lease agreement',
      editor: { uuid: 'u-stay', name: 'Stay' },
      first_edited_at: iso(minutes),
      last_edited_at: iso(minutes + 5),
      ...extra,
    },
    created_at: iso(minutes),
  };
}

function history(messages: ApiMessage[]): ConversationData {
  return { id: 'conv-1', title: 'Chat', messages } as ConversationData;
}

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

// ─── Transform ───────────────────────────────────────────────────────────────

test('v2 reads a draft_edit row as a line: its place is created_at, its time is last_edited_at', () => {
  const rows = transformApiMessages([turn(1, 'user', 0), line(9, 1), turn(2, 'assistant', 2)], { events: true });
  assert.deepEqual(ids(rows), ['msg_1', 'msg_9', 'msg_2']);
  const drawn = rows[1] as EventMessage;
  assert.equal(drawn.role, 'event');
  assert.equal(drawn.eventType, 'draft_edit');
  assert.equal(drawn.serverId, 9);
  assert.equal(drawn.editorName, 'Stay');
  assert.equal(drawn.editorUuid, 'u-stay');
  assert.equal(drawn.draftTitle, 'Lease agreement');
  assert.equal(drawn.noteUuid, 'note-1');
  assert.equal(drawn.timestamp.toISOString(), iso(1));
  assert.equal(drawn.editedAt.toISOString(), iso(6));
});

test('an event of another type is dropped, and so is a draft_edit row with no note', () => {
  const other = { ...line(9, 1), metadata: { type: 'tool_call' as const } };
  const noNote = line(10, 1, { note_uuid: undefined });
  const rows = transformApiMessages([turn(1, 'user', 0), other, noNote, turn(2, 'assistant', 2)], { events: true });
  assert.deepEqual(ids(rows), ['msg_1', 'msg_2']);
});

test('v1 never receives a line: without { events: true } every event row is dropped', () => {
  const rows = transformApiMessages([turn(1, 'user', 0), line(9, 1), turn(2, 'assistant', 2)]);
  assert.deepEqual(ids(rows), ['msg_1', 'msg_2']);
  assert.ok(rows.every((row) => row.role !== ('event' as string)));
  // v1's two callers pass no option.
  assert.doesNotMatch(read('lib', 'hooks', 'useChatStream.ts'), /events: true/);
  assert.doesNotMatch(read('components', 'ui', 'floating-prompt-input.tsx'), /events: true/);
});

test('a line between an answer and its steps does not turn the answer into narration', () => {
  const rows = transformApiMessages([turn(1, 'user', 0), turn(2, 'assistant', 1), line(9, 2)], { events: true });
  assert.deepEqual(ids(rows), ['msg_1', 'msg_2', 'msg_9']);
});

test('every transform in the engine asks for lines', () => {
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  const calls = [...engine.matchAll(/transformApiMessages\(([^)]*)\)/g)].map((match) => match[1]);
  assert.ok(calls.length >= 6);
  for (const args of calls) assert.match(args, /\{ events: true \}/, args);
});

// ─── Turn rows ───────────────────────────────────────────────────────────────

test('the last turn skips the lines after it', () => {
  const rows = transformApiMessages([turn(1, 'user', 0), line(9, 1), line(10, 2)], { events: true });
  assert.equal(lastTurnRow(rows)?.id, 'msg_1');
  assert.equal(lastTurnIndex(rows), 0);
  assert.equal(turnRowCount(rows), 1);
  assert.equal(isTurnRow(rows[1]), false);
  assert.equal(lastTurnRow([]), undefined);
  assert.equal(lastTurnIndex([{ role: 'event' }]), -1);
});

test('a chat whose last turn is a question is not kept on the device, though a line follows it', () => {
  const envelope = (messages: ApiMessage[]) => ({ success: true, data: { id: 'conv-1', messages } });
  assert.equal(isStorableAnswer(envelope([turn(1, 'user', 0), line(9, 1)])), false);
  assert.equal(isStorableAnswer(envelope([turn(1, 'user', 0), turn(2, 'assistant', 1), line(9, 2)])), true);
});

// ─── Placement (pure) ────────────────────────────────────────────────────────

const engineRows = (messages: ApiMessage[]) => transformApiMessages(messages, { events: true }) as EngineMessage[];
const lineRow = (id: number, minutes: number, extra?: Partial<NonNullable<ApiMessage['metadata']>>) =>
  transformApiMessages([line(id, minutes, extra)], { events: true })[0] as EventMessage;

test('a new line goes in its place in time, and a held one is replaced by id', () => {
  const rows = engineRows([turn(1, 'user', 0), turn(2, 'assistant', 2), turn(3, 'user', 4)]);
  const placed = placeEvent(rows, lineRow(9, 3));
  assert.deepEqual(ids(placed), ['msg_1', 'msg_2', 'msg_9', 'msg_3']);
  // A later save of the session: same place, new time and title.
  const moved = placeEvent(placed, lineRow(9, 3, { last_edited_at: iso(30), draft_title: 'Lease (final)' }));
  assert.deepEqual(ids(moved), ['msg_1', 'msg_2', 'msg_9', 'msg_3']);
  const drawn = moved[2] as EventMessage;
  assert.equal(drawn.draftTitle, 'Lease (final)');
  assert.equal(drawn.editedAt.toISOString(), iso(30));
  // The same line again changes nothing.
  assert.equal(placeEvent(moved, lineRow(9, 3, { last_edited_at: iso(30), draft_title: 'Lease (final)' })), moved);
});

test('a line never goes below an answer still being written', () => {
  const rows = engineRows([turn(1, 'user', 0)]);
  const streaming: EngineMessage = {
    id: 'local_1',
    role: 'assistant',
    content: '',
    timestamp: new Date(T0 + 60_000),
    isStreaming: true,
  } as ChatMessage;
  const placed = placeEvent([...rows, streaming], lineRow(9, 10));
  assert.deepEqual(ids(placed), ['msg_1', 'msg_9', 'local_1']);
});

test('a line is taken away by its server id, and the rows stay the same object when it is not held', () => {
  const rows = placeEvent(engineRows([turn(1, 'user', 0)]), lineRow(9, 1));
  assert.deepEqual(ids(removeEvent(rows, 9)), ['msg_1']);
  assert.equal(removeEvent(rows, 77), rows);
});

test('a snapshot places its lines, refreshes held ones, and takes away the ones it lacks unless unconfirmed', () => {
  const rows = placeEvent(placeEvent(engineRows([turn(1, 'user', 0), turn(2, 'assistant', 2)]), lineRow(8, 1)), lineRow(9, 3));
  const snapshot = engineRows([turn(1, 'user', 0), line(7, 0.5), turn(2, 'assistant', 2)]);
  // 8 is gone from the server; 9 was drawn from this screen's own save and not yet confirmed.
  const next = applySnapshotEvents(rows, snapshot, new Set(['msg_9']));
  assert.deepEqual(ids(next), ['msg_1', 'msg_7', 'msg_2', 'msg_9']);
  assert.equal(applySnapshotEvents(next, snapshot, new Set(['msg_9'])), next);
});

// ─── The engine ──────────────────────────────────────────────────────────────

test('the engine draws a saved line at once, replaces it by id, and takes it away', () => {
  const engine = createChatEngine({ getToken: () => 'test-token' });
  engine.adoptConversationHistory(history([turn(1, 'user', 0), turn(2, 'assistant', 2), turn(3, 'user', 4)]));
  assert.equal(engine.upsertEvent(line(9, 3)), true);
  assert.deepEqual(ids(engine.getSnapshot().messages), ['msg_1', 'msg_2', 'msg_9', 'msg_3']);
  assert.equal(engine.upsertEvent(line(9, 3, { last_edited_at: iso(20) })), true);
  const held = engine.getSnapshot().messages.find((row) => row.id === 'msg_9') as EventMessage;
  assert.equal(held.editedAt.toISOString(), iso(20));
  // Another chat's row, and an event of another type, change nothing.
  assert.equal(engine.upsertEvent({ ...line(10, 3), conversation_id: 'conv-2' }), false);
  assert.equal(engine.upsertEvent({ ...line(11, 3), metadata: { type: 'tool_call' } }), false);
  assert.equal(engine.removeEvent(9), true);
  assert.deepEqual(ids(engine.getSnapshot().messages), ['msg_1', 'msg_2', 'msg_3']);
  assert.equal(engine.removeEvent(9), false);
  engine.dispose();
});

test('a merge brings a colleague’s line in its place and refreshes it by id, with no turn added', () => {
  const engine = createChatEngine({ getToken: () => 'test-token' });
  const base = [turn(1, 'user', 0), turn(2, 'assistant', 2)];
  engine.adoptConversationHistory(history(base));
  assert.equal(engine.adoptConversationHistory(history([turn(1, 'user', 0), line(9, 1), turn(2, 'assistant', 2)])), false);
  assert.deepEqual(ids(engine.getSnapshot().messages), ['msg_1', 'msg_9', 'msg_2']);
  engine.adoptConversationHistory(
    history([turn(1, 'user', 0), line(9, 1, { last_edited_at: iso(40) }), turn(2, 'assistant', 2)]),
  );
  const held = engine.getSnapshot().messages.find((row) => row.id === 'msg_9') as EventMessage;
  assert.equal(held.editedAt.toISOString(), iso(40));
  // The server took the line away (the draft went back to Lawexa's version): the merge does too.
  engine.adoptConversationHistory(history(base));
  assert.deepEqual(ids(engine.getSnapshot().messages), ['msg_1', 'msg_2']);
  engine.dispose();
});

test('a merge keeps this screen’s own unconfirmed line, then follows the server once it has shown it', () => {
  const engine = createChatEngine({ getToken: () => 'test-token' });
  const base = [turn(1, 'user', 0), turn(2, 'assistant', 2)];
  engine.adoptConversationHistory(history(base));
  engine.upsertEvent(line(9, 3));
  // A snapshot read before the save: the line stays.
  engine.adoptConversationHistory(history([...base]));
  assert.deepEqual(ids(engine.getSnapshot().messages), ['msg_1', 'msg_2', 'msg_9']);
  // The server shows it, then takes it away.
  engine.adoptConversationHistory(history([...base, line(9, 3)]));
  engine.adoptConversationHistory(history([...base]));
  assert.deepEqual(ids(engine.getSnapshot().messages), ['msg_1', 'msg_2']);
  engine.dispose();
});

test('a line under the question leaves the turn unanswered for followUntilAnswered', () => {
  const source = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  const follow = source.slice(source.indexOf('function followUntilAnswered('));
  assert.match(follow, /const last = lastTurnRow\(state\.messages\);\s*if \(!last \|\| last\.role !== 'user'\) return false;/);
});

test('upsertEvent and removeEvent never wait for a live stream; the merge exempts lines from extend-only', () => {
  const source = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  const upsert = source.slice(source.indexOf('function upsertEvent('), source.indexOf('function followUntilAnswered('));
  assert.doesNotMatch(upsert, /isStreamActive|eventSource|turnsAwaitingIds/);
  assert.match(source, /if \(!isServerRowId\(row\.id\) \|\| isEventMessage\(row\)\) continue;\s*if \(!nextIds\.has\(row\.id\)\) return false;/);
  // A retry keeps every non-error row, lines included; the status merge puts lines after the question back.
  assert.match(source, /return !isErrorMessage\(message\) \|\| message\.stopped === true;/);
  assert.match(source, /if \(isEventMessage\(row\) && !merged\.some\(\(held\) => held\.id === row\.id\)\) merged = placeEvent\(merged, row\);/);
});

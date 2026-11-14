import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { answerAlreadyShown, textlessTerminalDraw, turnEndsWithError, withoutReplayedRows } from './replayed-answer';
import type { EngineMessage } from './types';

const at = new Date('2026-11-12T07:14:52Z');
const user = (id: string): EngineMessage => ({ id, role: 'user', content: 'Tell me the tenor.', timestamp: at });
const answer = (id: string, savedId?: number): EngineMessage => ({
  id,
  role: 'assistant',
  content: 'The document is still being read.',
  timestamp: at,
  ...(savedId !== undefined ? { savedId } : {}),
});
const tool = (id: string): EngineMessage =>
  ({ id, role: 'assistant', content: '', timestamp: at, messageType: 'tool', toolName: 'read_file' }) as EngineMessage;
const giveUp = (id: string): EngineMessage =>
  ({
    id,
    role: 'event',
    serverId: 15,
    content: "The file reading you asked for finished, but Lawexa couldn't come back to it automatically.",
    timestamp: at,
    eventType: 'background_job_unanswered',
    jobs: [],
  }) as unknown as EngineMessage;

// The B4 give-up chat (12 November 2026): question 11, tool rows 12 and 13,
// answer 14, give-up line 15, all read from history before the attach.
const history = [user('msg_11'), tool('msg_12'), answer('msg_14'), giveUp('msg_15')];
const held = new Set(history.map((row) => row.id));

test("the replay of a run whose answer is on screen is recognised by the answer's saved id", () => {
  assert.equal(answerAlreadyShown(history, 14, held), true);
});

test('a run whose answer this screen drew and stamped is recognised too', () => {
  const rows = [user('local_u'), answer('local_a', 14)];
  assert.equal(answerAlreadyShown(rows, 14, new Set(rows.map((row) => row.id))), true);
});

test('a new answer is not recognised: a live turn, a turn with nothing saved, a row this connection drew', () => {
  assert.equal(answerAlreadyShown(history, 22, held), false);
  assert.equal(answerAlreadyShown(history, null, held), false);
  const drawn = [...history, answer('local_replay', 14)];
  assert.equal(answerAlreadyShown(drawn, 14, new Set(['msg_11'])), false);
});

test('what the replay drew goes; the history, the question and the lines stay', () => {
  const replayed = [...history, tool('local_tool'), answer('local_answer')];
  assert.deepEqual(withoutReplayedRows(replayed, held), history);
  const asked = [...history, user('local_u')];
  assert.deepEqual(withoutReplayedRows(asked, held), asked);
});

test('completed checks for the saved answer before it draws one', () => {
  const engine = readFileSync(join(process.cwd(), 'v2/runtime/chat-engine/engine.ts'), 'utf8');
  assert.match(engine, /const heldAtConnect: ReadonlySet<string> = new Set\(state\.messages\.map\(\(m\) => m\.id\)\);/);
  const completed = engine.slice(engine.indexOf("es.addEventListener('completed'"));
  const check = completed.indexOf('if (answerAlreadyShown(state.messages, savedAnswerId, heldAtConnect)) {');
  assert.ok(check > 0);
  assert.ok(check < completed.indexOf('addAssistantMessage(finalText);'));
  assert.match(
    completed,
    /setMessages\(\(msgs\) => withoutReplayedRows\(msgs, heldAtConnect\)\);\s*handlers\.onCompleted\?\.\(event\);\s*return;/,
  );
});

// Fable's review of 1917ffeb (14 November 2026): a terminal without text drew
// the transcript's answer whenever no placeholder was open, already on screen or not.
const lost = (id: string): EngineMessage =>
  ({ id, role: 'assistant', content: 'This confidential conversation has ended on this device.', timestamp: at, messageType: 'error', errorCode: 'TRANSCRIPT_LOST', retryable: false, retryAfterMs: null }) as unknown as EngineMessage;
const SAVED = 'The document is still being read.';

test('a terminal without text draws the saved answer only when the turn does not show it', () => {
  // Shown already (live): nothing, whether or not the transcript can be read.
  assert.equal(textlessTerminalDraw([user('u1'), tool('t1'), answer('a1')], SAVED), 'nothing');
  assert.equal(textlessTerminalDraw([user('u1'), answer('a1')], null), 'nothing');
  // Not shown yet: the saved answer.
  assert.equal(textlessTerminalDraw([user('u1'), tool('t1')], SAVED), 'answer');
  // A different, newer answer than the one on screen: drawn.
  assert.equal(textlessTerminalDraw([user('u1'), { ...answer('a1'), content: 'An earlier draft.' }], SAVED), 'answer');
  // The same words in an EARLIER turn do not count: the new question's answer is drawn.
  assert.equal(textlessTerminalDraw([user('u0'), answer('a0'), user('u1')], SAVED), 'answer');
  // A streaming row, a tool step or an error is not a shown answer.
  assert.equal(textlessTerminalDraw([user('u1'), { ...answer('a1'), isStreaming: true }], null), 'lost');
  assert.equal(textlessTerminalDraw([user('u1'), tool('t1'), lost('e1')], null), 'lost');
});

test('the same error last in the turn is drawn once; another error, or one in an earlier turn, is not the same', () => {
  const message = 'This confidential conversation has ended on this device.';
  assert.equal(turnEndsWithError([user('u1'), lost('e1')], message, 'TRANSCRIPT_LOST'), true);
  assert.equal(turnEndsWithError([user('u1'), lost('e1')], message, 'UNKNOWN'), false);
  assert.equal(turnEndsWithError([user('u1'), lost('e1')], 'Something went wrong', 'TRANSCRIPT_LOST'), false);
  assert.equal(turnEndsWithError([user('u0'), lost('e0'), user('u1')], message, 'TRANSCRIPT_LOST'), false);
  assert.equal(turnEndsWithError([user('u1'), lost('e1'), answer('a1')], message, 'TRANSCRIPT_LOST'), false);
});

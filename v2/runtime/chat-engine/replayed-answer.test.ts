import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { answerAlreadyShown, withoutReplayedRows } from './replayed-answer';
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

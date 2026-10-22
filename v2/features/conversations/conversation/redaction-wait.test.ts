import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { EngineMessage } from '@/v2/runtime/chat-engine';
import { computeStreamStart, computeTurnSentAt } from './stream-start';

/* Redacted mode, the wait before the answer (Stay, 22 October 2026: "Can we
 * have a much nicer transition when redacted mode is on cos the wait time
 * feels long"; option A). The server redacts the message inside POST /chat
 * before any stream opens, so the row says "Removing personal details…" while
 * that POST is on the wire, and its clock runs from the send. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const at = (ms: number) => new Date(ms);
const user = (ms: number): EngineMessage => ({ id: `u${ms}`, role: 'user', content: 'q', timestamp: at(ms) }) as EngineMessage;
const answer = (ms: number): EngineMessage =>
  ({ id: `a${ms}`, role: 'assistant', content: '', timestamp: at(ms), isStreaming: true }) as EngineMessage;

test('the send time is the last question, so the redaction wait counts', () => {
  assert.equal(computeTurnSentAt([]), null);
  assert.equal(computeTurnSentAt([user(1_000)]), 1_000);
  // A later question wins over an earlier one; answers do not move it.
  assert.equal(computeTurnSentAt([user(1_000), answer(2_000), user(9_000), answer(15_000)]), 9_000);
  // The stream's own start stays where it was, for every other chat.
  assert.equal(computeStreamStart([user(9_000), answer(15_000)]), 15_000);
  assert.equal(computeStreamStart([user(9_000)]), null);
});

test('the engine marks a send until its stream opens, and never while nothing streams', () => {
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(engine, /turnOrigin: 'own', sending: true \}\)\);/);
  // The stream opening ends the send…
  assert.match(engine, /error: null,\s*\/\/ The stream is open: the send is over \(redaction included\)\.\s*sending: false,/);
  // …and every path that stops the stream clears it, in one place.
  assert.match(engine, /if \(next\.sending && !next\.isStreaming\) next = \{ \.\.\.next, sending: false \};/);
  assert.match(engine, /turnOrigin: null,\s*sending: false,\s*\}\);/);
  assert.match(read('v2', 'runtime', 'chat-engine', 'use-conversation-stream.ts'), /sending: snapshot\.sending,/);
});

test('a redacted chat says it is removing personal details, and times the row from the send', () => {
  const controller = read('v2', 'features', 'conversations', 'conversation', 'useConversationController.ts');
  assert.match(controller, /export const REDACTING_LABEL = 'Removing personal details…';/);
  assert.match(controller, /const redacting = isRedacted && turn\.kind === 'own' && stream\.sending;/);
  assert.match(controller, /const sentAt = isRedacted && turn\.kind === 'own' \? computeTurnSentAt\(messages\) : null;/);
  assert.match(controller, /narration: redacting \? REDACTING_LABEL : narration,/);
  const list = read('v2', 'features', 'conversations', 'conversation', 'MessageList.tsx');
  assert.match(list, /const activityStart = heldSince \?\? sentAt \?\? streamStartTime;/);
  assert.match(read('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx'), /sentAt=\{controller\.sentAt\}/);
});

import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { RedactionSummary } from '@/types/chat';
import { createChatEngine } from './engine';

/* A new redacted chat's first message is sent from the home screen, and the
 * chat opens on the `conv_init` handoff, not on an engine send. The handoff
 * carried the message but not what redaction hid, so that message read only
 * "Sent as redacted" with no count until the server's copy came in after the
 * answer (backend's local run, 22 October 2026: the stored row and the POST
 * both had the counts). */

const SUMMARY: RedactionSummary = { details_hidden: 11, places_replaced: 14, by_type: { PERSON: 3, PHONE: 2 } };

const realFetch = globalThis.fetch;
beforeEach(() => {
  // The engine reads its stream through fetch: an open stream that sends nothing.
  globalThis.fetch = (async () =>
    new Response(new ReadableStream<Uint8Array>(), { status: 200, headers: { 'content-type': 'text/event-stream' } })) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("the handoff's redaction summary lands on the chat's first message", () => {
  const engine = createChatEngine({ getToken: () => 'test-token' });
  engine.connectToStream('exec-1', 'My name is [PERSON_1]', undefined, SUMMARY);
  const first = engine.getSnapshot().messages[0];
  assert.equal(first.role, 'user');
  assert.deepEqual(first.redaction, SUMMARY);
  engine.dispose();
});

test('a handoff with no summary draws the message without one', () => {
  const engine = createChatEngine({ getToken: () => 'test-token' });
  engine.connectToStream('exec-2', 'Hello');
  assert.equal(engine.getSnapshot().messages[0].redaction, undefined);
  engine.dispose();
});

const read = (...parts: string[]) => readFileSync(join(process.cwd(), 'v2', 'features', 'conversations', ...parts), 'utf8');

test('the home send writes the summary into the handoff and the chat reads it back', () => {
  const start = read('start-conversation.ts');
  assert.match(start, /redacted && isRedactionSummary\(response\.data\.redaction\) \? response\.data\.redaction : undefined/);
  assert.match(start, /\.\.\.\(data\.redaction && \{ redaction: data\.redaction \}\)/);
  const controller = read('conversation', 'useConversationController.ts');
  assert.match(controller, /isRedactionSummary\(parsed\.redaction\) && \{ redaction: parsed\.redaction \}/);
  assert.match(controller, /connectToStream\(executionId, message, attachments, redaction\)/);
});

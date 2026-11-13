import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { BackgroundJob } from '@/types/background-jobs';
import { backgroundJobsByMessage } from '@/v2/features/conversations/conversation/background-jobs/model';
import { savedIdOf } from '@/v2/features/conversations/conversation/reply-target';
import { createChatEngine } from './engine';

/* Lucy's check 2 on live (13 November 2026, 0500bdd2; conversation 21541):
 * a background job outlived the first turn of a NEW chat, and the app never
 * drew "Running in the background" + Cancel under the question. The server was
 * right (the job's started_by_message_id is 597195, the question's saved id).
 *
 * Cause: a new chat starts on the home composer, which hands the live turn to
 * the chat page through sessionStorage `conv_init_{id}` ({msg, exec, …}). The
 * page redraws the question with addUserMessage and attaches to the stream,
 * but the handoff carries no `user_message_id`, and only `send()` stamps a
 * saved id. So the first question of every new chat has none until a reload,
 * the label's `useBackgroundJobsOf(savedIdOf(row))` gets null, and nothing is
 * drawn. (The same gap leaves an agent's row with no turn to sit after.)
 *
 * Fix: the handoff carries the start response's `user_message_id`, and the
 * page stamps it on the question it redraws. TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const QUESTION_ID = 597195;

const realFetch = globalThis.fetch;
beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_800_000_000_000 });
  // The engine reads its stream through fetch: a stream that stays open.
  globalThis.fetch = (async () =>
    new Response(new ReadableStream<Uint8Array>({ start: () => {} }), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })) as typeof fetch;
});
afterEach(() => {
  mock.timers.reset();
  globalThis.fetch = realFetch;
});

const job = (patch: Partial<BackgroundJob> = {}): BackgroundJob => ({
  id: 'job-4',
  kind: 'file_transcription',
  kind_name: 'file reading',
  status: 'running',
  progress: { done: 2, total: 6, unit: 'pages' },
  started_at: '2026-11-13T01:32:36Z',
  finished_at: null,
  started_by_message_id: QUESTION_ID,
  wake: null,
  ...patch,
});

test('a new chat’s first question, redrawn from the home handoff, carries its saved id at once', () => {
  const engine = createChatEngine({ getToken: () => 'test-token' });
  engine.setConversationId('conv-21541');
  // The chat page attaching to the home composer's live turn, with the id the start response gave.
  (engine.connectToStream as (...args: unknown[]) => void)(
    'exec-d8b9debb',
    'TEST DATA. What consideration does the assignee pay under this deed?',
    undefined,
    undefined,
    QUESTION_ID,
  );
  const question = engine.getSnapshot().messages.find((m) => m.role === 'user');
  assert.ok(question, 'the question is drawn');
  assert.equal(savedIdOf(question), QUESTION_ID);

  // So the job the turn started finds its question, and the label draws under it.
  const byMessage = backgroundJobsByMessage([job()]);
  assert.equal(byMessage.get(savedIdOf(question)!)?.length, 1);
});

test('the home handoff carries the start response’s user_message_id, and the chat page passes it on', () => {
  const start = read('v2', 'features', 'conversations', 'start-conversation.ts');
  assert.match(start, /uid: data\.uid/);
  assert.match(start, /uid: response\.data\.user_message_id/);
  const controller = read('v2', 'features', 'conversations', 'conversation', 'useConversationController.ts');
  assert.match(controller, /userMessageId: typeof parsed\.uid === 'number' \? parsed\.uid : null,/);
  assert.match(controller, /connectToStream\(executionId, message, attachments, redaction, userMessageId\);/);
});

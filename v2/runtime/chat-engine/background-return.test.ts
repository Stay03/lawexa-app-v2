import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { chatApi } from '@/lib/api/chat';
import type { ApiMessage, ConversationData } from '@/types/chat';
import { isBackgroundReturn, lastTurnStartIndex } from '@/v2/runtime/turn-rows';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import { createChatEngine } from './engine';

/* Lawexa back from background work (Backend's shapes 063d9cc3) in the engine,
 * from the review of 8d263fb2. The server stores the return as the turn's USER
 * row; v2 draws it as a line. Where a turn starts must count it:
 *  1. a retry after the return never re-sends the older question (which would
 *     start, and charge, the work again);
 *  2. a merge of the turn's rows cuts at the return, as the server's status
 *     rows start after it, or Lawexa's earlier answer vanished until a reload.
 * TEST DATA only. */

const realGetStatus = chatApi.getStatus;
const realStart = chatApi.start;
afterEach(() => {
  chatApi.getStatus = realGetStatus;
  chatApi.start = realStart;
});

const at = (minute: number) => `2026-11-11T09:${String(minute).padStart(2, '0')}:00Z`;
const row = (id: number, role: 'user' | 'assistant', content: string, metadata: ApiMessage['metadata'] = {}): ApiMessage =>
  ({ id, conversation_id: 'conv-1', agent_id: null, role, content, metadata, created_at: at(id) }) as ApiMessage;
const ASK = row(1, 'user', 'TEST DATA. Read lease.pdf.');
const STARTED = row(2, 'assistant', 'TEST DATA. Reading it in the background.');
const RETURN = row(3, 'user', 'Background work you started earlier in this chat has ended: …', {
  type: 'background_job_result',
  background_jobs: [{ job_id: 'job-1', kind: 'file_transcription', outcome: 'succeeded' }],
});
const ANSWER = row(4, 'assistant', 'TEST DATA. The rent review falls due on 1 March 2027.');

function engineWith(messages: ApiMessage[]) {
  const engine = createChatEngine({ getToken: () => 'test-token' });
  engine.setConversationId('conv-1');
  engine.adoptConversationHistory({ id: 'conv-1', title: 'TEST DATA lease', messages } as unknown as ConversationData);
  return engine;
}

test('a turn starts at its question, or at Lawexa’s return when that is later', () => {
  const rows = transformApiMessages([ASK, STARTED, RETURN, ANSWER], { events: true });
  assert.equal(lastTurnStartIndex(rows), 2);
  assert.equal(isBackgroundReturn(rows[2]), true);
  assert.equal(lastTurnStartIndex(transformApiMessages([ASK, STARTED], { events: true })), 0);
  assert.equal(lastTurnStartIndex([]), -1);
  // A draft's line is not a turn's start.
  assert.equal(isBackgroundReturn({ role: 'event', eventType: 'draft_edit' }), false);
});

test('a retry after Lawexa’s return follows the status and never sends the older question again', async () => {
  const engine = engineWith([ASK, STARTED, RETURN]);
  let starts = 0;
  chatApi.getStatus = (async () => ({ success: true, message: '', data: { status: 'idle', messages: [] } })) as never;
  chatApi.start = (async () => {
    starts += 1;
    return { success: true, message: '', data: { execution_id: 'exec-x' } };
  }) as never;
  await engine.retryLastMessage();
  assert.equal(starts, 0);
  assert.equal(engine.getSnapshot().isStreaming, false);
});

test('a retry without a return still sends the question again', async () => {
  const engine = engineWith([ASK]);
  const sent: string[] = [];
  chatApi.getStatus = (async () => ({ success: true, message: '', data: { status: 'idle', messages: [] } })) as never;
  chatApi.start = (async (body: { message: string }) => {
    sent.push(body.message);
    return { success: false, message: 'TEST stop here' };
  }) as never;
  await engine.retryLastMessage();
  assert.deepEqual(sent, ['TEST DATA. Read lease.pdf.']);
});

test('a completed turn’s rows land after Lawexa’s return, and nothing before it is lost', async () => {
  const engine = engineWith([ASK, STARTED, RETURN]);
  // The server's status rows start after ITS last user row: the return.
  chatApi.getStatus = (async () => ({ success: true, message: '', data: { status: 'completed', messages: [ANSWER] } })) as never;
  await engine.retryLastMessage();
  const ids = engine.getSnapshot().messages.map((message) => message.id);
  assert.deepEqual(ids, ['msg_1', 'msg_2', 'msg_3', 'msg_4']);
});

test('the controller offers no Ask again after a return or under a give-up line', () => {
  const controller = readFileSync(
    join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'useConversationController.ts'),
    'utf8',
  );
  assert.match(controller, /const start = lastTurnStartIndex\(messages\);\s*const row = start === -1 \? null : messages\[start\];\s*return row && row\.role === 'user' \? row : null;/);
  assert.match(controller, /last\.eventType === 'background_job_unanswered'/);
  assert.match(controller, /lastIsCompletedAssistant &&\s*!endsWithGiveUp &&/);
});

test('v1 shows neither row: Lawexa’s return was written for Lawexa, not by the person', () => {
  const rows = transformApiMessages([ASK, STARTED, RETURN, ANSWER]);
  assert.deepEqual(
    rows.map((message) => message.content),
    ['TEST DATA. Read lease.pdf.', 'TEST DATA. Reading it in the background.', 'TEST DATA. The rent review falls due on 1 March 2027.'],
  );
});

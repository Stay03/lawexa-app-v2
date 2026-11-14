import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';

import { chatApi } from '@/lib/api/chat';
import { createChatEngine } from './engine';
import { STALL_CHECK_MS } from './stall';

/* A confidential follow-up drawn twice, word for word (Lucy's check 6, 14
 * November 2026; Backend's diagnosis). The turn completed live. Then a status
 * read that still said "pending" for it made the screen follow the turn again,
 * and the server answered that late connection with the terminal it rebuilds
 * from the database. In a confidential chat that rebuild carries no text
 * (`replayable: false`); with no answer streaming, the engine drew the last
 * saved answer as a new row, under the one already on screen.
 *
 * The engine now remembers each execution it has seen to its terminal and
 * opens no connection to it again. TEST DATA only. */

interface FakeStream {
  send(type: string, data: unknown): void;
}

const realFetch = globalThis.fetch;
const realGetStatus = chatApi.getStatus;
let streams: FakeStream[] = [];

beforeEach(() => {
  streams = [];
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_800_000_000_000 });
  // Node 22's mocked clearInterval, called from inside that interval's own
  // callback, leaves it running (a browser stops it). The watchdog stops itself
  // that way, so a cleared interval is skipped here; reset() restores both.
  const cleared = new Set<unknown>();
  const mockedSet = globalThis.setInterval;
  const mockedClear = globalThis.clearInterval;
  globalThis.setInterval = ((fn: () => void, ms?: number) => {
    const id = mockedSet(() => { if (!cleared.has(id)) fn(); }, ms);
    return id;
  }) as typeof setInterval;
  globalThis.clearInterval = ((id: Parameters<typeof clearInterval>[0]) => {
    cleared.add(id);
    mockedClear(id);
  }) as typeof clearInterval;
  // The engine reads its stream through fetch (AuthedEventSource): each call
  // opens a stream this test writes to.
  globalThis.fetch = (async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start: (c) => { controller = c; } });
    const encoder = new TextEncoder();
    streams.push({ send: (type, data) => controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)) });
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as typeof fetch;
});

afterEach(() => {
  mock.timers.reset();
  globalThis.fetch = realFetch;
  chatApi.getStatus = realGetStatus;
});

/** Lets the stream reads and the engine's awaited calls run. */
async function settle() {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

async function advance(ms: number) {
  for (let left = ms; left > 0; left -= STALL_CHECK_MS) {
    mock.timers.tick(Math.min(STALL_CHECK_MS, left));
    await settle();
  }
}

const at = () => new Date().toISOString();
const ANSWER = 'TEST DATA. The deposit is 10% and completion is on 31 March 2027.';

const assistantRows = (engine: ReturnType<typeof createChatEngine>) =>
  engine.getSnapshot().messages.filter((m) => m.role === 'assistant');

/** A confidential follow-up that streams and completes live. */
async function liveConfidentialTurn() {
  const engine = createChatEngine({ getToken: () => 'test-token', isConfidential: () => true });
  engine.setConversationId('conv-1');
  engine.connectToStream('exec-2', 'TEST DATA. What is the deposit?');
  mock.timers.tick(0);
  await settle();
  const stream = streams[0];
  stream.send('connected', { execution_id: 'exec-2', message: 'Connected' });
  stream.send('text_delta', { delta: ANSWER, iteration: 1, seq: 1, timestamp: at() });
  stream.send('text_done', { iteration: 1, timestamp: at() });
  // Live, the terminal carries the text; only a terminal rebuilt from the database says `replayable: false`.
  stream.send('completed', { iteration: 1, status: 'completed', content: ANSWER, persisted_message_ids: [], timestamp: at() });
  stream.send('end', '</stream>');
  await settle();
  await advance(2_000);
  return engine;
}

test('a confidential turn that completed live is not followed again, so its answer shows once', async () => {
  const engine = await liveConfidentialTurn();
  assert.equal(streams.length, 1);
  assert.deepEqual(assistantRows(engine).map((m) => m.content), [ANSWER]);
  assert.equal(engine.getSnapshot().isStreaming, false);

  // The status poll's follow: a read that still says "pending" for the turn just ended.
  engine.connectToStream('exec-2');
  mock.timers.tick(0);
  await settle();
  // The same through recovery (a remount reading that status).
  chatApi.getStatus = (async () => ({ success: true, message: '', data: { status: 'pending', execution_id: 'exec-2' } })) as never;
  await engine.recoverPendingState('conv-1');
  mock.timers.tick(0);
  await settle();
  await advance(2_000);

  assert.equal(streams.length, 1, 'no connection opens to a turn this screen has seen end');
  const rows = assistantRows(engine);
  assert.deepEqual(rows.map((m) => m.content), [ANSWER], 'the answer is drawn once');
  assert.equal(rows.filter((m) => 'error' in m && m.error).length, 0, 'and no error row');
  assert.equal(engine.getSnapshot().isStreaming, false);
  engine.disconnect();
});

test("a new turn's execution still connects after an earlier one settled", async () => {
  const engine = await liveConfidentialTurn();
  engine.connectToStream('exec-3', 'TEST DATA. And the completion date?');
  mock.timers.tick(0);
  await settle();
  assert.equal(streams.length, 2, 'only the settled execution is refused');
  engine.disconnect();
});

/* A terminal delivered twice on the SAME connection (Fable's review, 14
 * November 2026): the stream reconnects on its own after a drop between
 * `completed` and `end`, and the second `completed`, rebuilt from the database
 * without text, lands on the same listeners. settledExecutions cannot see it. */

test('a second completed without text, after the live one on the same stream, leaves the answer once and no error', async () => {
  const engine = createChatEngine({ getToken: () => 'test-token', isConfidential: () => true });
  engine.setConversationId('conv-1');
  engine.connectToStream('exec-2', 'TEST DATA. What is the deposit?');
  mock.timers.tick(0);
  await settle();
  const stream = streams[0];
  stream.send('connected', { execution_id: 'exec-2', message: 'Connected' });
  stream.send('text_delta', { delta: ANSWER, iteration: 1, seq: 1, timestamp: at() });
  stream.send('text_done', { iteration: 1, timestamp: at() });
  stream.send('completed', { iteration: 1, status: 'completed', content: ANSWER, persisted_message_ids: [], timestamp: at() });
  await settle();
  // The re-delivered terminal: no text, as the server rebuilds it for a confidential chat.
  stream.send('completed', { iteration: 1, status: 'completed', replayable: false, persisted_message_ids: [], timestamp: at() });
  await settle();
  stream.send('end', '</stream>');
  await settle();
  await advance(2_000);

  const rows = assistantRows(engine);
  assert.deepEqual(rows.map((m) => m.content), [ANSWER], 'the answer is drawn once');
  assert.equal(rows.filter((m) => 'messageType' in m && m.messageType === 'error').length, 0, 'and no error row');
  engine.disconnect();
});

test('the same error delivered twice is drawn once', async () => {
  // No answer on screen and no transcript on this device (Node has no IndexedDB):
  // each textless terminal reaches "ended on this device"; the second adds nothing.
  const engine = createChatEngine({ getToken: () => 'test-token', isConfidential: () => true });
  engine.setConversationId('conv-1');
  engine.connectToStream('exec-4', 'TEST DATA. Is the lease registered?');
  mock.timers.tick(0);
  await settle();
  const stream = streams[0];
  stream.send('connected', { execution_id: 'exec-4', message: 'Connected' });
  stream.send('completed', { iteration: 1, status: 'completed', replayable: false, persisted_message_ids: [], timestamp: at() });
  await settle();
  stream.send('completed', { iteration: 1, status: 'completed', replayable: false, persisted_message_ids: [], timestamp: at() });
  await settle();
  stream.send('end', '</stream>');
  await settle();
  await advance(2_000);

  const errors = assistantRows(engine).filter((m) => 'messageType' in m && m.messageType === 'error');
  assert.deepEqual(errors.map((m) => m.content), ['This confidential conversation has ended on this device.']);
  engine.disconnect();
});

import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';

import { chatApi } from '@/lib/api/chat';
import type { ApiMessage } from '@/types/chat';
import { createChatEngine } from './engine';
import { STALL_CHECK_MS, STALL_SILENCE_MS } from './stall';

/* A turn the engine recovered by its status, after the stream went silent, is
 * replaced by the server's copy of the conversation. The next turn must start
 * clean: the old turn's streaming refs pointed at a row the reload removed, so
 * the next answer's text went to that row and never showed (20 October 2026).
 * And a stream that finishes the turn itself while a status check is on its way
 * keeps the answer it drew: the conversation is not reloaded over it. */

interface FakeStream {
  send(type: string, data: unknown): void;
  /** The connection drops with no `end` (a proxy or the PHP worker closing it). */
  drop(): void;
}

const realFetch = globalThis.fetch;
const realGetStatus = chatApi.getStatus;
const realGetConversation = chatApi.getConversation;
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
  // opens a stream this test writes to and never closes.
  globalThis.fetch = (async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start: (c) => { controller = c; } });
    const encoder = new TextEncoder();
    streams.push({
      send: (type, data) => controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)),
      drop: () => controller.close(),
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as typeof fetch;
});

afterEach(() => {
  mock.timers.reset();
  globalThis.fetch = realFetch;
  chatApi.getStatus = realGetStatus;
  chatApi.getConversation = realGetConversation;
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

function row(id: number, role: 'user' | 'assistant', content: string): ApiMessage {
  return { id, conversation_id: 'conv-1', agent_id: null, role, content, metadata: null, created_at: at() } as unknown as ApiMessage;
}

function serverCopy(messages: ApiMessage[]) {
  return async () => ({ success: true, message: '', data: { id: 'conv-1', title: 'Test chat', messages } }) as never;
}

async function openTurn(engine: ReturnType<typeof createChatEngine>, execId: string, question: string) {
  engine.connectToStream(execId, question);
  mock.timers.tick(0);
  await settle();
  const stream = streams[streams.length - 1];
  stream.send('connected', { execution_id: execId, message: 'Connected' });
  stream.send('iteration', { iteration: 1, status: 'processing', timestamp: at() });
  await settle();
  return stream;
}

const assistantText = (engine: ReturnType<typeof createChatEngine>) =>
  engine.getSnapshot().messages.filter((m) => m.role === 'assistant').map((m) => m.content);

test('a turn after a recovery by status shows its answer', async () => {
  let reloads = 0;
  const engine = createChatEngine({ getToken: () => 'test-token', onHistoryLoaded: () => { reloads += 1; } });
  engine.setConversationId('conv-1');
  chatApi.getStatus = async () => ({ success: true, message: '', data: { status: 'completed' } }) as never;
  chatApi.getConversation = serverCopy([row(1, 'user', 'First question'), row(2, 'assistant', 'The first answer, from the server.')]);

  // Turn 1: the stream carries narration, then goes silent.
  const first = await openTurn(engine, 'exec-1', 'First question');
  first.send('text_delta', { delta: 'Searching the statutes.', iteration: 1, timestamp: at() });
  await settle();
  await advance(STALL_SILENCE_MS + STALL_CHECK_MS);
  assert.equal(reloads, 1, 'the silent turn is recovered from the server copy');
  assert.deepEqual(assistantText(engine), ['The first answer, from the server.']);

  // Turn 2 on a fresh stream, with the same iteration number as turn 1.
  chatApi.getConversation = serverCopy([]);
  const second = await openTurn(engine, 'exec-2', 'Second question');
  second.send('text_delta', { delta: 'The second answer.', iteration: 1, timestamp: at() });
  second.send('completed', { iteration: 1, status: 'completed', content: 'The second answer.' });
  second.send('end', '</stream>');
  await settle();
  await advance(2_000);

  assert.deepEqual(assistantText(engine), ['The first answer, from the server.', 'The second answer.']);
  assert.ok(engine.getSnapshot().messages.every((m) => !m.isStreaming));
  engine.disconnect();
});

/* Lucy, 24 October 2026 (chat 91352c16): a reload mid-answer attached, drew the
 * text so far, and the stream ended there. The page showed that first line as the
 * finished answer for 12 minutes while the server wrote the rest. */
test('a reload whose stream ends before the answer is complete follows the turn to its end', async () => {
  let reloads = 0;
  const engine = createChatEngine({ getToken: () => 'test-token', onHistoryLoaded: () => { reloads += 1; } });
  engine.setConversationId('conv-1');
  let status = 'pending';
  let statusCalls = 0;
  chatApi.getStatus = (async () => {
    statusCalls += 1;
    return { success: true, message: '', data: { status, execution_id: 'exec-1' } };
  }) as never;
  chatApi.getConversation = serverCopy([
    row(1, 'user', 'Make a quiz from statute 1310'),
    row(2, 'assistant', "I'll create the quiz from statute 1310. The quiz is ready."),
  ]);

  assert.equal(await engine.recoverPendingState('conv-1'), 'reconnected');
  mock.timers.tick(0);
  await settle();
  const stream = streams[streams.length - 1];
  stream.send('connected', { execution_id: 'exec-1', message: 'Connected', accumulated_text: "I'll create the quiz from statute 1310." });
  stream.send('end', '</stream>');
  await settle();

  // The turn is still running: the answer so far stays live, nothing is final.
  assert.equal(engine.getSnapshot().isStreaming, true);
  assert.ok(engine.getSnapshot().messages.every((m) => m.role !== 'assistant' || m.isStreaming));
  const checksAfterEnd = statusCalls;
  assert.ok(checksAfterEnd >= 2, 'the status is asked again once the stream ends');
  await advance(10_000);
  assert.ok(statusCalls > checksAfterEnd, 'and again while the turn is pending');
  assert.equal(reloads, 0);

  // The server finishes the turn: the page loads the whole answer.
  status = 'completed';
  await advance(10_000);
  assert.equal(reloads, 1);
  assert.deepEqual(assistantText(engine), ["I'll create the quiz from statute 1310. The quiz is ready."]);
  assert.equal(engine.getSnapshot().isStreaming, false);
  engine.disconnect();
});

test('a reload that attached mid-answer draws the later steps and the answer from the stream', async () => {
  let reloads = 0;
  const engine = createChatEngine({ getToken: () => 'test-token', onHistoryLoaded: () => { reloads += 1; } });
  engine.setConversationId('conv-1');
  chatApi.getStatus = (async () => ({ success: true, message: '', data: { status: 'pending', execution_id: 'exec-1' } })) as never;
  chatApi.getConversation = serverCopy([]);

  await engine.recoverPendingState('conv-1');
  mock.timers.tick(0);
  await settle();
  const stream = streams[streams.length - 1];
  stream.send('connected', { execution_id: 'exec-1', message: 'Connected', accumulated_text: "I'll create the quiz." });
  stream.send('heartbeat', { timestamp: at() });
  await advance(5_000);
  const tool = { id: 'call-1', name: 'create_quiz', parameters: {} };
  stream.send('tool_calling', { seq: 7, iteration: 1, status: 'tool_calling', tool_call: tool, timestamp: at() });
  stream.send('tool_complete', { seq: 8, iteration: 1, status: 'tool_complete', tool_call: tool, timestamp: at() });
  stream.send('completed', { seq: 9, iteration: 2, status: 'completed', content: 'The quiz is ready.' });
  stream.send('end', '</stream>');
  await settle();
  await advance(2_000);

  const steps = engine.getSnapshot().messages.filter((m) => m.role === 'tool');
  assert.equal(steps.length, 1);
  assert.equal((steps[0] as { toolStatus?: string }).toolStatus, 'complete');
  assert.deepEqual(assistantText(engine), ['The quiz is ready.']);
  assert.equal(engine.getSnapshot().isStreaming, false);
  assert.equal(reloads, 0);
  engine.disconnect();
});

test('a reload whose connection drops with no end follows the turn by its status', async () => {
  let reloads = 0;
  const engine = createChatEngine({ getToken: () => 'test-token', onHistoryLoaded: () => { reloads += 1; } });
  engine.setConversationId('conv-1');
  let status = 'pending';
  chatApi.getStatus = (async () => ({ success: true, message: '', data: { status, execution_id: 'exec-1' } })) as never;
  chatApi.getConversation = serverCopy([row(1, 'user', 'Q'), row(2, 'assistant', 'The whole answer.')]);

  await engine.recoverPendingState('conv-1');
  mock.timers.tick(0);
  await settle();
  const first = streams[streams.length - 1];
  first.send('connected', { execution_id: 'exec-1', message: 'Connected', accumulated_text: 'The first line.' });
  first.send('heartbeat', { timestamp: at() });
  await settle();
  first.drop();
  await advance(4_000);
  // The transport reconnects; the new connection carries heartbeats and no progress.
  const second = streams[streams.length - 1];
  assert.notEqual(second, first, 'the dropped connection is reopened');
  second.send('connected', { execution_id: 'exec-1', message: 'Connected', accumulated_text: 'The first line.' });
  second.send('heartbeat', { timestamp: at() });
  await advance(10_000);
  assert.equal(engine.getSnapshot().isStreaming, true, 'still writing while the turn runs');
  assert.equal(reloads, 0);

  status = 'completed';
  await advance(10_000);
  assert.equal(reloads, 1);
  assert.deepEqual(assistantText(engine), ['The whole answer.']);
  assert.equal(engine.getSnapshot().isStreaming, false);
  engine.disconnect();
});

/* The server's stream answers a fresh connection with `connected` carrying the
 * text so far, then replays the turn from its start (0-0), deltas included. */
test('a reload mid-answer shows the text so far once, under the saved copy of it', async () => {
  const engine = createChatEngine({ getToken: () => 'test-token' });
  engine.adoptConversationHistory({
    id: 'conv-1',
    title: 'Test chat',
    messages: [row(1, 'user', 'Make a quiz from statute 1310'), row(2, 'assistant', "I'll create the quiz.")],
  } as never);
  chatApi.getStatus = (async () => ({ success: true, message: '', data: { status: 'pending', execution_id: 'exec-1' } })) as never;
  chatApi.getConversation = serverCopy([]);

  await engine.recoverPendingState('conv-1');
  mock.timers.tick(0);
  await settle();
  const stream = streams[streams.length - 1];
  stream.send('connected', { execution_id: 'exec-1', message: 'Connected', accumulated_text: 'The quiz has 10 ques' });
  stream.send('iteration', { iteration: 1, status: 'processing', timestamp: at() });
  stream.send('text_delta', { delta: "I'll create the quiz.", iteration: 1, timestamp: at() });
  stream.send('text_reset', { iteration: 1, text_type: 'response', reason: 'tool_call', timestamp: at() });
  const tool = { id: 'call-1', name: 'create_quiz', parameters: {} };
  stream.send('tool_calling', { seq: 7, iteration: 1, status: 'tool_calling', tool_call: tool, timestamp: at() });
  stream.send('tool_complete', { seq: 8, iteration: 1, status: 'tool_complete', tool_call: tool, timestamp: at() });
  stream.send('iteration', { iteration: 2, status: 'processing', timestamp: at() });
  stream.send('text_delta', { delta: 'The quiz has 10 ques', iteration: 2, timestamp: at() });
  await settle();
  await advance(2_000);

  // History's saved line, then the answer being written, each once.
  const live = engine.getSnapshot().messages.filter((m) => m.role === 'assistant');
  assert.equal(live.length, 2, JSON.stringify(live.map((m) => [m.content, m.isStreaming])));
  assert.equal(live[0].content, "I'll create the quiz.");
  assert.equal(live[1].isStreaming, true);
  engine.disconnect();
});

test('a stream that finishes during a status check is not reloaded over', async () => {
  let reloads = 0;
  let conversationReads = 0;
  const engine = createChatEngine({ getToken: () => 'test-token', onHistoryLoaded: () => { reloads += 1; } });
  engine.setConversationId('conv-1');
  let answerStatus!: (value: unknown) => void;
  let statusCalls = 0;
  chatApi.getStatus = (() => {
    statusCalls += 1;
    return new Promise((resolve) => { answerStatus = resolve; });
  }) as never;
  chatApi.getConversation = (async () => {
    conversationReads += 1;
    return { success: true, message: '', data: { id: 'conv-1', title: 'Test chat', messages: [row(1, 'user', 'Q'), row(2, 'assistant', 'The server copy.')] } };
  }) as never;

  // A long step: heartbeats every 5 s and no data, until the 60 s data check
  // asks for the status.
  const stream = await openTurn(engine, 'exec-1', 'Q');
  stream.send('text_delta', { delta: 'Reading the case.', iteration: 1, timestamp: at() });
  await settle();
  for (let waited = 0; statusCalls === 0 && waited < 70_000; waited += 5_000) {
    await advance(5_000);
    stream.send('heartbeat', { timestamp: at() });
    await settle();
  }
  assert.equal(statusCalls, 1, 'the data check asked for the status');

  // The stream finishes the turn while the status is on its way.
  stream.send('completed', { iteration: 1, status: 'completed', content: 'The answer, from the stream.' });
  stream.send('end', '</stream>');
  await settle();
  answerStatus({ success: true, message: '', data: { status: 'completed' } });
  await settle();
  await advance(2_000);

  assert.equal(conversationReads, 0);
  assert.equal(reloads, 0);
  assert.deepEqual(assistantText(engine), ['The answer, from the stream.']);
  engine.disconnect();
});

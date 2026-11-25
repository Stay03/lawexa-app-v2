import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ToolMessage } from '@/types/chat';
import { createChatEngine } from './engine';
import { createLiveSeqFilter, liveSeqOf } from './live-seq';

/* A live event relayed twice with the same seq (Backend, 25 November 2026: a
 * reader resumed after a container restart) is dropped before any handler
 * sees it, on that connection, text included. An event with no seq always
 * passes. A fresh connection still gets the turn's whole replay. TEST DATA. */

interface FakeStream {
  send(type: string, data: unknown): void;
}

const realFetch = globalThis.fetch;
let streams: FakeStream[] = [];

beforeEach(() => {
  streams = [];
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_800_000_000_000 });
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
});

async function settle() {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

async function open(execId = 'exec-1') {
  const engine = createChatEngine({ getToken: () => 'test-token' });
  engine.setConversationId('conv-1');
  engine.connectToStream(execId, 'TEST DATA question', undefined, undefined, 1);
  mock.timers.tick(0);
  await settle();
  const stream = streams[streams.length - 1];
  stream.send('connected', { execution_id: execId, message: 'Connected', seq: 1 });
  stream.send('iteration', { iteration: 1, status: 'processing', seq: 2 });
  await settle();
  return { engine, stream };
}

const tools = (engine: ReturnType<typeof createChatEngine>) =>
  engine.getSnapshot().messages.filter((m) => m.role === 'tool') as ToolMessage[];
const call = (name: string, id: string, seq: number) => ({ iteration: 1, status: 'tool_calling', tool_call: { name, parameters: { query: `TEST DATA ${id}` } }, tool_call_id: id, seq });
const done = (name: string, id: string, seq: number) => ({
  iteration: 1, status: 'tool_complete', tool_call: { name, parameters: { query: `TEST DATA ${id}` } }, tool_call_id: id,
  tool_result: { success: true, data: { items: [] }, error: null }, latency_ms: 100, seq,
});

test('the filter: a repeated seq is caught, a missing or unreadable one always passes', () => {
  const repeated = createLiveSeqFilter();
  assert.equal(repeated(JSON.stringify({ seq: 5 })), false);
  assert.equal(repeated(JSON.stringify({ seq: 6 })), false);
  assert.equal(repeated(JSON.stringify({ seq: 5 })), true);
  assert.equal(repeated(JSON.stringify({ message: 'no seq' })), false);
  assert.equal(repeated(JSON.stringify({ message: 'no seq' })), false, 'two events with no seq both pass');
  assert.equal(repeated('</stream>'), false);
  // Only the event's own top-level seq counts, never one inside its payload.
  assert.equal(liveSeqOf(JSON.stringify({ tool_result: { data: { seq: 9 } } })), null);
  assert.equal(liveSeqOf(JSON.stringify({ seq: 9.5 })), null);
});

test('a repeated text_delta does not double the words', async () => {
  const { engine, stream } = await open();
  stream.send('text_delta', { iteration: 1, delta: 'TEST DATA. The pilot ', seq: 3 });
  stream.send('text_delta', { iteration: 1, delta: 'was not compulsory.', seq: 4 });
  stream.send('text_delta', { iteration: 1, delta: 'was not compulsory.', seq: 4 });
  stream.send('text_done', { iteration: 1, seq: 5 });
  await settle();
  const answer = engine.getSnapshot().messages.find((m) => m.role === 'assistant');
  assert.equal(answer?.content, 'TEST DATA. The pilot was not compulsory.');
  engine.disconnect();
});

test('a repeated step start draws one step, not two', async () => {
  const { engine, stream } = await open();
  stream.send('tool_calling', call('search_cases', 'c1', 3));
  stream.send('tool_calling', call('search_cases', 'c1', 3));
  await settle();
  assert.equal(tools(engine).length, 1);
  engine.disconnect();
});

test('a repeated step end does not close a second open step of the same tool', async () => {
  const { engine, stream } = await open();
  stream.send('tool_calling', call('search_cases', 'c1', 3));
  stream.send('tool_calling', call('search_cases', 'c2', 4));
  stream.send('tool_complete', done('search_cases', 'c1', 5));
  // The same end relayed again: without the filter it closed the oldest open search_cases step, c2.
  stream.send('tool_complete', done('search_cases', 'c1', 5));
  await settle();
  assert.deepEqual(tools(engine).map((t) => t.toolStatus), ['complete', 'calling']);
  engine.disconnect();
});

test('the stop event of a turn stopped before it started carries no seq, and still ends the turn', async () => {
  const engine = createChatEngine({ getToken: () => 'test-token' });
  engine.setConversationId('conv-1');
  engine.connectToStream('exec-2', 'TEST DATA question', undefined, undefined, 1);
  mock.timers.tick(0);
  await settle();
  streams[0].send('cancelled', { message: 'Stopped' });
  await settle();
  assert.equal(engine.getSnapshot().isStreaming, false);
  engine.disconnect();
});

test('a fresh connection to the same turn still gets its whole replay', async () => {
  const { engine, stream } = await open('exec-3');
  stream.send('tool_calling', call('search_cases', 'c1', 3));
  await settle();
  engine.disconnect();
  // A new connection is answered from the turn's start, with the same seqs: none of it is dropped.
  engine.connectToStream('exec-3', 'TEST DATA question', undefined, undefined, 1);
  mock.timers.tick(0);
  await settle();
  const again = streams[streams.length - 1];
  again.send('connected', { execution_id: 'exec-3', message: 'Connected', seq: 1 });
  again.send('iteration', { iteration: 1, status: 'processing', seq: 2 });
  again.send('text_delta', { iteration: 1, delta: 'TEST DATA replayed.', seq: 3 });
  again.send('text_done', { iteration: 1, seq: 4 });
  await settle();
  assert.ok(engine.getSnapshot().messages.some((m) => m.role === 'assistant' && m.content === 'TEST DATA replayed.'));
  engine.disconnect();
});

test('every stream listener is registered through the filter', () => {
  const engine = readFileSync(join(process.cwd(), 'v2', 'runtime', 'chat-engine', 'engine.ts'), 'utf8');
  assert.equal((engine.match(/es\.addEventListener\('/g) ?? []).length, 0, 'no listener skips the filter');
  assert.match(engine, /const repeatedOnThisConnection = createLiveSeqFilter\(\);/);
  assert.match(engine, /if \(repeatedOnThisConnection\(\(e as MessageEvent\)\.data\)\) return;/);
  assert.ok((engine.match(/\n    on\('/g) ?? []).length >= 20);
});

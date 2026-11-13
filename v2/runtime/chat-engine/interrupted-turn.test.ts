import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';

import { chatApi } from '@/lib/api/chat';
import type { ApiMessage } from '@/types/chat';
import { createChatEngine } from './engine';
import { STALL_CHECK_MS } from './stall';

/* A turn whose stream was cut before its end (E2E, chat 33f09770, 13 November
 * 2026). A new chat starts on the home composer; the chat page takes the turn
 * over (the conv_init handoff) and connects. In development React mounts the
 * page twice: the first mount connects, its unmount disconnects before the
 * stream answered, and the handoff is consumed, so the second mount takes the
 * recovery path. Lite's turn had ended in 13 s, before the page arrived: the
 * status read "idle", nothing reconnected, and the turn this engine started
 * never got its terminal. Its count of turns awaiting ids stayed at 1, which
 * blocks every merge of the server's history, so Lite's answer and steps (rows
 * 2-6) were never drawn, while the agent row and the wake streamed on.
 *
 * The engine now remembers the turn the disconnect cut and, on recovery,
 * attaches to it again: the server answers a finished turn from the database
 * with its terminal event and its saved ids, which settles it. A turn still
 * running is attached once, never counted twice. TEST DATA only. */

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

const assistantText = (engine: ReturnType<typeof createChatEngine>) =>
  engine.getSnapshot().messages.filter((m) => m.role === 'assistant').map((m) => m.content);

const LINE = "I've asked Issue Spotter; I'll answer when it replies.";

test('a handoff turn cut before its stream answered, and already over, is fetched again and settles', async () => {
  const engine = createChatEngine({ getToken: () => 'test-token' });
  engine.setConversationId('conv-1');
  // The first mount: the handoff connects, with the question's saved id.
  engine.connectToStream('exec-1', 'Ask Issue Spotter', undefined, undefined, 1);
  mock.timers.tick(0);
  await settle();
  assert.equal(streams.length, 1);
  // Its unmount, before the stream said anything.
  engine.disconnect();

  // The second mount: the handoff is consumed, so it recovers. The turn is over.
  chatApi.getStatus = (async () => ({ success: true, message: '', data: { status: 'idle', execution_id: null } })) as never;
  assert.equal(await engine.recoverPendingState('conv-1'), 'reconnected');
  mock.timers.tick(0);
  await settle();
  assert.equal(streams.length, 2, 'the cut turn is asked for again');
  // The server answers a finished turn from the database.
  const stream = streams[1];
  stream.send('connected', { execution_id: 'exec-1', message: 'Connected' });
  stream.send('completed', { iteration: 1, status: 'completed', content: LINE, persisted_message_ids: [1, 6], timestamp: at() });
  stream.send('end', '</stream>');
  await settle();
  await advance(2_000);
  assert.deepEqual(assistantText(engine), [LINE]);
  assert.equal(engine.getSnapshot().isStreaming, false);

  // Settled: the server's history merges again (the wake's rows come this way).
  const merged = engine.adoptConversationHistory({
    id: 'conv-1',
    title: 'Test chat',
    messages: [row(1, 'user', 'Ask Issue Spotter'), row(6, 'assistant', LINE), row(9, 'assistant', 'Issue Spotter has come back with its list.')],
  } as never);
  assert.equal(merged, true, 'the merge is no longer blocked');
  assert.deepEqual(assistantText(engine), [LINE, 'Issue Spotter has come back with its list.']);
  assert.equal(engine.getSnapshot().messages.filter((m) => m.role === 'user').length, 1, 'the question is not drawn twice');
  engine.disconnect();
});

test('a handoff turn cut while it still runs is attached again once, and its end settles it', async () => {
  const engine = createChatEngine({ getToken: () => 'test-token' });
  engine.setConversationId('conv-1');
  engine.connectToStream('exec-1', 'Ask Issue Spotter', undefined, undefined, 1);
  mock.timers.tick(0);
  await settle();
  engine.disconnect();

  chatApi.getStatus = (async () => ({ success: true, message: '', data: { status: 'pending', execution_id: 'exec-1' } })) as never;
  assert.equal(await engine.recoverPendingState('conv-1'), 'reconnected');
  mock.timers.tick(0);
  await settle();
  assert.equal(streams.length, 2);
  const stream = streams[1];
  stream.send('connected', { execution_id: 'exec-1', message: 'Connected' });
  stream.send('completed', { iteration: 1, status: 'completed', content: LINE, persisted_message_ids: [1, 6], timestamp: at() });
  stream.send('end', '</stream>');
  await settle();
  await advance(2_000);

  // Counted once: its end settles it, and a later history read merges.
  const merged = engine.adoptConversationHistory({
    id: 'conv-1',
    title: 'Test chat',
    messages: [row(1, 'user', 'Ask Issue Spotter'), row(6, 'assistant', LINE), row(9, 'assistant', 'Issue Spotter has come back with its list.')],
  } as never);
  assert.equal(merged, true);
  assert.deepEqual(assistantText(engine), [LINE, 'Issue Spotter has come back with its list.']);
  engine.disconnect();
});

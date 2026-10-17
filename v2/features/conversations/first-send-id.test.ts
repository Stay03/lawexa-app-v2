import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '@/lib/api/client';
import { newRequestId, requestIdFor, settleRequestId, type FirstSend } from './first-send-id';
import { startConversation, type StartConversationInput } from './start-conversation';

/* A new chat's first send carries `client_request_id`, and a retry of it the
 * same one (backend contract, 17 October 2026). The server below keeps its
 * chats by that id, as backend's does: a repeat while the first answer runs is
 * a 409 PENDING_RESPONSE, a repeat after it is `already_sent`, and a refused
 * send makes no chat. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type Chat = { id: string; answering: boolean; deleted: boolean };

/** The fake server, and every POST /chat body it was sent. */
function fakeServer() {
  const chats = new Map<string, Chat>();
  const posts: Record<string, unknown>[] = [];
  let made = 0;
  /** Set to make the next POST commit and then lose its answer (no response). */
  let dropNextAnswer = false;
  /** Set to refuse the next POST with this status, making no chat. */
  let refuseNext: number | null = null;
  const reply = (config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse => ({
    data, status, statusText: String(status), headers: {}, config,
  });
  const fail = (config: InternalAxiosRequestConfig, status: number | null, data: unknown = {}) => {
    const response = status === null ? undefined : reply(config, status, data);
    return Promise.reject(new AxiosError('fail', status === null ? 'ERR_NETWORK' : 'ERR_BAD_RESPONSE', config, null, response));
  };
  const adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const url = config.url ?? '';
    if (config.method === 'get' && /\/conversations\/[^/]+\/status$/.test(url)) {
      const id = url.split('/')[2];
      const chat = [...chats.values()].find((c) => c.id === id);
      return chat && !chat.deleted
        ? reply(config, 200, { success: true, data: { status: 'completed' } })
        : fail(config, 404, { success: false, message: 'Not found' });
    }
    if (config.method === 'post' && url === '/chat') {
      const body = JSON.parse(String(config.data)) as Record<string, unknown>;
      posts.push(body);
      if (refuseNext !== null) {
        const status = refuseNext;
        refuseNext = null;
        return fail(config, status, { success: false, message: 'Refused' });
      }
      const key = String(body.client_request_id);
      const seen = chats.get(key);
      if (seen?.answering) {
        return fail(config, 409, {
          success: false,
          code: 'PENDING_RESPONSE',
          data: { conversation_id: seen.id, execution_id: 'exec-1', stream_url: '/stream/exec-1' },
        });
      }
      if (seen) {
        return reply(config, 200, {
          success: true,
          message: 'This message was already sent.',
          data: { conversation_id: seen.id, already_sent: true },
        });
      }
      made += 1;
      const chat: Chat = { id: `chat-${made}`, answering: true, deleted: false };
      chats.set(key, chat);
      if (dropNextAnswer) {
        dropNextAnswer = false;
        return fail(config, null);
      }
      return reply(config, 200, {
        success: true,
        data: { conversation_id: chat.id, execution_id: `exec-${made}`, stream_url: `/s/${made}`, workflow_id: 1 },
      });
    }
    throw new Error(`unexpected ${config.method} ${url}`);
  };
  return {
    adapter,
    posts,
    chats: () => [...chats.values()],
    dropNextAnswer: () => { dropNextAnswer = true; },
    refuseNext: (status: number) => { refuseNext = status; },
    finishAll: () => { for (const chat of chats.values()) chat.answering = false; },
    deleteAll: () => { for (const chat of chats.values()) chat.deleted = true; },
  };
}

async function withServer(run: (server: ReturnType<typeof fakeServer>, client: QueryClient) => Promise<void>) {
  const server = fakeServer();
  const client = new QueryClient();
  const adapter = apiClient.defaults.adapter;
  apiClient.defaults.adapter = server.adapter;
  try {
    await run(server, client);
  } finally {
    apiClient.defaults.adapter = adapter;
    client.clear();
  }
}

let n = 0;
/** A send with words of its own, so tests never share an id. */
const input = (words = `question ${(n += 1)}`): StartConversationInput => ({
  message: words,
  attachments: [],
  jurisdiction: { mode: 'auto' },
});
const start = (client: QueryClient, send: StartConversationInput) => startConversation(send, { queryClient: client });

test('the first send carries a v4 uuid, never with conversation_id', async () => {
  await withServer(async (server, client) => {
    const result = await start(client, input());
    assert.equal(result.status, 'created');
    assert.match(String(server.posts[0].client_request_id), UUID);
    assert.equal('conversation_id' in server.posts[0], false);
  });
});

test('the answer lost after the server made the chat, then a retry: one chat, opened', async () => {
  await withServer(async (server, client) => {
    const send = input();
    server.dropNextAnswer();
    await assert.rejects(start(client, send));
    assert.equal(server.chats().length, 1, 'the server kept the chat');

    server.finishAll();
    const retry = await start(client, send);
    assert.deepEqual(retry, { status: 'existing', conversationId: 'chat-1' });
    assert.equal(server.chats().length, 1, 'no second chat');
    assert.equal(server.posts[1].client_request_id, server.posts[0].client_request_id, 'the same id');
  });
});

test('a retry while the first answer still runs joins that chat (409 PENDING_RESPONSE)', async () => {
  await withServer(async (server, client) => {
    const send = input();
    server.dropNextAnswer();
    await assert.rejects(start(client, send));
    const retry = await start(client, send);
    assert.deepEqual(retry, { status: 'existing', conversationId: 'chat-1' });
    assert.equal(server.chats().length, 1);
  });
});

for (const status of [422, 503]) test(`a refused first send (${status}) makes no chat, and its retry keeps the id`, async () => {
  await withServer(async (server, client) => {
    const send = input();
    server.refuseNext(status);
    await assert.rejects(start(client, send));
    assert.equal(server.chats().length, 0);
    const retry = await start(client, send);
    assert.equal(retry.status, 'created');
    assert.equal(server.posts[1].client_request_id, server.posts[0].client_request_id);
    assert.equal(server.chats().length, 1);
  });
});

test('the chat the retry names was deleted since: sent again under a new id', async () => {
  await withServer(async (server, client) => {
    const send = input();
    server.dropNextAnswer();
    await assert.rejects(start(client, send));
    server.finishAll();
    server.deleteAll();
    const retry = await start(client, send);
    assert.deepEqual(retry, { status: 'created', conversationId: 'chat-2', hardNavigate: false });
    assert.equal(server.posts.length, 3, 'the first send, the retry, and one send again');
    assert.equal(server.posts[1].client_request_id, server.posts[0].client_request_id);
    assert.notEqual(server.posts[2].client_request_id, server.posts[1].client_request_id);
    assert.match(String(server.posts[2].client_request_id), UUID);
  });
});

test('once a chat is made, the same words later are a new chat with a new id', async () => {
  await withServer(async (server, client) => {
    const send = input();
    await start(client, send);
    server.finishAll();
    const again = await start(client, send);
    assert.equal(again.status, 'created');
    assert.notEqual(server.posts[1].client_request_id, server.posts[0].client_request_id);
    assert.equal(server.chats().length, 2);
  });
});

test('different words, files or space are a different send', () => {
  const base: FirstSend = { message: 'a', fileIds: [2, 1], confidential: false, redacted: false };
  const id = requestIdFor(base);
  assert.equal(requestIdFor({ ...base, fileIds: [1, 2] }), id, 'file order does not matter');
  assert.notEqual(requestIdFor({ ...base, message: 'b' }), id);
  assert.notEqual(requestIdFor({ ...base, fileIds: [1] }), id);
  assert.notEqual(requestIdFor({ ...base, spaceUuid: 's-1' }), id);
  assert.notEqual(requestIdFor({ ...base, confidential: true }), id);
  settleRequestId(base);
  assert.notEqual(requestIdFor(base), id, 'settled: a new id');
});

test('the uuid is a v4 even without crypto.randomUUID', () => {
  const crypto = globalThis.crypto as { randomUUID?: unknown };
  const original = crypto.randomUUID;
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
  try {
    for (let i = 0; i < 20; i += 1) assert.match(newRequestId(), UUID);
  } finally {
    Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
  }
});

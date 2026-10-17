import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONVERSATION_MISS_LIMIT,
  CONVERSATION_MISS_TTL_MS,
  fetchConversationForMetadata,
  forgetConversationMisses,
} from '@/lib/api/server';

/** A public chat as the route answers it, cut to the fields the page reads. */
const publicChat = {
  success: true,
  data: {
    id: 'public-chat',
    title: 'Serving a notice to quit',
    messages_count: 4,
    meta: { title: 'Serving a notice to quit', description: 'SEO text', canonical: 'https://lawexa.com/c/public-chat' },
  },
};

const originalFetch = globalThis.fetch;
const originalNow = Date.now;
let now = 1_000_000;
let calls: string[] = [];
let statusFor: (url: string) => number = () => 404;

beforeEach(() => {
  forgetConversationMisses();
  now = 1_000_000;
  calls = [];
  statusFor = () => 404;
  Date.now = () => now;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const status = statusFor(url);
    const body = status === 200 ? publicChat : { success: false, message: 'Not found' };
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Date.now = originalNow;
  forgetConversationMisses();
});

const readsOf = (id: string) => calls.filter((url) => url.endsWith(`/api/public/conversations/${id}`)).length;

test('a 404 is remembered: the same id is not asked again within 60 s', async () => {
  assert.equal(await fetchConversationForMetadata('space-chat'), null);
  now += 11_000;
  assert.equal(await fetchConversationForMetadata('space-chat'), null);
  now += CONVERSATION_MISS_TTL_MS - 11_001;
  assert.equal(await fetchConversationForMetadata('space-chat'), null);
  assert.equal(readsOf('space-chat'), 1);
});

test('after 60 s the 404 is forgotten and the route is asked again', async () => {
  await fetchConversationForMetadata('space-chat');
  now += CONVERSATION_MISS_TTL_MS;
  await fetchConversationForMetadata('space-chat');
  assert.equal(readsOf('space-chat'), 2);
});

test('a chat that turns public after its 60 s gets its head tags', async () => {
  await fetchConversationForMetadata('space-chat');
  statusFor = () => 200;
  now += CONVERSATION_MISS_TTL_MS;
  assert.equal((await fetchConversationForMetadata('space-chat'))?.title, 'Serving a notice to quit');
});

test('a 200 behaves as before: the metadata comes back and nothing is remembered', async () => {
  statusFor = () => 200;
  const first = await fetchConversationForMetadata('public-chat');
  assert.equal(first?.title, 'Serving a notice to quit');
  assert.equal(first?.meta.canonical, 'https://lawexa.com/c/public-chat');
  await fetchConversationForMetadata('public-chat');
  assert.equal(readsOf('public-chat'), 2);
});

test('a refusal or a server error is not remembered', async () => {
  for (const status of [429, 500, 503]) {
    forgetConversationMisses();
    calls = [];
    statusFor = () => status;
    assert.equal(await fetchConversationForMetadata('busy-chat'), null);
    assert.equal(await fetchConversationForMetadata('busy-chat'), null);
    assert.equal(readsOf('busy-chat'), 2, `status ${status}`);
  }
});

test('a network failure gives null and is not remembered', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  assert.equal(await fetchConversationForMetadata('down-chat'), null);
  assert.equal(await fetchConversationForMetadata('down-chat'), null);
  assert.equal(readsOf('down-chat'), 2);
});

test('a 404 for one id does not stop another id being read', async () => {
  statusFor = (url) => (url.endsWith('/space-chat') ? 404 : 200);
  assert.equal(await fetchConversationForMetadata('space-chat'), null);
  assert.equal((await fetchConversationForMetadata('public-chat'))?.title, 'Serving a notice to quit');
  assert.equal(readsOf('public-chat'), 1);
});

test('the memory is bounded: past the limit the oldest id is forgotten first', async () => {
  for (let i = 0; i < CONVERSATION_MISS_LIMIT; i += 1) {
    await fetchConversationForMetadata(`chat-${i}`);
  }
  await fetchConversationForMetadata('chat-new');
  calls = [];

  await fetchConversationForMetadata('chat-0');
  assert.equal(readsOf('chat-0'), 1, 'the oldest id was dropped to make room');

  await fetchConversationForMetadata('chat-new');
  await fetchConversationForMetadata(`chat-${CONVERSATION_MISS_LIMIT - 1}`);
  assert.equal(readsOf('chat-new'), 0, 'the newest id is still remembered');
  assert.equal(readsOf(`chat-${CONVERSATION_MISS_LIMIT - 1}`), 0, 'a recent id is still remembered');
});

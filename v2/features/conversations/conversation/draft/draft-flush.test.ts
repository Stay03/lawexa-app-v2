import { test } from 'node:test';
import assert from 'node:assert/strict';

import { flushDraftsBeforeSend, registerDraftFlush } from './draft-flush';

/* A message waits for the open drafts' saves, so Lawexa reads the last words
 * typed (drafts saved as notes, thread 1e44eb39). */

const later = <T,>(value: T, ms: number) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

test('with no draft open, a send goes at once', async () => {
  assert.equal(await flushDraftsBeforeSend('chat-none', 50), 'saved');
});

test('a send waits for every open draft of its chat to save', async () => {
  const order: string[] = [];
  const off1 = registerDraftFlush('chat-a', 0, async () => {
    await later(null, 10);
    order.push('draft 0 saved');
    return true;
  });
  const off2 = registerDraftFlush('chat-a', 3, async () => {
    await later(null, 20);
    order.push('draft 3 saved');
    return true;
  });
  // Another chat's draft is not waited for.
  const off3 = registerDraftFlush('chat-b', 0, () => new Promise<boolean>(() => {}));
  assert.equal(await flushDraftsBeforeSend('chat-a', 500), 'saved');
  assert.deepEqual(order, ['draft 0 saved', 'draft 3 saved']);
  off1();
  off2();
  off3();
});

test('a failed save, a thrown one or a slow one sends anyway, and says the edits may be missed', async () => {
  const off1 = registerDraftFlush('chat-c', 0, async () => false);
  assert.equal(await flushDraftsBeforeSend('chat-c', 200), 'unsaved');
  off1();

  const off2 = registerDraftFlush('chat-c', 0, async () => {
    throw new Error('network');
  });
  assert.equal(await flushDraftsBeforeSend('chat-c', 200), 'unsaved');
  off2();

  const off3 = registerDraftFlush('chat-c', 0, () => later(true, 1_000));
  const started = Date.now();
  assert.equal(await flushDraftsBeforeSend('chat-c', 50), 'unsaved');
  assert.ok(Date.now() - started < 500, 'the send is never held past the limit');
  off3();
});

test('a closed draft is no longer waited for, and an old registration never removes a newer one', async () => {
  const off = registerDraftFlush('chat-d', 0, async () => false);
  off();
  assert.equal(await flushDraftsBeforeSend('chat-d', 50), 'saved');

  const offOld = registerDraftFlush('chat-e', 0, async () => false);
  const offNew = registerDraftFlush('chat-e', 0, async () => true);
  offOld();
  assert.equal(await flushDraftsBeforeSend('chat-e', 50), 'saved');
  offNew();
  assert.equal(await flushDraftsBeforeSend('chat-e', 50), 'saved');
});

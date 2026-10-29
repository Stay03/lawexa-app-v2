import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  clearDraftSuperseded,
  flushDraftsBeforeSend,
  isDraftSuperseded,
  markDraftSuperseded,
  registerDraftFlush,
  saveAllNow,
  trackDraftSave,
} from './draft-flush';

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

test('a save sent as the panel closes is waited for by a send made at once', async () => {
  let land: (saved: boolean) => void = () => {};
  const leaving = new Promise<boolean>((resolve) => {
    land = resolve;
  });
  trackDraftSave('chat-f', leaving);
  const order: string[] = [];
  const send = flushDraftsBeforeSend('chat-f', 500).then((outcome) => order.push(`send (${outcome})`));
  await later(null, 20);
  order.push('save lands');
  land(true);
  await send;
  assert.deepEqual(order, ['save lands', 'send (saved)']);
  // Once settled it is forgotten.
  assert.equal(await flushDraftsBeforeSend('chat-f', 50), 'saved');
  // A leaving save that fails says so.
  trackDraftSave('chat-f', Promise.resolve(false));
  assert.equal(await flushDraftsBeforeSend('chat-f', 50), 'unsaved');
});

test('an editor overtaken by Lawexa’s newer version is marked, so it sends nothing as it goes; editing again clears it', () => {
  assert.equal(isDraftSuperseded('chat-g', 5, 2141), false);
  markDraftSuperseded('chat-g', 5, 2141);
  assert.equal(isDraftSuperseded('chat-g', 5, 2141), true);
  // Another draft, or another note, is untouched.
  assert.equal(isDraftSuperseded('chat-g', 7, 2141), false);
  assert.equal(isDraftSuperseded('chat-g', 5, 9), false);
  clearDraftSuperseded('chat-g', 5, 2141);
  assert.equal(isDraftSuperseded('chat-g', 5, 2141), false);
});

test('a turn saves the open drafts before it posts the message (submit and Ask again)', () => {
  const controller = readFileSync(join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'useConversationController.ts'), 'utf8');
  for (const start of ['const submit = useCallback', 'const regenerate = useCallback']) {
    const from = controller.indexOf(start);
    // The turn's own body: up to the next hook after it.
    const body = controller.slice(from, controller.indexOf('useCallback(', from + start.length));
    const flush = body.indexOf('await flushDraftsBeforeSend(conversationId)');
    const post = body.indexOf('await send(');
    assert.ok(flush > 0 && post > flush, start);
  }
});

/** An editor's save machine, as `saveAllNow` sees it, run by a script of statuses and saves. */
function editorScript(steps: { status: string; save?: Promise<boolean> | null }[]) {
  let at = -1;
  let flushes = 0;
  return {
    flushes: () => flushes,
    editor: {
      flush: () => {
        flushes += 1;
        at = Math.min(at + 1, steps.length - 1);
      },
      currentStatus: () => steps[at].status,
      lastSave: () => steps[at].save ?? null,
      stopped: (status: string) => status === 'error' || status === 'conflict' || status === 'blocked',
    },
  };
}

test('saving now waits on the save itself, and goes round again while the reader typed on', async () => {
  // Nothing typed: saved at once.
  assert.equal(await saveAllNow(editorScript([{ status: 'clean' }]).editor), true);
  // A save on the wire, then all saved.
  const first = editorScript([{ status: 'saving', save: later(true, 10) }, { status: 'clean' }]);
  assert.equal(await saveAllNow(first.editor), true);
  // A save, more typing saved by a second save, then clean.
  const two = editorScript([
    { status: 'saving', save: later(true, 5) },
    { status: 'saving', save: later(true, 5) },
    { status: 'clean' },
  ]);
  assert.equal(await saveAllNow(two.editor), true);
  assert.equal(two.flushes(), 3);
});

test('saving now says no on a failed save, a stopped machine, or typing held by the rate limit', async () => {
  assert.equal(await saveAllNow(editorScript([{ status: 'saving', save: later(false, 5) }]).editor), false);
  assert.equal(await saveAllNow(editorScript([{ status: 'conflict' }]).editor), false);
  assert.equal(await saveAllNow(editorScript([{ status: 'pending', save: Promise.resolve(true) }]).editor), false);
});

test('a panel that closes while its save is on the wire still answers, from that save', async () => {
  // The editor unmounts: its machine is no longer told, so it reads "saving" with the same save.
  const save = later(true, 10);
  const closing = editorScript([{ status: 'saving', save }, { status: 'saving', save }]);
  assert.equal(await saveAllNow(closing.editor), true);
});

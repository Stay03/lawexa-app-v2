import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIntentPrefetch, INTENT_REST_MS } from './intent-prefetch';

/** Manual timers: `tick()` runs whatever is still scheduled. */
function harness() {
  const sent: string[] = [];
  const timers = new Map<number, () => void>();
  let id = 0;
  const intent = createIntentPrefetch((href) => sent.push(href), {
    setTimer: (run) => {
      id += 1;
      timers.set(id, run);
      return id;
    },
    clearTimer: (timer) => timers.delete(timer as number),
  });
  const tick = () => {
    const due = [...timers.values()];
    timers.clear();
    for (const run of due) run();
  };
  return { sent, intent, tick, pending: () => timers.size };
}

test('nothing is prefetched until the reader shows intent', () => {
  const { sent, pending } = harness();
  assert.deepEqual(sent, []);
  assert.equal(pending(), 0);
});

test('a mouse resting on the row prefetches once the rest time passes', () => {
  const { sent, intent, tick } = harness();
  intent.rest('/cases/a');
  assert.deepEqual(sent, []);
  tick();
  assert.deepEqual(sent, ['/cases/a']);
});

test('a mouse passing over the row and leaving prefetches nothing', () => {
  const { sent, intent, tick, pending } = harness();
  intent.rest('/cases/a');
  intent.leave();
  assert.equal(pending(), 0);
  tick();
  assert.deepEqual(sent, []);
});

test('touch and focus prefetch at once, and cancel a pending rest', () => {
  const { sent, intent, tick, pending } = harness();
  intent.now('/cases/a');
  assert.deepEqual(sent, ['/cases/a']);
  const second = harness();
  second.intent.rest('/cases/b');
  second.intent.now('/cases/b');
  assert.equal(second.pending(), 0);
  second.tick();
  assert.deepEqual(second.sent, ['/cases/b']);
  tick();
  assert.equal(pending(), 0);
});

test('one href is prefetched once, however many times the reader returns', () => {
  const { sent, intent, tick } = harness();
  intent.now('/cases/a');
  intent.rest('/cases/a');
  tick();
  intent.now('/cases/a');
  assert.deepEqual(sent, ['/cases/a']);
});

test('the rest time is 100 ms', () => {
  assert.equal(INTENT_REST_MS, 100);
});

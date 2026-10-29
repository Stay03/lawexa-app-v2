import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MutationObserver, QueryClient } from '@tanstack/query-core';

import { sendLeavingSave } from './leaving-save';

/* The save an editor sends as it unmounts must settle, so the chat's next
 * send is not held 3 s and told the edits were lost (Frontend's review of
 * 96d7f7e, 29 October 2026). Run on TanStack's own MutationObserver with its
 * listener gone, as `useMutation` leaves it at unmount. */

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A mutation observer as an unmounted `useMutation` leaves it: subscribed once, then let go. */
function unmountedObserver(response: Promise<string>) {
  const observer = new MutationObserver<string, unknown, string>(new QueryClient(), { mutationFn: () => response });
  const unsubscribe = observer.subscribe(() => {});
  unsubscribe();
  return observer;
}

const settledWithin = (promise: Promise<unknown>, ms: number) =>
  Promise.race([promise.then(() => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms))]);

test('the old way: per-call callbacks never run once the observer has no listener, so its promise never settled', async () => {
  const response = deferred<string>();
  const observer = unmountedObserver(response.promise);
  const settled = new Promise<boolean>((resolve) => {
    void observer.mutate('TEST DATA save', { onSuccess: () => resolve(true), onError: () => resolve(false) }).catch(() => {});
  });
  response.resolve('saved');
  assert.equal(await settledWithin(settled, 100), false);
});

test('the leaving save settles true when it lands, after unmount', async () => {
  const response = deferred<string>();
  const observer = unmountedObserver(response.promise);
  const settled = sendLeavingSave((request: string) => observer.mutate(request), 'TEST DATA save');
  response.resolve('saved');
  assert.equal(await settled, true);
});

test('the leaving save settles false when it fails, after unmount', async () => {
  const response = deferred<string>();
  const observer = unmountedObserver(response.promise);
  const settled = sendLeavingSave((request: string) => observer.mutate(request), 'TEST DATA save');
  response.reject(new Error('offline'));
  assert.equal(await settled, false);
});

test('the autosave hands the unmount save’s own promise to the caller, never a callback-made one', () => {
  const hook = readFileSync(join(process.cwd(), 'v2', 'features', 'notes', 'editor', 'use-autosave.ts'), 'utf8');
  assert.match(hook, /onUnmountSaveRef\.current\?\.\(sendLeavingSave\(mutateAsyncRef\.current, save\)\);/);
  assert.doesNotMatch(hook, /settle\?\./);
});

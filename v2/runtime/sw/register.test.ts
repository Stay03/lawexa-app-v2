import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureServiceWorker, inBatches, removeServiceWorker, staticUrlsFrom } from './register';

const origin = 'https://lawexa.com';

test('warming collects each same-origin /_next/static/ file once', () => {
  const entries = [
    { name: 'https://lawexa.com/_next/static/chunks/a.js?dpl=1' },
    { name: 'https://lawexa.com/_next/static/chunks/a.js?dpl=1' },
    { name: 'https://lawexa.com/_next/static/media/f.woff2?dpl=1' },
    { name: 'https://lawexa.com/api/me' },
    { name: 'https://prod-api.lawexa.com/api/cases' },
    { name: 'https://lawexa.com/_next/image?url=x' },
    { name: 'https://lawexa.com/cases/x' },
  ];
  assert.deepEqual(staticUrlsFrom(entries, origin), [
    'https://lawexa.com/_next/static/chunks/a.js?dpl=1',
    'https://lawexa.com/_next/static/media/f.woff2?dpl=1',
  ]);
});

test('batches never exceed their size and keep the order', () => {
  assert.deepEqual(inBatches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(inBatches([], 100), []);
});

test('outside a browser, registering and removing do nothing and never throw', async () => {
  assert.equal(typeof navigator === 'undefined' || !('serviceWorker' in navigator), true);
  const cleanup = ensureServiceWorker();
  assert.doesNotThrow(cleanup);
  await assert.doesNotReject(removeServiceWorker());
});

test('removal resolves even when the browser refuses, and leaves other workers alone', async () => {
  const unregistered: string[] = [];
  const reg = (scriptPath: string, scope: string) => ({
    scope: `${origin}${scope}`,
    active: { scriptURL: `${origin}${scriptPath}` },
    waiting: null,
    installing: null,
    unregister: async () => {
      unregistered.push(scriptPath);
      return true;
    },
  });
  const g = globalThis as Record<string, unknown>;
  const hadNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const hadCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  const deleted: string[] = [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        getRegistrations: async () => [
          reg('/sw.js', '/'),
          reg('/firebase-messaging-sw.js', '/firebase-cloud-messaging-push-scope'),
        ],
      },
    },
  });
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: {
      keys: async () => ['lawexa-static-v1', 'lawexa-sw-meta', 'someone-else'],
      delete: async (name: string) => {
        deleted.push(name);
        return true;
      },
    },
  });
  try {
    await removeServiceWorker();
    assert.deepEqual(unregistered, ['/sw.js']);
    assert.deepEqual(deleted.sort(), ['lawexa-static-v1', 'lawexa-sw-meta']);

    // A browser that throws on every call: removal still resolves.
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { serviceWorker: { getRegistrations: async () => { throw new Error('denied'); } } },
    });
    await assert.doesNotReject(removeServiceWorker());
  } finally {
    if (hadNavigator) Object.defineProperty(globalThis, 'navigator', hadNavigator);
    else delete g.navigator;
    if (hadCaches) Object.defineProperty(globalThis, 'caches', hadCaches);
    else delete g.caches;
  }
});

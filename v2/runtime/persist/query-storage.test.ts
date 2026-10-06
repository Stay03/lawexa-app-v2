import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryBackend } from './memory-backend';
import { createQueryStorage } from './query-storage';
import { deviceCacheOwnerOf } from './policy';

/** As `setDeviceCacheOwner` turns the owner id into the storage's owner key. */
const ownerKey = (owner: number | null) => (owner === null ? null : String(owner));

test('with no owner (signed out) nothing is read or written', async () => {
  const { backend, answers } = memoryBackend();
  const storage = createQueryStorage(backend);
  await storage.setItem('k', { a: 1 });
  assert.equal(answers.size, 0);
  assert.equal(await storage.getItem('k'), undefined);
  assert.deepEqual(await storage.entries(), []);
});

test('a guest session gets no owner, so nothing is read or written for it', async () => {
  const { backend, answers } = memoryBackend();
  const storage = createQueryStorage(backend);
  // A guest has a user id; the owner rule still turns the cache off.
  storage.setOwner(ownerKey(deviceCacheOwnerOf(42, 'guest')));
  await storage.setItem('k', { a: 1 });
  assert.equal(answers.size, 0);
  assert.equal(await storage.getItem('k'), undefined);
  // The same id signed in as an account stores under its owner.
  storage.setOwner(ownerKey(deviceCacheOwnerOf(42, 'user')));
  await storage.setItem('k', { a: 1 });
  assert.deepEqual([...answers.keys()], ['42/k']);
});

test('rows are stored under the owner, and each owner reads only its own', async () => {
  const { backend, answers } = memoryBackend();
  const storage = createQueryStorage(backend);
  storage.setOwner('7');
  await storage.setItem('k', { a: 7 });
  assert.deepEqual([...answers.keys()], ['7/k']);
  storage.setOwner('8');
  assert.equal(await storage.getItem('k'), undefined);
  assert.deepEqual(await storage.entries(), []);
  storage.setOwner('7');
  assert.deepEqual(await storage.getItem('k'), { a: 7 });
  assert.deepEqual(await storage.entries(), [['k', { a: 7 }]]);
});

test('an account switch deletes the other owners\' rows; sign-out deletes all', async () => {
  const { backend, answers } = memoryBackend();
  const storage = createQueryStorage(backend);
  storage.setOwner('7');
  await storage.setItem('a', 1);
  storage.setOwner('8');
  await storage.setItem('b', 2);
  await storage.dropOtherOwners();
  assert.deepEqual([...answers.keys()], ['8/b']);
  storage.setOwner(null);
  await storage.dropOtherOwners();
  assert.equal(answers.size, 0);
});

test('clearAll deletes every owner', async () => {
  const { backend, answers, meta } = memoryBackend();
  const storage = createQueryStorage(backend);
  storage.setOwner('7');
  await storage.setItem('a', 1);
  await storage.notePlan('1:none:free');
  await storage.clearAll();
  assert.equal(answers.size, 0);
  assert.equal(meta.size, 0);
});

test('an answer over the per-row cap is not kept, and an older copy of it is deleted', async () => {
  const { backend, answers } = memoryBackend();
  const storage = createQueryStorage(backend, { maxEntryBytes: 50 });
  storage.setOwner('7');
  await storage.setItem('k', 'small');
  assert.equal(answers.has('7/k'), true);
  await storage.setItem('k', 'x'.repeat(200));
  assert.equal(answers.has('7/k'), false);
});

test('the store is trimmed oldest-first to the row cap and the 50 MB style total cap', async () => {
  let clock = 0;
  const { backend, answers } = memoryBackend();
  const storage = createQueryStorage(backend, { now: () => ++clock, maxRows: 3, maxTotalBytes: 1000 });
  storage.setOwner('7');
  for (const key of ['a', 'b', 'c', 'd']) await storage.setItem(key, key);
  assert.deepEqual([...answers.keys()].sort(), ['7/b', '7/c', '7/d']);

  const bytes = memoryBackend();
  const capped = createQueryStorage(bytes.backend, { now: () => ++clock, maxRows: 100, maxTotalBytes: 250 });
  capped.setOwner('7');
  await capped.setItem('old', 'x'.repeat(100));
  await capped.setItem('mid', 'x'.repeat(100));
  await capped.setItem('new', 'x'.repeat(100));
  assert.deepEqual([...bytes.answers.keys()].sort(), ['7/mid', '7/new']);
});

test('a plan change deletes the owner\'s rows; the first plan seen and an unchanged plan do not', async () => {
  const { backend, answers } = memoryBackend();
  const storage = createQueryStorage(backend);
  storage.setOwner('7');
  await storage.setItem('case', { body: 'full' });
  assert.equal(await storage.notePlan('2:active:paid'), false);
  assert.equal(await storage.notePlan('2:active:paid'), false);
  assert.equal(answers.has('7/case'), true);
  assert.equal(await storage.notePlan('1:none:free'), true);
  assert.equal(answers.has('7/case'), false);
});

test('a plan change for one owner leaves another owner\'s rows alone', async () => {
  const { backend, answers } = memoryBackend();
  const storage = createQueryStorage(backend);
  storage.setOwner('8');
  await storage.setItem('x', 1);
  storage.setOwner('7');
  await storage.notePlan('2:active:paid');
  await storage.setItem('y', 1);
  await storage.notePlan('1:none:free');
  assert.deepEqual([...answers.keys()], ['8/x']);
});

test('blocked storage reads as a miss and writes as nothing, never a throw', async () => {
  const { backend } = memoryBackend({ fail: true });
  const storage = createQueryStorage(backend);
  storage.setOwner('7');
  await storage.setItem('k', 1);
  assert.equal(await storage.getItem('k'), undefined);
  assert.deepEqual(await storage.entries(), []);
  await storage.removeItem('k');
  await storage.dropOtherOwners();
  await storage.clearAll();
  assert.equal(await storage.notePlan('p'), false);
});

test('a read that does not answer in time is a miss', async () => {
  const { backend } = memoryBackend({ stall: true });
  const storage = createQueryStorage(backend, { readTimeoutMs: 20 });
  storage.setOwner('7');
  const started = Date.now();
  assert.equal(await storage.getItem('k'), undefined);
  assert.ok(Date.now() - started < 1000);
});

test('no backend (server, no IndexedDB) is a no-op', async () => {
  const storage = createQueryStorage(null);
  storage.setOwner('7');
  await storage.setItem('k', 1);
  assert.equal(await storage.getItem('k'), undefined);
  assert.equal(await storage.notePlan('p'), false);
});

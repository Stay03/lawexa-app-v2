import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { CHUNK_RELOAD_WINDOW_MS, claimChunkReload, isChunkLoadError, type StampStorage } from './chunk-reload';

const memory = (): StampStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
};

test('a chunk that failed to load is told from any other crash', () => {
  assert.equal(isChunkLoadError({ name: 'ChunkLoadError', message: 'Loading chunk 731 failed.' }), true);
  assert.equal(isChunkLoadError({ name: 'Error', message: 'Loading chunk app/v2/c/page failed.' }), true);
  assert.equal(isChunkLoadError({ name: 'Error', message: 'Loading CSS chunk 12 failed.' }), true);
  assert.equal(
    isChunkLoadError({ name: 'TypeError', message: 'Failed to fetch dynamically imported module: https://x/_next/a.js' }),
    true,
  );
  assert.equal(isChunkLoadError({ name: 'TypeError', message: "Cannot read properties of undefined (reading 'id')" }), false);
  assert.equal(isChunkLoadError(null), false);
});

test('one reload per path per minute, then the screen shows', () => {
  const storage = memory();
  const t0 = 1_000_000;
  assert.equal(claimChunkReload(storage, '/v2/c/abc', t0), true);
  // The same path again within the minute: a real outage, no loop.
  assert.equal(claimChunkReload(storage, '/v2/c/abc', t0 + 5_000), false);
  // Another path is its own.
  assert.equal(claimChunkReload(storage, '/v2/c/def', t0 + 5_000), true);
  // After the minute, the same path may reload again.
  assert.equal(claimChunkReload(storage, '/v2/c/abc', t0 + CHUNK_RELOAD_WINDOW_MS), true);
});

test('storage that is missing or throws means no reload', () => {
  assert.equal(claimChunkReload(null, '/v2/c/abc', 1), false);
  const throwing: StampStorage = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('SecurityError');
    },
  };
  assert.equal(claimChunkReload(throwing, '/v2/c/abc', 1), false);
  // A junk stamp is not a recent reload.
  const storage = memory();
  storage.setItem('lawexa-chunk-reload:/x', 'not a time');
  assert.equal(claimChunkReload(storage, '/x', 1_000), true);
});

test('the v2 error screen reloads once for a chunk error, after the chat screen has sent its report', () => {
  const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf8');
  const screen = read('app', 'v2', 'error.tsx');
  assert.match(screen, /if \(!isChunkLoadError\(error\) \|\| !claimChunkReload\(sessionStore\(\), window\.location\.pathname, Date\.now\(\)\)\) return;/);
  assert.match(screen, /window\.location\.reload\(\)/);
  // "Try again" stays for every other crash.
  assert.match(screen, /onClick=\{reset\}/);
  const chat = read('app', 'v2', 'c', '[conversationId]', 'error.tsx');
  assert.match(chat, /const beforeReload = useCallback\(\(\) => sendChatError\(report\), \[report\]\);/);
  assert.match(chat, /<V2Error error=\{error\} reset=\{reset\} beforeReload=\{beforeReload\} \/>/);
  assert.match(chat, /code: 'chat_view_crash'/);
});

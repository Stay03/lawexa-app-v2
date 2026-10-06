import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { StoredRowSize } from './policy';
import type { StoreBackend } from './query-storage';

/**
 * The browser's backend for the device cache: one IndexedDB database,
 * `lawexa-query-cache`, separate from the confidential transcripts
 * (`lawexa-confidential`) and the note drafts (`lawexa-note-drafts`), which it
 * never touches.
 *
 * - `answers`: the kept query, keyed `${owner}/${key}`.
 * - `sizes`:   one small record per answer (key, bytes, written at), so the caps
 *              are checked without reading the answers themselves.
 * - `meta`:    the last plan seen per owner.
 *
 * Same module shape as `notes/editor/draft-mirror.ts`: one lazily opened
 * connection; `null` where IndexedDB does not exist.
 */
const DB_NAME = 'lawexa-query-cache';
const DB_VERSION = 1;

interface QueryCacheDB extends DBSchema {
  answers: { key: string; value: unknown };
  sizes: { key: string; value: StoredRowSize };
  meta: { key: string; value: string };
}

let dbPromise: Promise<IDBPDatabase<QueryCacheDB>> | null = null;

function getDB(): Promise<IDBPDatabase<QueryCacheDB>> {
  dbPromise ??= openDB<QueryCacheDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('answers')) db.createObjectStore('answers');
      if (!db.objectStoreNames.contains('sizes')) db.createObjectStore('sizes', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    },
  });
  // A failed open is not cached: the next call tries again.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

export function idbBackend(): StoreBackend | null {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null;
  return {
    async get(key) {
      return (await getDB()).get('answers', key);
    },

    async put(key, value, size) {
      const tx = (await getDB()).transaction(['answers', 'sizes'], 'readwrite');
      await Promise.all([tx.objectStore('answers').put(value, key), tx.objectStore('sizes').put(size), tx.done]);
    },

    async delete(keys) {
      if (!keys.length) return;
      const tx = (await getDB()).transaction(['answers', 'sizes'], 'readwrite');
      const answers = tx.objectStore('answers');
      const sizes = tx.objectStore('sizes');
      await Promise.all([...keys.flatMap((key) => [answers.delete(key), sizes.delete(key)]), tx.done]);
    },

    async sizes() {
      return (await getDB()).getAll('sizes');
    },

    async entries(prefix) {
      const db = await getDB();
      const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
      const tx = db.transaction('answers');
      const [keys, values] = await Promise.all([tx.store.getAllKeys(range), tx.store.getAll(range), tx.done]);
      return keys.map((key, index) => [key, values[index]] as [string, unknown]);
    },

    async getMeta(key) {
      return (await getDB()).get('meta', key);
    },

    async setMeta(key, value) {
      await (await getDB()).put('meta', value, key);
    },

    async clear() {
      const tx = (await getDB()).transaction(['answers', 'sizes', 'meta'], 'readwrite');
      await Promise.all([tx.objectStore('answers').clear(), tx.objectStore('sizes').clear(), tx.objectStore('meta').clear(), tx.done]);
    },
  };
}

import type { StoredRowSize } from './policy';
import type { StoreBackend } from './query-storage';

/**
 * An in-memory `StoreBackend` with the same contract as the IndexedDB one, for
 * the device-cache tests. `fail` makes every call reject (blocked storage);
 * `stall` makes reads never answer (a hung IndexedDB open).
 */
export function memoryBackend(options: { fail?: boolean; stall?: boolean } = {}) {
  const answers = new Map<string, unknown>();
  const sizes = new Map<string, StoredRowSize>();
  const meta = new Map<string, string>();
  const guard = async () => {
    if (options.fail) throw new Error('blocked');
  };
  const backend: StoreBackend = {
    async get(key) {
      await guard();
      if (options.stall) return new Promise(() => undefined);
      return answers.get(key);
    },
    async put(key, value, size) {
      await guard();
      answers.set(key, value);
      sizes.set(key, size);
    },
    async delete(keys) {
      await guard();
      for (const key of keys) {
        answers.delete(key);
        sizes.delete(key);
      }
    },
    async sizes() {
      await guard();
      return [...sizes.values()];
    },
    async entries(prefix) {
      await guard();
      return [...answers.entries()].filter(([key]) => key.startsWith(prefix));
    },
    async getMeta(key) {
      await guard();
      return meta.get(key);
    },
    async setMeta(key, value) {
      await guard();
      meta.set(key, value);
    },
    async clear() {
      await guard();
      answers.clear();
      sizes.clear();
      meta.clear();
    },
  };
  return { backend, answers, sizes, meta };
}

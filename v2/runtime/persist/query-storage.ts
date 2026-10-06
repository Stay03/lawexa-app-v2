import {
  PERSIST_MAX_ENTRY_BYTES,
  PERSIST_MAX_ROWS,
  PERSIST_MAX_TOTAL_BYTES,
  PERSIST_READ_TIMEOUT_MS,
  sizeOf,
  trimPlan,
  type StoredRowSize,
} from './policy';

/**
 * The device cache's storage: what TanStack's persister reads and writes
 * (`AsyncStorage`), partitioned by owner and held to the size caps.
 *
 * OWNER. Every row is stored under `${owner}/${key}`, and reads and listings
 * see only the current owner's rows. The owner is the server-verified user id,
 * set by the identity guard; with no owner (signed out) nothing is read or
 * written. So a switch of account makes the previous account's rows
 * unreachable at once, before the wipe that follows lands.
 *
 * NEVER THROWS. Blocked IndexedDB, private mode, a full disk or a stalled open
 * all read as a miss and write as nothing: the app then behaves as it does
 * without the cache. A read slower than `PERSIST_READ_TIMEOUT_MS` is a miss.
 *
 * The backend is injected so the rules are tested without a browser
 * (`idb-backend.ts` is the browser's).
 */
export interface StoreBackend {
  get(key: string): Promise<unknown>;
  /** Writes the row and its size record together. */
  put(key: string, value: unknown, size: StoredRowSize): Promise<void>;
  delete(keys: readonly string[]): Promise<void>;
  /** Size records of every row, every owner. */
  sizes(): Promise<StoredRowSize[]>;
  /** Rows whose key starts with `prefix`. */
  entries(prefix: string): Promise<Array<[string, unknown]>>;
  getMeta(key: string): Promise<string | undefined>;
  setMeta(key: string, value: string): Promise<void>;
  /** Every row, size record and marker, every owner. */
  clear(): Promise<void>;
}

export interface QueryStorage {
  setOwner(owner: string | null): void;
  getOwner(): string | null;
  getItem(key: string): Promise<unknown>;
  setItem(key: string, value: unknown): Promise<void>;
  removeItem(key: string): Promise<void>;
  entries(): Promise<Array<[string, unknown]>>;
  /** Deletes every row that is not the current owner's (all rows when there is
   *  no owner). The account-switch and sign-out wipe. */
  dropOtherOwners(): Promise<void>;
  /** Deletes everything, every owner. */
  clearAll(): Promise<void>;
  /** Records the reader's plan; when it differs from the last one recorded for
   *  this owner, deletes the owner's rows. Resolves `true` when it deleted. */
  notePlan(planKey: string): Promise<boolean>;
}

export interface QueryStorageOptions {
  now?: () => number;
  readTimeoutMs?: number;
  maxEntryBytes?: number;
  maxRows?: number;
  maxTotalBytes?: number;
}

const SEP = '/';

async function quietly<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

export function createQueryStorage(
  backend: StoreBackend | null,
  options: QueryStorageOptions = {},
): QueryStorage {
  const now = options.now ?? Date.now;
  const readTimeoutMs = options.readTimeoutMs ?? PERSIST_READ_TIMEOUT_MS;
  const maxEntryBytes = options.maxEntryBytes ?? PERSIST_MAX_ENTRY_BYTES;
  const maxRows = options.maxRows ?? PERSIST_MAX_ROWS;
  const maxTotalBytes = options.maxTotalBytes ?? PERSIST_MAX_TOTAL_BYTES;
  let owner: string | null = null;

  const full = (who: string, key: string) => `${who}${SEP}${key}`;

  async function trim(): Promise<void> {
    if (!backend) return;
    const remove = trimPlan(await backend.sizes(), maxRows, maxTotalBytes);
    if (remove.length) await backend.delete(remove);
  }

  return {
    setOwner(next) {
      owner = next;
    },

    getOwner() {
      return owner;
    },

    getItem(key) {
      const who = owner;
      if (!backend || who === null) return Promise.resolve(undefined);
      return quietly(
        () =>
          new Promise<unknown>((resolve, reject) => {
            const timer = setTimeout(() => resolve(undefined), readTimeoutMs);
            backend.get(full(who, key)).then(
              (value) => {
                clearTimeout(timer);
                resolve(value ?? undefined);
              },
              (error: unknown) => {
                clearTimeout(timer);
                reject(error);
              },
            );
          }),
        undefined,
      );
    },

    setItem(key, value) {
      const who = owner;
      if (!backend || who === null) return Promise.resolve();
      return quietly(async () => {
        const bytes = sizeOf(value);
        const rowKey = full(who, key);
        if (bytes > maxEntryBytes) {
          // Too large to keep: also drop an older, smaller copy, so a stale
          // version is never painted in place of the answer we refused.
          await backend.delete([rowKey]);
          return;
        }
        await backend.put(rowKey, value, { key: rowKey, bytes, at: now() });
        await trim();
      }, undefined);
    },

    removeItem(key) {
      const who = owner;
      if (!backend || who === null) return Promise.resolve();
      return quietly(() => backend.delete([full(who, key)]), undefined);
    },

    entries() {
      const who = owner;
      if (!backend || who === null) return Promise.resolve([]);
      const prefix = full(who, '');
      return quietly(async () => {
        const rows = await backend.entries(prefix);
        return rows.map(([key, value]) => [key.slice(prefix.length), value] as [string, unknown]);
      }, []);
    },

    dropOtherOwners() {
      if (!backend) return Promise.resolve();
      const who = owner;
      return quietly(async () => {
        if (who === null) {
          await backend.clear();
          return;
        }
        const mine = full(who, '');
        const others = (await backend.sizes()).map((row) => row.key).filter((key) => !key.startsWith(mine));
        if (others.length) await backend.delete(others);
      }, undefined);
    },

    clearAll() {
      if (!backend) return Promise.resolve();
      return quietly(() => backend.clear(), undefined);
    },

    notePlan(planKey) {
      const who = owner;
      if (!backend || who === null) return Promise.resolve(false);
      return quietly(async () => {
        const markerKey = `plan${SEP}${who}`;
        const previous = await backend.getMeta(markerKey);
        await backend.setMeta(markerKey, planKey);
        if (previous === undefined || previous === planKey) return false;
        const mine = full(who, '');
        const rows = (await backend.sizes()).map((row) => row.key).filter((key) => key.startsWith(mine));
        if (rows.length) await backend.delete(rows);
        return true;
      }, false);
    },
  };
}

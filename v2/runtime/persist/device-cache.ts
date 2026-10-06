import { idbBackend } from './idb-backend';
import { makeV2Persister, type V2Persister } from './persister';
import { createQueryStorage, type QueryStorage } from './query-storage';

/**
 * The device cache for this browser tab: one storage and one persister, built
 * on first use, never on the server. Every function here is a no-op on the
 * server and where IndexedDB does not exist.
 *
 * Who calls what:
 * - `query-provider.tsx` passes `deviceCachePersister()` to the browser client.
 * - `cache-identity-guard.tsx` calls `setDeviceCacheOwner(userId)` on every
 *   render and `dropOtherDeviceCacheOwners()` when the viewer changes.
 * - `sign-out.ts` calls `clearDeviceCache()`.
 * - `PlanCacheWatch` calls `noteDeviceCachePlan()` when the plan is known.
 */
let storage: QueryStorage | null = null;
let persister: V2Persister | null = null;
let maintainedFor: string | null = null;

function ensure(): { storage: QueryStorage; persister: V2Persister } | null {
  if (typeof window === 'undefined') return null;
  if (!storage) {
    const backend = idbBackend();
    if (!backend) return null;
    storage = createQueryStorage(backend);
    persister = makeV2Persister(storage);
  }
  return { storage, persister: persister as V2Persister };
}

/** The `persister` for the browser client, or `undefined` (server, no IndexedDB). */
export function deviceCachePersister(): V2Persister['persisterFn'] | undefined {
  return ensure()?.persister.persisterFn;
}

/**
 * The server-verified viewer whose rows may be read and written; `null` (signed
 * out) turns the cache off. The first time an owner is set in this tab, expired
 * rows and rows from another schema version are removed in the background.
 */
export function setDeviceCacheOwner(userId: number | null): void {
  const cache = ensure();
  if (!cache) return;
  const owner = userId === null ? null : String(userId);
  cache.storage.setOwner(owner);
  if (owner !== null && maintainedFor !== owner) {
    maintainedFor = owner;
    void cache.persister.gc().catch(() => undefined);
  }
}

/** The account-switch wipe: every row that is not the current viewer's. */
export function dropOtherDeviceCacheOwners(): Promise<void> {
  return ensure()?.storage.dropOtherOwners() ?? Promise.resolve();
}

/** The sign-out wipe: every row, every account. */
export function clearDeviceCache(): Promise<void> {
  return ensure()?.storage.clearAll() ?? Promise.resolve();
}

/** Records the viewer's plan; a change drops every row the viewer has. */
export function noteDeviceCachePlan(planKey: string): Promise<boolean> {
  return ensure()?.storage.notePlan(planKey) ?? Promise.resolve(false);
}

'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  SESSION_PRESENT_COOKIE,
  SESSION_PRESENT_VALUE,
} from '@/v2/runtime/session-cookie';

/**
 * Bridges the v1 client token (localStorage zustand) into the v2 httpOnly
 * session cookie that the server DAL reads.
 *
 * Client JS cannot read the httpOnly `lawexa-session` cookie, so the sync can
 * never compare the mirrored token against the current one. The rules (fixing
 * the reviewer's token-swap finding — guest→login must re-mirror):
 *
 *  - Token present  → POST once per page load PER TOKEN VALUE, unconditionally
 *    overwriting whatever was mirrored before. `lastSyncedToken` (module state)
 *    dedupes within the load; the readable marker is deliberately NOT used to
 *    skip POSTs — it can't tell WHICH token is mirrored, only that one is.
 *  - Token absent   → DELETE when the marker says something is mirrored (or a
 *    token was synced earlier this load); otherwise a silent no-op.
 *  - Token changes while a sync is in flight → syncs are SERIALIZED on a
 *    promise queue, so the change is applied after, never dropped.
 *
 * Pure network side-effect in an effect (no `setState` — React Compiler lint).
 * Failures are swallowed and `lastSyncedToken` resets so the next effect run /
 * mount retries; a transient error must never break the page.
 */

// Serialized sync queue (StrictMode double-invoke and concurrent mounts fold
// into no-ops via lastSyncedToken; a mid-flight token change queues behind).
let queue: Promise<void> = Promise.resolve();
// undefined = nothing synced this page load; null = synced signed-out state.
let lastSyncedToken: string | null | undefined;

function markerPresent(): boolean {
  return document.cookie
    .split('; ')
    .some(
      (entry) => entry === `${SESSION_PRESENT_COOKIE}=${SESSION_PRESENT_VALUE}`,
    );
}

async function doSync(token: string | null): Promise<void> {
  // Already reflected this exact state during this page load.
  if (token === lastSyncedToken) return;

  if (!token && lastSyncedToken === undefined && !markerPresent()) {
    // Fresh load, signed out, nothing mirrored — nothing to clear.
    lastSyncedToken = null;
    return;
  }

  try {
    const response = token
      ? await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
      : await fetch('/api/session', { method: 'DELETE' });
    // On failure, forget — the next run retries instead of trusting a bad sync.
    lastSyncedToken = response.ok ? token : undefined;
  } catch {
    lastSyncedToken = undefined;
  }
}

function syncSession(token: string | null): void {
  queue = queue.then(() => doSync(token));
}

/**
 * Renders nothing. Mounted once in the v2 layout; re-runs when the zustand token
 * changes (guest→login, login, logout) so the cookie always tracks the CURRENT
 * identity.
 */
export function SessionSync(): null {
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    syncSession(token);
  }, [token]);

  return null;
}

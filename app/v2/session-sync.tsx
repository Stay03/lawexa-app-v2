'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  SESSION_PRESENT_COOKIE,
  SESSION_PRESENT_VALUE,
} from '@/v2/runtime/session-cookie';

/**
 * Bridges the v1 client token (localStorage zustand) into the v2 httpOnly
 * session cookie that the server DAL reads — and, when that mirroring actually
 * CHANGES the identity the server can see, asks the server to re-render with it.
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
 * ── THE REFRESH (why this component owns it) ───────────────────────────────
 *
 * The v2 layout resolves the session ONCE and publishes it to the whole tree
 * (`v2/runtime/session-context.tsx`). That is what makes navigation free, but it
 * also means the published snapshot is FROZEN until something re-renders the
 * layout — and this component is precisely the thing that can invalidate it,
 * because it writes the cookie CLIENT-side, after the layout has already read
 * it. Two entry paths reach the v2 layout before the cookie exists, or before it
 * matches the current user:
 *
 *   1. FIRST-EVER v2 VISIT — the developer switch sets the v2 flag cookie and
 *      does `window.location.assign('/')`. No `lawexa-session` cookie exists
 *      yet, so `verifySession()` returns null and the layout renders the GUEST
 *      shell; this component then creates the cookie a moment later.
 *   2. SIGN-IN — `useAuth` ends login with `router.push('/')`, which the proxy
 *      rewrites into `/v2`. That is a soft navigation into a segment not yet in
 *      the router tree, so the layout DOES render — but on the server, with the
 *      PRE-login cookie.
 *
 * Without a refresh, both leave a signed-in user pinned to the guest snapshot
 * for the whole visit: a sign-in wall on `/conversations`, view-only on their
 * OWN conversation, the Work/Study guest surfaces instead of the workspace, and
 * no Developer entry for admins. So when a sync genuinely moves the server's
 * view of identity, we call `router.refresh()` — which re-renders the layout
 * (re-running `verifySession()` against the NEW cookie) while preserving client
 * state, scroll position, and the query cache.
 *
 * ── WHY IT CANNOT LOOP, AND COSTS NOTHING ON THE COMMON PATH ───────────────
 *
 * The refresh is armed only when TWO independent conditions hold, and either one
 * failing is sufficient to stop a second pass:
 *
 *   (a) {@link isSnapshotStale} — the published snapshot disagrees with what the
 *       client actually holds. On the common path (a returning signed-in user
 *       whose cookie was already correct) the two AGREE, so the POST still runs
 *       for correctness but NO refresh is armed and the page renders exactly
 *       once. After a refresh they agree by construction, so this effect's
 *       re-run (its `serverSignedIn` / `serverUserId` deps changed) arms nothing.
 *   (b) `doSync` reports an actual CHANGE. After a refresh `token ===
 *       lastSyncedToken`, so the second pass short-circuits to `false` before it
 *       issues any request. Module state survives a refresh — a refresh
 *       re-renders in place, it does not remount this component — and survives a
 *       remount anyway, since it is module-scoped.
 *
 * A THIRD guard exists for a subtler reason: zustand serves its initial (empty)
 * state during React hydration, so this effect runs once with a null token
 * before re-running with the real one. That first pass must never refresh the
 * page into a signed-out view, so {@link syncSession} fires the callback only if
 * the token it synced is STILL the live one.
 *
 * SIGN-OUT rides the same machinery in the opposite direction: v1 logout clears
 * the zustand token, this effect re-runs, the client now says "signed out" while
 * the snapshot still says "signed in" → stale → DELETE → changed → refresh → the
 * layout re-renders as a guest.
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

/**
 * Mirror one token state into the cookie. Returns whether the mirrored state was
 * actually CHANGED — i.e. whether the server would now resolve a different
 * identity than it did before this call. `false` for a deduped no-op, for the
 * "nothing was ever mirrored, nothing to clear" case, and for any failure (a
 * write that did not land changed nothing, so there is nothing to re-render for).
 */
async function doSync(token: string | null): Promise<boolean> {
  // Already reflected this exact state during this page load.
  if (token === lastSyncedToken) return false;

  if (!token && lastSyncedToken === undefined && !markerPresent()) {
    // Fresh load, signed out, nothing mirrored — nothing to clear.
    lastSyncedToken = null;
    return false;
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
    return response.ok;
  } catch {
    lastSyncedToken = undefined;
    return false;
  }
}

/**
 * Queue a sync, invoking `onMirrored` only if it genuinely changed the mirrored
 * state AND that state is still the live one.
 *
 * The liveness re-check is what makes this safe across zustand's hydration
 * window: the effect fires once with the pre-hydration `null` token and again
 * with the real one, so the queue can hold a DELETE that is already superseded
 * by the time it runs. MIRRORING it is harmless (the POST behind it lands
 * immediately after, on the same serialized queue), but ACTING on it —
 * refreshing the page into a signed-out render — would not be.
 */
function syncSession(token: string | null, onMirrored?: () => void): void {
  queue = queue.then(async () => {
    const changed = await doSync(token);
    if (!changed || !onMirrored) return;
    if (useAuthStore.getState().token !== token) return;
    onMirrored();
  });
}

/**
 * Does the session snapshot the server published disagree with the identity the
 * client actually holds? Two ways it can:
 *
 *  - PRESENCE differs — the common case: the client has a token the layout's
 *    cookie did not carry (first v2 visit, sign-in), or the client has signed
 *    out while the snapshot still says signed in.
 *  - IDENTITY differs — the rarer token SWAP: signing in as a different user
 *    without a full page load leaves a cookie that is still valid, just for the
 *    previous account. Presence alone would call that "in agreement" and leave
 *    the new user reading the old user's name and role — and, the reason this
 *    case is worth guarding at all, the old user's ownership id on `/c/{id}`.
 */
function isSnapshotStale({
  clientToken,
  clientUserId,
  serverSignedIn,
  serverUserId,
}: {
  clientToken: string | null;
  clientUserId: number | null;
  serverSignedIn: boolean;
  serverUserId: number | null;
}): boolean {
  const clientSignedIn = !!clientToken;
  if (clientSignedIn !== serverSignedIn) return true;
  return clientSignedIn && clientUserId !== serverUserId;
}

/**
 * Renders nothing. Mounted once in the v2 layout, which passes down the session
 * it published so this can tell whether that snapshot is still true. Re-runs
 * when the zustand identity changes (guest→login, login, logout) so the cookie
 * always tracks the CURRENT user — and, when that changes what the server can
 * see, asks the server for a fresh render.
 */
export function SessionSync({
  serverSignedIn,
  serverUserId,
}: {
  serverSignedIn: boolean;
  serverUserId: number | null;
}): null {
  const router = useRouter();
  const clientToken = useAuthStore((state) => state.token);
  // A primitive, so this selector's snapshot stays referentially stable.
  const clientUserId = useAuthStore((state) => state.user?.id ?? null);

  useEffect(() => {
    const stale = isSnapshotStale({
      clientToken,
      clientUserId,
      serverSignedIn,
      serverUserId,
    });
    syncSession(clientToken, stale ? () => router.refresh() : undefined);
  }, [clientToken, clientUserId, serverSignedIn, serverUserId, router]);

  return null;
}

import { SESSION_PRESENT_COOKIE, SESSION_PRESENT_VALUE } from './session-cookie';

/**
 * session-mirror — the ONE client-side writer of the server's session cookie.
 *
 * The client holds the bearer token (localStorage, `lib/stores/authStore`);
 * the v2 layout renders on the SERVER and can only see it once it is mirrored
 * into the httpOnly `lawexa-session` cookie (`POST /api/session`; DELETE clears
 * it). Client JS cannot read that cookie, so this module remembers which token
 * it last mirrored during this page load and dedupes on it.
 *
 * TWO KINDS OF CALLER, ONE STATE (11 November 2026, the signed-out flash):
 *  - A sign-in or sign-out that is about to navigate AWAITS the mirror first
 *    (`useAuth`'s login and register, the Google callback, `useAuth`'s
 *    logout and v2's sign-out), so the next page's first render on the server
 *    already sees the new identity. When
 *    the cookie was written only after arriving, the first paint was the
 *    signed-out shell, and the signed-in page replaced it a moment later.
 *  - `SessionSync` (in the v2 layout) keeps the cookie in step with every
 *    other change: a token refresh, another tab, the first v2 visit. Finding
 *    the token already mirrored by the sign-in path, it sends nothing.
 * They must share this module's state, or the second would mirror again.
 *
 * Syncs are SERIALIZED on a promise queue (StrictMode double-invokes and
 * concurrent mounts fold into no-ops; a mid-flight token change queues
 * behind). A failure resets the dedupe, so the next call retries, and is
 * never thrown: a page must not break over its cookie.
 */

// The tail of the sync queue.
let queue: Promise<unknown> = Promise.resolve();
// undefined = nothing mirrored this page load; null = signed-out state mirrored.
let lastMirroredToken: string | null | undefined;

function markerPresent(): boolean {
  return document.cookie
    .split('; ')
    .some((entry) => entry === `${SESSION_PRESENT_COOKIE}=${SESSION_PRESENT_VALUE}`);
}

/**
 * Mirror one token state into the cookie. Resolves to whether the mirrored
 * state CHANGED, i.e. whether the server would now resolve a different
 * identity than it did before: `false` for a deduped no-op, for "signed out
 * and nothing was ever mirrored", and for any failure (a write that did not
 * land changed nothing).
 */
async function writeMirror(token: string | null): Promise<boolean> {
  if (token === lastMirroredToken) return false;

  if (!token && lastMirroredToken === undefined && !markerPresent()) {
    // Fresh load, signed out, nothing mirrored: nothing to clear.
    lastMirroredToken = null;
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
    // On failure, forget: the next call retries instead of trusting a bad sync.
    lastMirroredToken = response.ok ? token : undefined;
    return response.ok;
  } catch {
    lastMirroredToken = undefined;
    return false;
  }
}

/**
 * Queue a mirror of `token` (null: signed out) and resolve, once it has run,
 * to whether it changed what the server sees. Never rejects.
 */
export function mirrorSession(token: string | null): Promise<boolean> {
  const run = queue.then(() => writeMirror(token));
  queue = run.catch(() => undefined);
  return run;
}

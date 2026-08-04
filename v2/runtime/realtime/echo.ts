import Echo from 'laravel-echo';
import Pusher, { type ChannelAuthorizationCallback } from 'pusher-js';
import { useAuthStore } from '@/lib/stores/authStore';

/**
 * The v2-owned Laravel Echo (Reverb) singleton — the socket the notification
 * spine and every future room subscription share. A PORT of v1's
 * `lib/realtime/echo.ts` (which stays untouched for v1; the eslint boundary
 * blocks importing it), rebuilt per plan W1 item 1 (2026-08-04).
 *
 * WHAT CHANGED FROM THE v1 PORT, AND WHY:
 *  - The authorizer speaks to `POST /api/broadcasting/auth` through a plain
 *    `fetch` carrying the bearer from `lib/stores/authStore` — the ONE
 *    sanctioned v1→v2 token bridge. v1 routed this through `apiClient`, whose
 *    401 interceptor clears auth and HARD-REDIRECTS to `/login`; a background
 *    socket re-authorization must never be able to yank the page, so the v2
 *    authorizer fails quietly into the callback instead.
 *  - Nothing is published to `window.Echo` — the v1 singleton owns that slot;
 *    two globals fighting over it would be a debugging trap. `window.Pusher`
 *    IS still assigned (Echo's reverb connector requires it) — an idempotent
 *    write both singletons agree on.
 *
 * LIFECYCLE CONTRACT: `RealtimeSpine` (spine.tsx) is the sole owner of
 * connect/disconnect — it connects for a signed-in viewer and calls
 * {@link disconnectV2Echo} on the viewer-change edge (the same edge
 * `V2CacheIdentityGuard` clears the cache on) and on unmount. Future room
 * hooks (W2) only `join`/`leave` channels on the instance; they never
 * disconnect it.
 *
 * Silent no-op degradation: on the server, or when the `NEXT_PUBLIC_REVERB_*`
 * env vars are absent, {@link getV2Echo} returns null and the app keeps its
 * REST behaviour — realtime is an enhancement, never a dependency.
 */

/** Same origin the shared axios client targets — one API host for REST + auth. */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

let instance: Echo<'reverb'> | null = null;

/** The shared v2 Echo instance, or null on the server / when unconfigured. */
export function getV2Echo(): Echo<'reverb'> | null {
  if (typeof window === 'undefined') return null;
  if (instance) return instance;

  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
  const wsHost = process.env.NEXT_PUBLIC_REVERB_HOST;
  if (!key || !wsHost) return null;

  const port = Number(process.env.NEXT_PUBLIC_REVERB_PORT) || 443;
  const forceTLS = (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? 'https') === 'https';

  (window as Window & { Pusher?: typeof Pusher }).Pusher = Pusher;
  instance = new Echo({
    broadcaster: 'reverb',
    key,
    wsHost,
    wsPort: port,
    wssPort: port,
    forceTLS,
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel: { name: string }) => ({
      authorize: (socketId: string, callback: ChannelAuthorizationCallback) => {
        // Read the token AT AUTHORIZE TIME, never at construction: Reverb
        // re-authorizes on every reconnect, and the token may have rotated.
        const token = useAuthStore.getState().token;
        if (!token) {
          callback(new Error('No session token for broadcasting auth'), null);
          return;
        }
        fetch(`${API_BASE_URL}/api/broadcasting/auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            socket_id: socketId,
            channel_name: channel.name,
          }),
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Broadcasting auth failed (${response.status})`);
            }
            return response.json() as Promise<Parameters<ChannelAuthorizationCallback>[1]>;
          })
          .then((data) => callback(null, data))
          .catch((error: unknown) =>
            callback(
              error instanceof Error
                ? error
                : new Error('Broadcasting authorization failed'),
              null,
            ),
          );
      },
    }),
  });
  return instance;
}

/** Tear the connection down — viewer change or v2 unmount (spine-only call). */
export function disconnectV2Echo(): void {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}

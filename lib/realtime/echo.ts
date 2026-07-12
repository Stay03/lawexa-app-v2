/**
 * Laravel Echo (Reverb / Pusher protocol) singleton.
 *
 * Only the public app key is used here — real authorization happens server-side
 * at `POST /api/broadcasting/auth`, which the shared axios client hits with the
 * bearer token attached. Realtime silently no-ops if the env vars are absent, so
 * the app degrades to its REST behaviour rather than crashing.
 */

import Echo from 'laravel-echo';
import Pusher, { type ChannelAuthorizationCallback } from 'pusher-js';

import { apiClient } from '@/lib/api/client';

declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo?: Echo<'reverb'>;
  }
}

let echoInstance: Echo<'reverb'> | null = null;

/** The shared Echo instance, or null on the server / when unconfigured. */
export function getEcho(): Echo<'reverb'> | null {
  if (typeof window === 'undefined') return null;
  if (echoInstance) return echoInstance;

  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
  const wsHost = process.env.NEXT_PUBLIC_REVERB_HOST;
  if (!key || !wsHost) return null;

  const port = Number(process.env.NEXT_PUBLIC_REVERB_PORT) || 443;
  const forceTLS = (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? 'https') === 'https';

  window.Pusher = Pusher;
  echoInstance = new Echo({
    broadcaster: 'reverb',
    key,
    wsHost,
    wsPort: port,
    wssPort: port,
    forceTLS,
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel: { name: string }) => ({
      authorize: (socketId: string, callback: ChannelAuthorizationCallback) => {
        apiClient
          .post('/broadcasting/auth', {
            socket_id: socketId,
            channel_name: channel.name,
          })
          .then((response) => callback(null, response.data))
          .catch((error: unknown) =>
            callback(
              error instanceof Error
                ? error
                : new Error('Broadcasting authorization failed'),
              null
            )
          );
      },
    }),
  });
  window.Echo = echoInstance;
  return echoInstance;
}

/** Tear the connection down (e.g. on sign-out). */
export function disconnectEcho(): void {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
  }
  if (typeof window !== 'undefined') {
    window.Echo = undefined;
  }
}

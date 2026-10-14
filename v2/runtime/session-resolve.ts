/**
 * session-resolve — what one `/auth/me` answer means for the v2 layout.
 *
 * The layout used to read EVERY failure as "signed out": a 5xx, a refused
 * connection or a slow answer drew the guest shell (Sign in, Create account, a
 * sign-in wall on the reader's own chats) for a reader who was signed in all
 * along (20:54-20:56Z on 13 October 2026, a two-minute API outage). Only the
 * server saying so (401, 419) or no session at all means signed out now. A
 * failure that may pass is tried again, and if it does not pass the layout says
 * it cannot reach Lawexa instead of pretending the reader left.
 *
 * Pure (no `server-only`), so its rules run under node:test; `session.ts` wires
 * it to the real fetch.
 */

/** The three answers the layout acts on. */
export type SessionResolution<U> =
  | { kind: 'signed-in'; user: U }
  | { kind: 'signed-out' }
  | { kind: 'unreachable' };

/** How one failed `/auth/me` reads: the server's "no", a failure worth one more
 *  try, or one that a retry will not change. */
export type MeFailure = 'signed-out' | 'retry' | 'unreachable';

/** HTTP statuses the server uses to say the session is gone. */
const SIGNED_OUT_STATUSES = new Set([401, 419]);

/**
 * Classify a failed `/auth/me`. `status` is read off an `ApiServerError`
 * (`api-server.ts`); a thrown `TypeError` is fetch's network failure (refused,
 * reset, DNS), an `AbortError`/`TimeoutError` the attempt's timeout, a
 * `SyntaxError` a body that was not JSON (a proxy's error page). 429 and other
 * 4xx are not retried: asking again at once would not help.
 */
export function classifyMeFailure(error: unknown): MeFailure {
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
    if (SIGNED_OUT_STATUSES.has(error.status)) return 'signed-out';
    return error.status >= 500 ? 'retry' : 'unreachable';
  }
  if (error instanceof Error && ['TypeError', 'AbortError', 'TimeoutError', 'SyntaxError'].includes(error.name)) {
    return 'retry';
  }
  return 'unreachable';
}

/** The server-side attempts: a short timeout each, so a blip costs the page a
 *  few seconds at most, never the platform's default minute. */
export const ME_ATTEMPTS = 2;
export const ME_TIMEOUT_MS = 2500;
export const ME_RETRY_PAUSE_MS = 300;

/**
 * Resolve a session from a token and a `/auth/me` fetcher. No token is
 * signed out with no request. A user in the answer is signed in; an answer
 * without one is unreachable (the server answered, but not with a session).
 * Failures are classified; only `'retry'` ones are tried again, up to
 * `attempts` in all.
 */
export async function resolveSessionWith<U>(
  token: string | null,
  fetchMe: (signal: AbortSignal) => Promise<{ user: U | null | undefined }>,
  {
    attempts = ME_ATTEMPTS,
    timeoutMs = ME_TIMEOUT_MS,
    pauseMs = ME_RETRY_PAUSE_MS,
    pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms)),
  }: {
    attempts?: number;
    timeoutMs?: number;
    pauseMs?: number;
    pause?: (ms: number) => Promise<void>;
  } = {},
): Promise<SessionResolution<U>> {
  if (!token) return { kind: 'signed-out' };
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const { user } = await fetchMe(AbortSignal.timeout(timeoutMs));
      return user ? { kind: 'signed-in', user } : { kind: 'unreachable' };
    } catch (error) {
      const failure = classifyMeFailure(error);
      if (failure === 'signed-out') return { kind: 'signed-out' };
      if (failure === 'unreachable' || attempt === attempts) return { kind: 'unreachable' };
      await pause(pauseMs);
    }
  }
  return { kind: 'unreachable' };
}

/** The client's wait before asking the server again, after `attempt` failed
 *  ones (0-based): 2, 4, 8, 16, then 30 s. */
export function backoffDelay(attempt: number): number {
  return Math.min(30_000, 2_000 * 2 ** Math.max(0, attempt));
}

/** How many times the client asks again before it leaves the "Try again"
 *  button to the reader. */
export const RECOVERY_ATTEMPTS = 6;

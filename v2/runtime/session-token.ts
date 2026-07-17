import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from './session-cookie';

/**
 * Read the mirrored bearer token from the httpOnly session cookie, or `null`.
 * Server-only — this is the one place the token is read out of the cookie.
 *
 * Lives in its own module (not `session.ts`) so `api-server.ts` and
 * `session.ts` can both depend on it without a circular import.
 */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

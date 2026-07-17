import 'server-only';
import { getApiUrl } from '@/lib/constants/seo';
import { getSessionToken } from './session-token';

/**
 * Server-only Laravel API client for the v2 DAL. `import 'server-only'` makes
 * any client-bundle import a build-time error.
 */

/**
 * Error thrown when the Laravel API responds with a non-2xx status. Carries the
 * HTTP status so callers (e.g. `verifySession`) can distinguish 401 from other
 * failures. Network failures surface as the raw `fetch` rejection.
 */
export class ApiServerError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiServerError';
    this.status = status;
  }
}

/**
 * Fetch a Laravel API path with the session token attached.
 *
 * - Base URL from `getApiUrl()` + `/api` (mirrors the v1 axios client).
 * - Adds `Accept: application/json` and, when the session cookie is present,
 *   `Authorization: Bearer <token>` (built here — the token never leaves the
 *   server). Callers pass the resource path only, e.g. `apiFetch('/auth/me')`.
 * - Defaults to `cache: 'no-store'`; override via `init.cache`.
 * - Returns the parsed JSON, or throws `ApiServerError` on a non-2xx status.
 *
 * Kept deliberately small — phase-3+ features will grow this (typed helpers,
 * revalidation tags, etc.).
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getSessionToken();

  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Trailing-slash-normalized so a `NEXT_PUBLIC_API_URL` ending in '/' can't
  // produce '//api'.
  const response = await fetch(`${getApiUrl().replace(/\/$/, '')}/api${path}`, {
    cache: 'no-store',
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new ApiServerError(
      response.status,
      `apiFetch ${path} failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

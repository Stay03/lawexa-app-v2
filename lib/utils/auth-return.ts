/**
 * Where sign-in returns to: a page that needs an account links to
 * `/login?redirect=/that-page` (the /ambassadors landing, Lawexa Wrapped's
 * /wrapped), and a successful sign-in lands back there instead of on the home.
 *
 * Email sign-in reads `?redirect=` straight from the login page's address.
 * Google sign-in leaves the site and comes back on /auth/google/callback,
 * which has no `?redirect=`, so the path is kept in this tab's sessionStorage
 * for the round trip and taken (read once, then cleared) by the callback.
 */

const RETURN_KEY = 'lawexa-auth-return';

/**
 * A path on this site, or null. Only "/x" paths count: never "//host",
 * "/\host" (which browsers read as another site), or a full URL.
 */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  return raw;
}

/** The `?redirect=` of the current address, when it is a safe path. */
export function returnPathFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  return safeReturnPath(new URLSearchParams(window.location.search).get('redirect'));
}

/** Before leaving for Google: keep this address's `?redirect=` for the callback. */
export function keepReturnPath(): void {
  const path = returnPathFromLocation();
  try {
    if (path) window.sessionStorage.setItem(RETURN_KEY, path);
    else window.sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // Storage refused: Google sign-in lands on the home, as before.
  }
}

/** On the Google callback: the kept path, once. */
export function takeReturnPath(): string | null {
  try {
    const path = safeReturnPath(window.sessionStorage.getItem(RETURN_KEY));
    window.sessionStorage.removeItem(RETURN_KEY);
    return path;
  } catch {
    return null;
  }
}

/** The sign-in page, returning to `path` (the app's public form, `/v2` dropped). */
export function signInHref(path: string): string {
  const back = path.startsWith('/v2/') ? path.slice(3) : path === '/v2' ? '/' : path;
  return `/login?redirect=${encodeURIComponent(back)}`;
}

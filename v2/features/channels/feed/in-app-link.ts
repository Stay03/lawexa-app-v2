/**
 * in-app-link — which links in a message stay inside Lawexa.
 *
 * A LAWEXA LINK OPENS IN LAWEXA (12 October 2026). Every link in a message used
 * to open a new tab, and on an iPhone home-screen app a new tab is Safari: a
 * case link shared in a channel took the reader out of the app, and there was
 * no way to open a Lawexa address inside it at all, because the installed app
 * has no address bar (Arthur, 12 October 2026). A link to Lawexa's own site is
 * now a path the app navigates to in place; anything else keeps the new tab.
 *
 * Both the apex and `www` hosts count, because the app is served from both and
 * a link pasted from either must behave the same. The decision reads only the
 * link itself, never the page, so the server render and the browser agree.
 * Only `http:` and `https:` qualify: a `mailto:` or any other scheme is left to
 * the caller, which already handles it.
 */

/** Hosts that are Lawexa itself. */
const LAWEXA_HOSTS = new Set(['lawexa.com', 'www.lawexa.com']);

/**
 * The in-app path for `href` (path, query and hash), or `null` when the link
 * leaves Lawexa and must keep opening a new tab. Pure, so every case is pinned
 * by a test.
 */
export function inAppPath(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!LAWEXA_HOSTS.has(url.hostname.toLowerCase())) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

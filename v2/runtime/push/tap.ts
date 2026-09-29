/**
 * The message the push service worker sends an OPEN tab when a notification
 * is tapped and the browser refuses to move that tab itself.
 *
 * WHY IT EXISTS (Arthur, Layout thread, 28 September 2026): a tap with Lawexa
 * already open brought the tab to the front but left it on the page it was on.
 * The worker's `client.navigate(url)` only works on a page the worker
 * CONTROLS, and Firebase registers it under its own scope, so it controls no
 * Lawexa page and every navigate is refused. The worker now posts the link to
 * the tab instead, and v2 routes there (`tap-listener.tsx`). A closed app was
 * never affected: `clients.openWindow(url)` opens the link directly.
 *
 * The type string is repeated in `public/firebase-messaging-sw.js`, which is a
 * static file and cannot import it.
 */
export const OPEN_URL_MESSAGE = 'lawexa:open-url';

/**
 * The in-app path to open for a worker message, or null when the message is
 * not a tap, or its link leaves this origin (a link is never followed off the
 * site, whatever the payload says).
 */
export function tapTarget(message: unknown, origin: string): string | null {
  if (typeof message !== 'object' || message === null) return null;
  const { type, url } = message as { type?: unknown; url?: unknown };
  if (type !== OPEN_URL_MESSAGE || typeof url !== 'string' || url === '') return null;
  let target: URL;
  try {
    target = new URL(url, origin);
  } catch {
    return null;
  }
  if (target.origin !== origin) return null;
  return `${target.pathname}${target.search}${target.hash}`;
}

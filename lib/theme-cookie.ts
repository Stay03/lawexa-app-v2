/**
 * The theme mirror cookie, shared by the manifest route (server) and the theme
 * provider (client). One definition so the name/values/attributes can never
 * drift — the same shape as `v2/cookie.ts`, for the same reason.
 *
 * WHY A COOKIE AT ALL. `next-themes` keeps the theme in localStorage, which no
 * request ever carries, so the server has never been able to see which theme a
 * reader is in. The installed Android app paints its status bar from the
 * manifest's `theme_color`, captured at install — so the manifest response has
 * to know the theme at the moment the browser fetches it, and a cookie is the
 * only channel that request can carry it on. How a manifest request comes to
 * carry cookies at all is the subject of `app/manifest.webmanifest/route.ts`.
 *
 * This cookie is a MIRROR, not a second source of truth. localStorage stays
 * the authority (`next-themes` reads only it); the cookie is write-only from
 * the client and read-only on the server, so the two can disagree for at most
 * one render after a switch and nothing user-visible reads the stale side.
 */
export const THEME_COOKIE = 'lawexa-theme';

/**
 * The only two values ever written — the RESOLVED theme, never the raw
 * `system`, because the manifest needs the colour actually on screen and only
 * the client can resolve what `system` means for this device.
 */
export type ThemeCookieValue = 'light' | 'dark';

/** One year, in seconds — the same horizon as the v2 opt-in cookie. */
export const THEME_COOKIE_MAX_AGE = 31536000;

/** `document.cookie` assignment string mirroring the resolved theme. */
export function themeCookieSet(theme: ThemeCookieValue): string {
  return `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}

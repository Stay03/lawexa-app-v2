/**
 * The v2 opt-in cookie, shared by the proxy (server) and the toggle surfaces
 * (client). One definition so the name/value/attributes can never drift.
 */
export const UI_COOKIE = 'lawexa-ui';
export const V2_COOKIE_VALUE = 'v2';

/** One year, in seconds. */
export const V2_COOKIE_MAX_AGE = 31536000;

/** `document.cookie` assignment string that opts the browser in to v2. */
export const V2_COOKIE_SET = `${UI_COOKIE}=${V2_COOKIE_VALUE}; path=/; max-age=${V2_COOKIE_MAX_AGE}; samesite=lax`;

/** `document.cookie` assignment string that clears the opt-in. */
export const V2_COOKIE_CLEAR = `${UI_COOKIE}=; path=/; max-age=0; samesite=lax`;

/**
 * Whether a raw `document.cookie` string contains the exact opt-in entry.
 * Exact-entry match — immune to `xlawexa-ui=v2` / `lawexa-ui=v2preview`
 * false positives.
 */
export function hasV2Cookie(cookieString: string): boolean {
  return cookieString
    .split('; ')
    .some((entry) => entry === `${UI_COOKIE}=${V2_COOKIE_VALUE}`);
}

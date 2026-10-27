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
 * The classic design as a CHOICE, not the absence of one: with the new design
 * the default for everyone (`V2_DEFAULT`, `v2/ui-choice.ts`), no cookie means
 * the new design, so going back to the old one has to be said. A year, like
 * the opt-in; with the default off it reads the same as no cookie.
 *
 * `classic`, NOT `v1` (Arthur, 27 October 2026: "there are still people
 * seeing v1 screen"). Until 26 October the sidebar's "Switch to classic
 * Lawexa" wrote `v1`, and that button is gone, so a browser holding `v1` had
 * no way back. The proxy no longer honours `v1` (`LEGACY_V1_COOKIE_VALUE`) and
 * clears it, so those readers get the new design; only the Developer
 * settings switch, which staff use, writes `classic` now.
 */
export const V1_COOKIE_VALUE = 'classic';
export const V1_COOKIE_SET = `${UI_COOKIE}=${V1_COOKIE_VALUE}; path=/; max-age=${V2_COOKIE_MAX_AGE}; samesite=lax`;

/** The old classic choice, from before 26 October 2026: read as no choice, then cleared. */
export const LEGACY_V1_COOKIE_VALUE = 'v1';

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

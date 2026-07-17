/**
 * Session cookie names shared across the BFF token-mirror boundary.
 *
 * Three consumers must agree on these names, so they live in one place to make
 * drift impossible:
 *  - `app/api/session/route.ts` (server) SETS both cookies.
 *  - `v2/runtime/session.ts` + `api-server.ts` (server) READ the httpOnly token.
 *  - `app/v2/session-sync.tsx` (client) READS the non-httpOnly presence marker.
 *
 * This module is intentionally NOT `server-only`: the presence marker is read by
 * client code, so it must be safe to import into a client bundle. It contains
 * only string/number constants — no cookie *values* (the token never appears
 * here), no `next/headers`, nothing server-privileged.
 */

/**
 * httpOnly cookie holding the mirrored bearer token. Never readable from JS —
 * only the server DAL (`getSessionToken`) can see its value.
 */
export const SESSION_COOKIE = 'lawexa-session';

/**
 * Non-httpOnly companion marker. Client JS can't read the httpOnly session
 * cookie, so this readable flag tells `SessionSync` that the mirror already
 * happened (so it doesn't re-POST on every mount). It carries no secret — only
 * the constant value below.
 */
export const SESSION_PRESENT_COOKIE = 'lawexa-session-present';

/** The only value the presence marker is ever set to. */
export const SESSION_PRESENT_VALUE = '1';

/** Cookie lifetime: 30 days, in seconds. Both cookies share it. */
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

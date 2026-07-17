import { NextResponse, type NextRequest } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE,
  SESSION_PRESENT_COOKIE,
  SESSION_PRESENT_VALUE,
} from '@/v2/runtime/session-cookie';

/**
 * The BFF token mirror (Backend-For-Frontend pattern, per the foundation
 * standards §1 correction 3 / CVE-2025-29927 lesson).
 *
 * v1 keeps the bearer token in a `localStorage` zustand store; the v2 server DAL
 * needs it as an httpOnly cookie so RSCs / route handlers can build the
 * `Authorization: Bearer` header without ever exposing the token to client JS.
 * This route is the ONLY writer of that cookie:
 *  - `POST { token }` mirrors the token into `lawexa-session` (httpOnly) plus a
 *    readable `lawexa-session-present` marker, and returns 204.
 *  - `DELETE` clears both, and returns 204.
 *
 * This is a JSON endpoint — it never issues a redirect, so the BFF guide's
 * open-redirect guard (validating a `returnTo`/`next` target) does not apply
 * here. The relevant hardening for a token-writing JSON endpoint is instead the
 * same-origin (login-CSRF) guard below.
 *
 * Note: `/api/*` is excluded from the proxy matcher, so this route runs directly
 * with no rewrite involvement — nothing to coordinate with `proxy.ts`.
 */

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Whether the token value is a plausible, header-safe bearer string. We do not
 * (and cannot) verify it against the backend here — the DAL does that on first
 * use via `verifySession` — we only reject values that are empty, absurdly long,
 * or would corrupt an `Authorization` header (whitespace / control chars).
 */
function isPlausibleToken(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const token = value.trim();
  if (token.length === 0 || token.length > 4096) return false;
  // Printable ASCII only — excludes spaces (0x20) and control chars, both of
  // which are illegal in an HTTP header value.
  return /^[\x21-\x7E]+$/.test(token);
}

/**
 * Same-origin guard (login-CSRF hardening). A cross-site page must not be able
 * to plant a token in this user's session cookie. We trust `Sec-Fetch-Site`
 * when the browser sends it, and fall back to comparing the `Origin` host with
 * the request `Host`. When neither signal is present (non-browser clients,
 * older browsers that omit `Origin` on same-origin requests) we allow it: this
 * is defense-in-depth, not the security boundary — the token is still only
 * usable by whoever legitimately holds it, and the DAL/backend remain the real
 * authority.
 */
function isSameOrigin(request: NextRequest): boolean {
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (
    secFetchSite &&
    secFetchSite !== 'same-origin' &&
    secFetchSite !== 'same-site' &&
    secFetchSite !== 'none'
  ) {
    // The only remaining value is 'cross-site'.
    return false;
  }

  const origin = request.headers.get('origin');
  if (origin) {
    // Behind Traefik the public host may arrive as X-Forwarded-Host while Host
    // is an internal name — accept a match against either, so a proxy topology
    // change can't silently 403 every legitimate mirror request. (This check is
    // belt-and-suspenders on top of Sec-Fetch-Site; it can only false-reject,
    // never weaken protection.)
    const forwardedHost = request.headers
      .get('x-forwarded-host')
      ?.split(',')[0]
      ?.trim();
    const host = request.headers.get('host');
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host && originHost !== forwardedHost) return false;
    } catch {
      // Malformed Origin header — treat as hostile.
      return false;
    }
  }

  return true;
}

/** 204 response carrying the just-set / just-cleared cookies. */
function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Cross-origin session writes are not allowed.' },
      { status: 403 },
    );
  }

  // Cheap resource-exhaustion guard: the token caps at 4096 chars, so any
  // honest body is tiny. (Chunked bodies without Content-Length are still
  // bounded by request.json() below failing on non-JSON.)
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 8192) {
    return NextResponse.json({ error: 'Body too large.' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const token = (body as { token?: unknown } | null)?.token;
  if (!isPlausibleToken(token)) {
    return NextResponse.json(
      { error: 'A non-empty bearer token string is required.' },
      { status: 400 },
    );
  }

  const response = noContent();

  // httpOnly token — invisible to client JS; only the server DAL reads it.
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token.trim(),
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE,
  });

  // Readable presence marker — lets SessionSync know the mirror already ran.
  response.cookies.set({
    name: SESSION_PRESENT_COOKIE,
    value: SESSION_PRESENT_VALUE,
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE,
  });

  return response;
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // Same guard as POST — logout-CSRF is low-stakes (SessionSync re-mirrors on
  // next visit) but the guard is free and keeps the two verbs consistent.
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Cross-origin session writes are not allowed.' },
      { status: 403 },
    );
  }

  const response = noContent();

  // Clear both cookies. Matching path (and expiring immediately) so the browser
  // reliably drops them regardless of the original attributes.
  for (const name of [SESSION_COOKIE, SESSION_PRESENT_COOKIE]) {
    response.cookies.set({
      name,
      value: '',
      httpOnly: name === SESSION_COOKIE,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }

  return response;
}

import { NextResponse, type NextRequest } from 'next/server';
import { isMigratedToV2 } from '@/v2/routes.manifest';
import { UI_COOKIE, V2_COOKIE_VALUE } from '@/v2/cookie';

const V2_PREFIX = '/v2';

/**
 * The v1 ⇆ v2 switch — Next 16's middleware successor (runs on the Node runtime;
 * do not pin a runtime). This is Vercel's documented cookie-keyed strangler-fig
 * rewrite: opted-in users get the hidden `app/v2/` tree at the same URL, while
 * everyone else stays on v1, byte-for-byte.
 *
 * Behaviour:
 *  - Inert unless `V2_ENABLED === 'true'` — an env kill switch that rolls the
 *    whole mechanism back in prod without a code revert.
 *  - A direct `/v2` or `/v2/*` hit WITHOUT the opt-in cookie is redirected to the
 *    bare path, so the internal tree never leaks into the URL bar.
 *  - WITH the cookie set, a migrated path (per `routes.manifest.ts`) is rewritten
 *    into `app/v2/` — `NextResponse.rewrite` keeps the URL bar on the clean v1
 *    path and propagates RSC headers correctly.
 *  - Everything else falls through to v1 untouched.
 *
 * The proxy is intentionally NOT a security boundary: the cookie is not a secret
 * and data authorization stays with the backend.
 */
export function proxy(request: NextRequest): NextResponse {
  // Kill switch — total no-op when the feature is not enabled for this deploy.
  if (process.env.V2_ENABLED !== 'true') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const hasV2Cookie = request.cookies.get(UI_COOKIE)?.value === V2_COOKIE_VALUE;

  // Direct hits on the internal /v2 tree are only allowed with the cookie;
  // otherwise strip the prefix so the canonical (v1) URL is the one users see.
  // `clone()` preserves the search params.
  if (pathname === V2_PREFIX || pathname.startsWith(`${V2_PREFIX}/`)) {
    if (hasV2Cookie) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(V2_PREFIX.length) || '/';
    return NextResponse.redirect(url);
  }

  // Opted-in users on a migrated route → serve the v2 tree without changing the
  // URL. Root `/` maps to `/v2`; `/x` maps to `/v2/x`. `clone()` preserves search.
  if (hasV2Cookie && isMigratedToV2(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? V2_PREFIX : `${V2_PREFIX}${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals, the favicon, and any
  // path containing a dot (static files / metadata). Static literal so Next can
  // parse it at build time.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

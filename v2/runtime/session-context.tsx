'use client';

import { createContext, useContext, useMemo } from 'react';
import type { AuthProvider, UserRole } from '@/types/auth';

/**
 * The v2 session CONTEXT — the client-side read path for the server-verified
 * identity, published once by `app/v2/layout.tsx`.
 *
 * WHY THIS EXISTS (the navigation cost it removes). Every v2 page used to open
 * with `await verifySession()`, and `verifySession()` → `apiFetch('/auth/me')`
 * is `cache: 'no-store'`. React `cache()` dedupes only WITHIN one server render,
 * so a SOFT navigation — which re-renders the page segment and nothing above it
 * — paid a full uncached round trip to the Laravel API before it could emit a
 * single byte.
 *
 * The fix rests on a documented App Router guarantee: **a layout does not
 * re-render on a soft navigation**. Next reuses the cached layout segment and
 * fetches only the changed page segment ("Layouts are cached in the client
 * during navigation to avoid unnecessary server requests… only the page segment
 * that changes" — nextjs.org layout.js + staleTimes docs). So the layout's ONE
 * `/auth/me` result, published here, is already in the browser and stays there
 * for the whole visit: every subsequent navigation reads it for free and the
 * pages await nothing.
 *
 * WHAT THIS DOES AND DOES NOT REMOVE. These routes are dynamic (the layout reads
 * `cookies()`) and `staleTimes` is unset, so Next still prefetches them only down
 * to the nearest `loading.tsx` and still keeps dynamic segments in the client
 * Router Cache for 0s. Every soft navigation therefore STILL issues an RSC
 * request and STILL shows the route skeleton. What changed is its DURATION: the
 * skeleton now covers one Next round trip that does no I/O, instead of
 * Next → Laravel → Next. This shortens the wait; it does not eliminate the
 * boundary. Removing it entirely is a separate question (route-segment caching,
 * or not having a `loading.tsx` at all) and is not this module's claim.
 *
 * NOT AN AUTHORIZATION BOUNDARY. This carries a minimal, safe-to-render
 * PRESENTATION snapshot of what the server already verified. It never carries
 * the token, and nothing here grants access: every module's own fetch is
 * authorized by the backend and 401s on its own (foundation-standards §1 — the
 * proxy/client is never the auth boundary). The one privacy-relevant consumer,
 * the `/c/{id}` ownership check, reads {@link V2SessionSnapshot.userId}, which
 * is `verifySession()`'s server-verified `user.id` and nothing else — same
 * value, same provenance, same authority as the prop it replaced.
 *
 * NOT the DAL's `SessionUser`. That type lives in `v2/runtime/session.ts`, which
 * is `import 'server-only'`; this module is `'use client'` and deliberately
 * declares its own narrower shape so the two can never be confused and no
 * server-only module is ever pulled toward a client bundle.
 */

/**
 * The client-readable session snapshot. Nine primitives, all resolved on the
 * server before this provider mounts — there is no pending state, so no consumer
 * ever has to render a "session still resolving" branch.
 */
export interface V2SessionSnapshot {
  /**
   * Server-verified sign-in state: `true` only when `/auth/me` resolved a user.
   * NOT cookie presence — a stale or revoked token yields `false` here, exactly
   * as it did when this was `!!session` in each page.
   */
  readonly signedIn: boolean;
  /** Server-verified user id, or `null` when signed out. */
  readonly userId: number | null;
  /** Full display name, or `null`. Call sites derive what they need from it. */
  readonly name: string | null;
  /**
   * The address this account signs in with, or `null` when signed out.
   *
   * WHY IT IS HERE AND NOT FETCHED. The settings screen opens with an account
   * card, and the one fact that names an ACCOUNT rather than a person is the
   * email: two people can share a display name, and the reader's own question
   * on that card is "which account am I in?". The server already had it —
   * `verifySession()` returns it on `SessionUser` and the layout throws it away
   * — so publishing it costs nothing, where a page-level `verifySession()` call
   * would cost an uncached `/auth/me` round trip on every navigation (the whole
   * reason this module exists).
   *
   * SAFE TO RENDER, like every other field here: it is the viewer's OWN address,
   * shown back to them, never anybody else's.
   */
  readonly email: string | null;
  /**
   * Public avatar URL, or `null` when unset or signed out. Published for the
   * same reason as {@link V2SessionSnapshot.email} — an account card without a
   * face is a row of text — and it is already a public URL, so it carries no
   * privilege of its own.
   */
  readonly avatarUrl: string | null;
  /**
   * The viewer's own `@handle`, or `null` when the account has none yet — which
   * also means nobody can tag them. Published for the same reason as the two
   * fields above, and because it is the ONE fact the settings screen can state
   * under a row label without asking anybody: it says whether the Profile door
   * still has something behind it that needs doing.
   */
  readonly username: string | null;
  /** Server-verified role, or `null` when signed out. */
  readonly role: UserRole | null;
  /**
   * Whether the backend has verified this account's email. `false` when signed
   * out. NOT a capability — it is a PRESENTATION fact, so a surface the backend
   * gates on verification (every `/quizzes/*` endpoint 403s for an unverified
   * registered account) can render a designed "verify your email" panel instead
   * of an error screen. The backend stays the authority: a stale snapshot still
   * meets a real 403, which the surfaces handle as the same state.
   */
  readonly isVerified: boolean;
  /**
   * How this account signs in, or `null` when signed out. Paired with
   * {@link V2SessionSnapshot.isVerified}: only `'email'` signups ever need to
   * verify, so gating on `isVerified` alone would nag every Google account.
   */
  readonly authProvider: AuthProvider | null;
}

/**
 * `null` means "no provider above me", which is a wiring bug rather than a
 * runtime state — {@link useV2Session} throws on it rather than silently
 * degrading a signed-in user to the guest surface.
 */
const V2SessionContext = createContext<V2SessionSnapshot | null>(null);

/**
 * Publishes the server-verified session to the v2 client tree. Mounted ONCE, in
 * `app/v2/layout.tsx`, from a value the layout already had to compute for the
 * shell chrome — so this adds no round trip of its own.
 *
 * Takes four primitives rather than a pre-built object so the memo below has
 * primitive dependencies: the context value is then referentially STABLE for the
 * whole life of the layout instance, and consumers never re-render because a
 * structurally-identical object was rebuilt.
 */
export function V2SessionProvider({
  signedIn,
  userId,
  name,
  email,
  avatarUrl,
  username,
  role,
  isVerified,
  authProvider,
  children,
}: V2SessionSnapshot & { children: React.ReactNode }) {
  const value = useMemo<V2SessionSnapshot>(
    () => ({
      signedIn,
      userId,
      name,
      email,
      avatarUrl,
      username,
      role,
      isVerified,
      authProvider,
    }),
    [
      signedIn,
      userId,
      name,
      email,
      avatarUrl,
      username,
      role,
      isVerified,
      authProvider,
    ],
  );

  return (
    <V2SessionContext.Provider value={value}>
      {children}
    </V2SessionContext.Provider>
  );
}

/**
 * Read the server-verified session. Synchronous and always resolved — on a hard
 * load the provider renders with the awaited value (so SSR HTML is complete and
 * hydration matches), and on a soft navigation the provider instance is
 * preserved with that same value.
 *
 * Throws when no provider is mounted: a v2 screen rendered outside the v2 layout
 * is a wiring mistake, and defaulting to "signed out" would hide it behind a
 * plausible-looking guest UI.
 */
export function useV2Session(): V2SessionSnapshot {
  const session = useContext(V2SessionContext);
  if (!session) {
    throw new Error(
      'useV2Session must be used inside <V2SessionProvider> (mounted in app/v2/layout.tsx).',
    );
  }
  return session;
}

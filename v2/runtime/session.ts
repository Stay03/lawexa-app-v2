import 'server-only';
import { cache } from 'react';
import type { ApiResponse } from '@/types/api';
import type { AuthProvider, User, UserRole } from '@/types/auth';
import { apiFetch } from './api-server';
import { getSessionToken } from './session-token';

export { getSessionToken };

/**
 * The v2 Data Access Layer (DAL) — the security boundary for v2.
 *
 * Per foundation-standards §1 correction 3 (the CVE-2025-29927 lesson), the
 * proxy is NEVER the auth boundary. Every RSC / Server Action / route handler
 * that needs identity calls `verifySession()` here, which turns the httpOnly
 * session cookie into a verified, minimal user DTO by hitting the backend — the
 * backend stays the ultimate authority.
 *
 * Logout staleness (acceptable for phase 1): v1 logout does not touch this
 * cookie (v1 is untouched this wave). But the backend revokes the token on
 * logout, so a stale mirrored token simply 401s and `verifySession()` returns
 * `null` — the signed-out state. `SessionSync`'s DELETE path also heals the
 * cookie on the next v2 visit (no zustand token + marker present → clear).
 */

/** Minimal, safe-to-render identity — never the raw API payload, never the token. */
export interface SessionUser {
  id: number;
  uuid: string | null;
  name: string;
  email: string | null;
  role: UserRole;
  /** Public avatar URL (safe to render); `null` when unset. */
  avatar_url: string | null;
  /**
   * Whether the backend considers this address verified. A safe primitive, not
   * a capability: every quiz endpoint 403s server-side for an unverified
   * REGISTERED account, and this is what lets the quiz surfaces render a
   * designed "verify your email" panel instead of an error screen.
   */
  is_verified: boolean;
  /**
   * How the account signs in. Paired with {@link SessionUser.is_verified}
   * because only `email` signups ever need to verify — an OAuth account
   * arrives verified, so gating on `is_verified` alone would nag Google users.
   */
  auth_provider: AuthProvider;
}

export interface SessionDTO {
  user: SessionUser;
}

/**
 * Verify the current request's session against the backend and return a minimal
 * user DTO, or `null` when signed out / invalid / unreachable.
 *
 * Wrapped in React `cache()` so multiple callers within a single server render
 * (layout, page, metadata) share ONE `/auth/me` round trip. A 401 (revoked or
 * bogus token) or any network error resolves to `null` — callers render the
 * signed-out path rather than crashing.
 */
export const verifySession = cache(async (): Promise<SessionDTO | null> => {
  try {
    // Short-circuit before the network hop when there's no token to send.
    const token = await getSessionToken();
    if (!token) return null;

    const result = await apiFetch<ApiResponse<{ user: User }>>('/auth/me');
    const user = result.data?.user;
    if (!user) return null;

    return {
      user: {
        id: user.id,
        uuid: user.uuid ?? null,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url ?? null,
        is_verified: user.is_verified,
        auth_provider: user.auth_provider,
      },
    };
  } catch {
    // 401 (revoked/invalid token) and network failures both mean "no session".
    return null;
  }
});

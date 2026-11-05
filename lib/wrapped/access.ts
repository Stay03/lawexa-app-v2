/**
 * Who asks for a Lawexa Wrapped, and until when. Shared by the /wrapped route
 * (lib/hooks/useWrapped.ts) and the v2 entry points (v2/features/wrapped), so
 * both read the record under one cache key and agree on who has one.
 */

/** Wrapped stays in the menu and on the home until the end of 31 December 2026, Lagos time. */
export const WRAPPED_ENDS_AT = Date.parse('2026-12-31T23:59:59+01:00');

/** The record is computed once by the night job: read once, kept for the visit. */
export const WRAPPED_STALE_MS = 60 * 60 * 1000;

export const wrappedKeys = {
  all: ['wrapped', 'me'] as const,
  me: (userId: string | number | null) => ['wrapped', 'me', { userId }] as const,
};

/**
 * Whether this account could have a Bar Finals Wrapped: a Nigerian Law School
 * student by their profile (the techlead's count, 4 November 2026: 594
 * profiles name a Law School campus). Only they ask the server, so the menu
 * and the home send no request for any other account.
 */
export function mayHaveWrapped(
  user: { profile?: { law_school?: string; study_institution_type?: string | null } | null } | null | undefined,
): boolean {
  const profile = user?.profile;
  return Boolean(profile && (profile.study_institution_type === 'law_school' || (profile.law_school ?? '').trim()));
}

/**
 * Signed in for Wrapped: a token and a user, not a guest. The /wrapped route
 * and its query use this one rule, so the page never waits on a query that is
 * not asked (a token whose user has not loaded).
 */
export function wrappedSignedIn(auth: { token: string | null | undefined; user: unknown; isGuest: boolean }): boolean {
  return Boolean(auth.token && auth.user && !auth.isGuest);
}

/** Whether the edition is still on at `now`. */
export function wrappedRunning(now: number): boolean {
  return now < WRAPPED_ENDS_AT;
}

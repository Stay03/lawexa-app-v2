import type { SessionUser } from './session';

/**
 * Where an account that has not finished signing up must go first (v2 Stage
 * 1, item 2; Stay, 19 October 2026, 02:10 UTC). v1 sends such a reader back on
 * every page (`components/auth/OnboardingGuard.tsx`); the new design let them
 * in half-way.
 *
 *  - An email signup that has not verified its address: the "check your
 *    email" screen. Only `email` signups ever verify; a Google account arrives
 *    verified.
 *  - An account that has not finished onboarding: the onboarding steps.
 *
 * Both screens stay in the old design, and both send the reader to `/` when
 * they are done, which is the new design again. Guests and crawlers have no
 * sign-up to finish.
 *
 * DONE MEANS WHAT v1 MEANS, EXACTLY: a completion date or a profession on the
 * profile (`lib/stores/authStore.ts`). The onboarding page sends a reader it
 * considers done straight back to `/`; a stricter rule here than there would
 * bounce that reader between the two.
 *
 * Null: nothing to finish.
 */
export function unfinishedSignupPath(user: SessionUser): string | null {
  if (user.role === 'guest' || user.role === 'bot') return null;
  if (user.auth_provider === 'email' && !user.is_verified) {
    return `/check-email?email=${encodeURIComponent(user.email ?? '')}`;
  }
  if (!user.onboarding_complete) return '/onboarding';
  return null;
}

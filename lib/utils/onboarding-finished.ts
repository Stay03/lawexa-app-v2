/**
 * Has an account finished onboarding? (v2 Stage 1, item 2; fixed 19 October
 * 2026 after Tester Claude's live test.)
 *
 * The server's own answer is the completion date: only onboarding's last step
 * sets `onboarding_completed_at`, and `/onboarding/progress` reports it as
 * `is_completed` (backend). v1's rule also counts a profession, for accounts
 * that onboarded before the completion date existed (Stay, ed35c906, 26
 * January 2026: "If the user already has a profession, they completed
 * onboarding before"). But the current onboarding sets the profession at its
 * first step, so a lawyer who stops part-way has one too, and the new design
 * let them in (v1 kept them out only by the flag it stores at sign-up).
 *
 * So a profession counts only for an account that never started the current
 * onboarding: one with no `onboarding_step`. Anyone part-way has a step and no
 * completion date, and goes back to finish. The onboarding page sends a reader
 * to `/` only when the server says completed, so no reader bounces between the
 * two.
 */
export function onboardingFinished(
  profile:
    | {
        onboarding_completed_at?: string | null;
        profession?: string | null;
        onboarding_step?: number | null;
      }
    | null
    | undefined,
): boolean {
  if (!profile) return false;
  if (profile.onboarding_completed_at) return true;
  const startedCurrentOnboarding = profile.onboarding_step !== null && profile.onboarding_step !== undefined;
  return !!profile.profession && !startedCurrentOnboarding;
}

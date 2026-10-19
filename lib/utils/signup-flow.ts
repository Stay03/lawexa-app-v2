import { onboardingFinished } from './onboarding-finished';

/**
 * The email-verification screens' decisions (Tester Claude's sign-up test,
 * 19 October 2026, rows 3, 8, 9 and 10; Stay's go 12:25 UTC). Pure, so the
 * screens stay thin and the rules are tested.
 */

/**
 * What the verification link's landing page says. The server redirects to
 * `/email-verified?status=…` with exactly one of `success`,
 * `already-verified` (hyphen, as the server sends it), `expired` (an expired,
 * tampered or missing signature) or `invalid`. Anything else reads as invalid.
 */
export type EmailVerifiedState = 'success' | 'already-verified' | 'expired' | 'invalid';

export function emailVerifiedState(status: string | null): EmailVerifiedState {
  return status === 'success' || status === 'already-verified' || status === 'expired' ? status : 'invalid';
}

/**
 * Where a verified account goes next: onboarding when it has not finished,
 * else the app. The same rule the app's own gate uses
 * (`v2/runtime/onboarding-finished.ts`), so the two never send a reader back
 * and forth.
 */
export function pathAfterVerified(
  profile: Parameters<typeof onboardingFinished>[0],
): '/' | '/onboarding' {
  return onboardingFinished(profile) ? '/' : '/onboarding';
}

/** How long "Resend verification email" waits after a send. */
export const RESEND_WAIT_SECONDS = 60;

/**
 * The wait after a resend that failed: the server's own retry time on a 429
 * (its `Retry-After` header, in seconds), else nothing to wait for.
 */
export function resendWaitAfterError(error: unknown): number {
  const response = (error as { response?: { status?: number; headers?: Record<string, unknown> } }).response;
  if (response?.status !== 429) return 0;
  const raw = response.headers?.['retry-after'];
  const seconds = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : RESEND_WAIT_SECONDS;
}

/** The resend button's words while it waits. */
export function resendLabel(secondsLeft: number): string {
  return secondsLeft > 0 ? `Resend in ${secondsLeft} s` : 'Resend verification email';
}

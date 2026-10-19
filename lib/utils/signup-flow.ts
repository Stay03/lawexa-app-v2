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
 * The wait after a resend that failed: on a 429, the server's own time.
 * Backend (4e18e778, 19 October 2026): one email per 60 s per user, and the
 * 429 says how long is left in `errors.retry_after_seconds`. The older route
 * limit answers 429 without it, and a `Retry-After` header may or may not be
 * set, so those come next, then 60 s. Any other failure: nothing to wait for.
 */
export function resendWaitAfterError(error: unknown): number {
  const response = (
    error as {
      response?: {
        status?: number;
        headers?: Record<string, unknown>;
        data?: { errors?: { retry_after_seconds?: unknown } };
      };
    }
  ).response;
  if (response?.status !== 429) return 0;
  for (const raw of [response.data?.errors?.retry_after_seconds, response.headers?.['retry-after']]) {
    const seconds = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  }
  return RESEND_WAIT_SECONDS;
}

/**
 * A resend that the server answered with "already verified" (200, "Email
 * already verified."): the account is verified, so the screen moves on rather
 * than count down.
 */
export function resendSaysVerified(message: string | null | undefined): boolean {
  return /already verified/i.test(message ?? '');
}

/** The resend button's words while it waits. */
export function resendLabel(secondsLeft: number): string {
  return secondsLeft > 0 ? `Resend in ${secondsLeft} s` : 'Resend verification email';
}

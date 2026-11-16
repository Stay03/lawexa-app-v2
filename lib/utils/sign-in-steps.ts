/* The steps of signing in, signing up, confirming an email and onboarding, shared by the held
 * invite (components/join/pending-invite.ts) and the held Space (lib/utils/pending-space.ts):
 * neither pulls a person away from these pages. In lib so v1 and v2 both read it. */

/**
 * The pages a held invite never pulls a person away from: the invite itself,
 * and every step of signing in, signing up, confirming an email and
 * onboarding. Once they are past those, the invite takes them back.
 */
export const STEPS_BEFORE_THE_INVITE = [
  '/join',
  '/login',
  '/register',
  '/check-email',
  '/verify-email',
  '/email-verified',
  '/forgot-password',
  '/reset-password',
  '/auth',
  '/onboarding',
];

/** Whether this page is the invite or a step of signing in, signing up, confirming an email or onboarding. */
export function isASignInStep(pathname: string): boolean {
  const path = pathname.startsWith('/v2/') ? pathname.slice(3) : pathname;
  return STEPS_BEFORE_THE_INVITE.some((step) => path === step || path.startsWith(`${step}/`));
}

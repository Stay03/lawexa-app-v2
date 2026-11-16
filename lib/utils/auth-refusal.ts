/* Why sign-in or sign-up refused an email, when the server says (Backend, 16 November 2026).
 *
 * Students given registration links signed up with Google, came back, typed the
 * same email and a password, read "Invalid credentials" and went to create an
 * account (30 of 31 failed sign-ins in a day were Google accounts). The server
 * now names the two cases in `errors.code`:
 *
 *  - `use_google`: the account has no password; it signs in with Google
 *    (POST /auth/login 401, and POST /auth/register 422).
 *  - `email_taken`: the email already has a password account (POST /auth/register 422).
 *
 * A wrong password or an unknown email has no code and reads as before. */

export type AuthRefusal = 'use_google' | 'email_taken';

export const USE_GOOGLE_LINE = 'This account signs in with Google.';
export const EMAIL_TAKEN_LINE = 'You already have an account. Sign in instead.';

/** The refusal's code, or null for every other answer (and for an older server). */
export function authRefusalOf(error: { errors?: unknown } | null | undefined): AuthRefusal | null {
  const errors = error?.errors;
  if (typeof errors !== 'object' || errors === null) return null;
  const code = (errors as { code?: unknown }).code;
  return code === 'use_google' || code === 'email_taken' ? code : null;
}

/** Sign in with this email already in the box, coming back where sign-up would have. */
export function signInWithEmailHref(email: string, returnPath: string | null): string {
  const params = new URLSearchParams({ email });
  if (returnPath) params.set('redirect', returnPath);
  return `/login?${params.toString()}`;
}

/** The `?email=` sign-in was opened with, when it looks like one; else empty. */
export function emailFromSearch(search: string): string {
  const email = new URLSearchParams(search).get('email')?.trim() ?? '';
  return email.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(email) ? email : '';
}

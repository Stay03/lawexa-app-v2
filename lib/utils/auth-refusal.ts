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

/**
 * Sign-up's first step asks whether the email already has an account (POST
 * /auth/email-status), so a student is told at once rather than after filling
 * in a name and a password: a Google account gets Google's button, any other
 * Sign in. Null: a new email, carry on.
 */
export function refusalForEmailStatus(status: { exists?: unknown; provider?: unknown } | null | undefined): AuthRefusal | null {
  if (status?.exists !== true) return null;
  return status.provider === 'google' ? 'use_google' : 'email_taken';
}

/**
 * Sign-in asks how an email signs in when the reader leaves the email box
 * (Stay, 16 November 2026: Google accounts typed with a password). Only a
 * Google account changes the form; an email account and an unknown email read
 * the same, so the check never says whether an address has an account.
 */
export function signsInWithGoogle(status: { exists?: unknown; provider?: unknown } | null | undefined): boolean {
  return status?.exists === true && status.provider === 'google';
}

/** Worth asking about: something that looks like an email address. */
export function looksLikeEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

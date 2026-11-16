import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EMAIL_TAKEN_LINE, USE_GOOGLE_LINE, authRefusalOf, emailFromSearch, signInWithEmailHref } from '@/lib/utils/auth-refusal';
import { keepRef } from './sign-in-href';

/* Students given registration links couldn't sign in (Arthur, 16 November 2026). Google-made accounts were tried
 * with a password, a taken email gave no way to sign in, and a page opened after sign-in still showed its
 * signed-out state until a reload (Lucy's live walk). TEST DATA. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the server’s codes are read; every other answer reads as before', () => {
  assert.equal(authRefusalOf({ errors: { code: 'use_google', provider: 'google' } }), 'use_google');
  assert.equal(authRefusalOf({ errors: { code: 'email_taken', email: ['The email has already been taken.'] } }), 'email_taken');
  assert.equal(authRefusalOf({ errors: null }), null, 'a wrong password: "Invalid credentials." as before');
  assert.equal(authRefusalOf({ errors: { email: ['The email has already been taken.'] } }), null, 'an older server');
  assert.equal(authRefusalOf({ errors: { code: 'something_else' } }), null);
  assert.equal(authRefusalOf(null), null);
  assert.equal(USE_GOOGLE_LINE, 'This account signs in with Google.');
  assert.equal(EMAIL_TAKEN_LINE, 'You already have an account. Sign in instead.');
});

test('Sign in from a taken email carries the email and the way back; only an email is read back', () => {
  assert.equal(signInWithEmailHref('ada@example.test', null), '/login?email=ada%40example.test');
  assert.equal(signInWithEmailHref('ada@example.test', '/quiz/q/abc?ref=magician'), '/login?email=ada%40example.test&redirect=%2Fquiz%2Fq%2Fabc%3Fref%3Dmagician');
  assert.equal(emailFromSearch('?email=ada%40example.test&redirect=%2F'), 'ada@example.test');
  assert.equal(emailFromSearch('?email=not-an-email'), '');
  assert.equal(emailFromSearch(''), '');
});

test('the way back after sign-in keeps the referral code, and only a plain one', () => {
  assert.equal(keepRef('/quiz/q/abc', 'magician'), '/quiz/q/abc?ref=magician');
  assert.equal(keepRef('/quiz/q/abc?from=x', 'magician'), '/quiz/q/abc?from=x&ref=magician');
  assert.equal(keepRef('/quiz/q/abc', null), '/quiz/q/abc');
  assert.equal(keepRef('/quiz/q/abc', '"><script>'), '/quiz/q/abc');
  const front = read('v2', 'features', 'quiz', 'solo', 'front', 'QuizFrontScreen.tsx');
  assert.match(front, /const signInPath = signInHref\(keepRef\(returnPath, refParam\)\);/);
  assert.match(front, /router\.push\(signInPath\);/);
  assert.match(front, /<Link href=\{signInPath\}>Sign in to take this quiz<\/Link>/);
});

test('after sign-in, sign-up and Google the next page opens with a full load, so it is signed in', () => {
  const auth = read('lib', 'hooks', 'useAuth.ts');
  assert.equal((auth.match(/landAfterSignIn\(/g) ?? []).length, 4, 'login and register, each to check-email or onward');
  assert.doesNotMatch(auth, /router\.push\(needsOnboarding/);
  assert.doesNotMatch(auth, /router\.push\(`\/check-email/);
  const google = read('app', '(auth)', 'auth', 'google', 'callback', 'page.tsx');
  assert.match(google, /landAfterSignIn\(needsOnboarding \? '\/onboarding' : \(back \?\? '\/'\)\);/);
  assert.match(read('lib', 'utils', 'auth-return.ts'), /export function landAfterSignIn\(path: string\): void \{\s*window\.location\.assign\(path\);/);
});

test('the forms say what to do instead: Google’s button, or Sign in', () => {
  const login = read('components', 'auth', 'LoginForm.tsx');
  assert.match(login, /\{refusal \? \(\s*<AuthRefusalNote refusal=\{refusal\} email=\{form\.getValues\('email'\)\} \/>/);
  assert.match(login, /const email = emailFromSearch\(window\.location\.search\);\s*if \(email\) form\.setValue\('email', email\);/);
  const register = read('components', 'auth', 'RegisterForm.tsx');
  assert.match(register, /\{authRefusalOf\(registerError\) \? \(\s*<AuthRefusalNote refusal=\{authRefusalOf\(registerError\)!\} email=\{email\} \/>/);
  const note = read('components', 'auth', 'AuthRefusalNote.tsx');
  assert.match(note, /if \(refusal === 'use_google'\) \{[\s\S]{0,300}<GoogleAuthButton \/>/);
  assert.match(note, /href=\{signInWithEmailHref\(email, returnPath\)\}/);
});

test('"check your email" says the account is signed in, and another address signs out first', () => {
  const page = read('app', '(auth)', 'check-email', 'page.tsx');
  assert.match(page, /Confirm your email to continue/);
  assert.match(page, /You&apos;re signed in\. To finish, open the link we sent to/);
  assert.match(page, /onClick=\{\(\) => logout\('\/register'\)\}/);
  assert.doesNotMatch(page, /Sign up again/);
  const auth = read('lib', 'hooks', 'useAuth.ts');
  assert.match(auth, /useMutation<Awaited<ReturnType<typeof authApi\.logout>>, Error, '\/login' \| '\/register' \| void>\(/);
  assert.match(auth, /router\.push\(next \|\| '\/login'\);/);
});

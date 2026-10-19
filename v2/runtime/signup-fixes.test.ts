import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getTotalSteps, shouldShowEducationStep } from '../../lib/utils/onboarding';
import {
  RESEND_WAIT_SECONDS,
  emailVerifiedState,
  pathAfterVerified,
  resendLabel,
  resendSaysVerified,
  resendWaitAfterError,
} from '../../lib/utils/signup-flow';

/* Tester Claude's sign-up test (19 October 2026), rows 3, 8, 9, 10 and 20;
 * Stay's go 12:25 UTC ("for 20 skip the step for lawyer"). */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('row 8 and 9: the landing page reads the four statuses the server sends', () => {
  assert.equal(emailVerifiedState('success'), 'success');
  assert.equal(emailVerifiedState('already-verified'), 'already-verified');
  assert.equal(emailVerifiedState('expired'), 'expired');
  assert.equal(emailVerifiedState('invalid'), 'invalid');
  // Anything else, or none, is a broken link.
  assert.equal(emailVerifiedState('already_verified'), 'invalid');
  assert.equal(emailVerifiedState(null), 'invalid');
  const page = read('app', '(auth)', 'email-verified', 'page.tsx');
  assert.match(page, /'Your email is already verified'/);
  assert.match(page, /This link has expired or is broken/);
  assert.match(page, /'Send a new link'/);
  // Signed out on this device: sign in first, then ask from "Check your email".
  assert.match(page, /router\.push\(`\/login\?redirect=\$\{encodeURIComponent\('\/check-email'\)\}`\);/);
  assert.match(page, /router\.push\(pathAfterVerified\(response\.data\.user\.profile\)\);/);
});

test('row 10: a verified account moves on, to onboarding only when it is unfinished', () => {
  assert.equal(pathAfterVerified({ onboarding_completed_at: '2026-10-19T12:00:00Z' }), '/');
  assert.equal(pathAfterVerified({ profession: 'lawyer', onboarding_step: 7, onboarding_completed_at: null }), '/onboarding');
  assert.equal(pathAfterVerified({ profession: null, onboarding_step: null }), '/onboarding');
  const page = read('app', '(auth)', 'check-email', 'page.tsx');
  assert.match(page, /if \(user\?\.is_verified\) \{\s*useAuthStore\.getState\(\)\.updateUser\(user\);\s*router\.replace\(pathAfterVerified\(user\.profile\)\);/);
  assert.match(page, /document\.addEventListener\('visibilitychange', onVisible\);/);
});

test('row 3: Resend waits a minute after a send, and the server’s own time on a 429', () => {
  assert.equal(RESEND_WAIT_SECONDS, 60);
  assert.equal(resendLabel(0), 'Resend verification email');
  assert.equal(resendLabel(42), 'Resend in 42 s');
  // The server's own count, in the body (backend 4e18e778), comes first.
  assert.equal(resendWaitAfterError({ response: { status: 429, data: { errors: { retry_after_seconds: 42 } }, headers: { 'retry-after': '37' } } }), 42);
  assert.equal(resendWaitAfterError({ response: { status: 429, headers: { 'retry-after': '37' } } }), 37);
  // Verified meanwhile: the answer moves the reader on, not into a countdown.
  assert.equal(resendSaysVerified('Email already verified.'), true);
  assert.equal(resendSaysVerified('Verification link sent.'), false);
  assert.equal(resendSaysVerified(undefined), false);
  assert.equal(resendWaitAfterError({ response: { status: 429, headers: {} } }), 60);
  assert.equal(resendWaitAfterError({ response: { status: 500 } }), 0);
  assert.equal(resendWaitAfterError(new Error('network')), 0);
  const page = read('app', '(auth)', 'check-email', 'page.tsx');
  assert.match(page, /disabled=\{isResending \|\| secondsLeft > 0\}/);
  assert.match(page, /setSecondsLeft\(RESEND_WAIT_SECONDS\);/);
});

test('row 20: a lawyer has no education step, and the steps around it agree', () => {
  assert.equal(shouldShowEducationStep('lawyer'), false);
  assert.equal(shouldShowEducationStep('law_student'), true);
  assert.equal(shouldShowEducationStep('other', 'student'), true);
  // type, communication, location, [profile], expertise, verification
  assert.equal(getTotalSteps('lawyer', undefined, false), 6);
  assert.equal(getTotalSteps('lawyer', undefined, true), 5);
  assert.equal(getTotalSteps('law_student', undefined, false), 7);
  const step4 = read('app', '(onboarding)', 'onboarding', 'step-4', 'page.tsx');
  assert.match(step4, /if \(userType === 'lawyer'\) \{\s*\/\/[^\n]*\n\s*router\.push\('\/onboarding\/step-7'\);/);
  const step6 = read('app', '(onboarding)', 'onboarding', 'step-6', 'page.tsx');
  assert.match(step6, /router\.replace\(userType === 'lawyer' \? '\/onboarding\/step-7' : '\/onboarding\/step-4'\);/);
  const step7 = read('app', '(onboarding)', 'onboarding', 'step-7', 'page.tsx');
  assert.match(step7, /router\.push\(skipProfile \? '\/onboarding\/step-3' : '\/onboarding\/step-4'\);/);
  assert.match(step7, /currentStep=\{userType === 'lawyer' \? \(skipProfile \? 4 : 5\)/);
  assert.match(read('app', '(onboarding)', 'onboarding', 'step-8', 'page.tsx'), /currentStep=\{skipProfile \? 5 : 6\}/);
});

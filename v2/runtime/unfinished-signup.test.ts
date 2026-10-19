import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SessionUser } from './session';
import { unfinishedSignupPath } from './unfinished-signup';

/* v2 Stage 1, item 2 (Stay, 19 October 2026, 02:10 UTC): an account that has
 * not finished signing up goes back to finish it on every page, as in v1. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const user = (over: Partial<SessionUser> = {}): SessionUser => ({
  id: 7,
  uuid: null,
  name: 'Test Reader',
  username: null,
  email: 'reader+test@example.com',
  role: 'user',
  avatar_url: null,
  is_verified: true,
  auth_provider: 'email',
  can_set_price: false,
  is_ambassador: null,
  profile_country_name: null,
  profile_country_code: null,
  is_lawyer: false,
  can_access_team_channels: false,
  onboarding_complete: true,
  ...over,
});

test('a finished account goes nowhere', () => {
  assert.equal(unfinishedSignupPath(user()), null);
});

test('an email signup that has not verified goes to check your email, with its address', () => {
  assert.equal(
    unfinishedSignupPath(user({ is_verified: false })),
    '/check-email?email=reader%2Btest%40example.com',
  );
  // Verification comes before onboarding, as in v1.
  assert.equal(
    unfinishedSignupPath(user({ is_verified: false, onboarding_complete: false })),
    '/check-email?email=reader%2Btest%40example.com',
  );
});

test('a Google account never verifies; it goes to onboarding only if unfinished', () => {
  assert.equal(unfinishedSignupPath(user({ auth_provider: 'google', is_verified: false })), null);
  assert.equal(
    unfinishedSignupPath(user({ auth_provider: 'google', is_verified: false, onboarding_complete: false })),
    '/onboarding',
  );
});

test('an account that has not finished onboarding goes to the onboarding steps', () => {
  assert.equal(unfinishedSignupPath(user({ onboarding_complete: false })), '/onboarding');
});

test('a guest pass and a crawler have no sign-up to finish', () => {
  for (const role of ['guest', 'bot'] as const) {
    assert.equal(unfinishedSignupPath(user({ role, is_verified: false, onboarding_complete: false })), null, role);
  }
});

test('the session reads the onboarding rule from onboarding-finished.ts', () => {
  const session = read('v2', 'runtime', 'session.ts');
  assert.match(session, /onboarding_complete: onboardingFinished\(user\.profile\),/);
});

test('the layout sends an unfinished account away before any page of the new design renders', () => {
  const layout = read('app', 'v2', 'layout.tsx');
  assert.match(
    layout,
    /const session = resolution\.kind === 'signed-in' \? resolution\.user : null;[\s\S]*?const unfinished = session \? unfinishedSignupPath\(session\.user\) : null;\s*if \(unfinished\) redirect\(unfinished\);/,
  );
  // Before the shell: the redirect comes ahead of the first JSX the layout returns.
  assert.ok(layout.indexOf('if (unfinished) redirect(unfinished);') < layout.indexOf('<V2SessionProvider'));
});

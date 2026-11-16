import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { pendingSpaceStep, signInToSpaceHref, signUpToSpaceHref, spaceReturnPath } from '@/components/join/pending-space';
import { isASignInStep, shouldReturnToInvite } from '@/components/join/pending-invite';

/* A Space link opened by someone signed out (Lucy's walk, 16 November 2026): the Space is kept through
 * sign-in, sign-up, email confirmation and onboarding, and they land on it afterwards. Only a Space's own
 * address is ever kept or followed (techlead: no open redirect). */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const UUID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const SPACE = `/spaces/${UUID}`;

test('only one Space’s address is kept, and a path inside it returns to the Space', () => {
  assert.equal(spaceReturnPath(SPACE), SPACE);
  assert.equal(spaceReturnPath(`/v2${SPACE}`), SPACE);
  assert.equal(spaceReturnPath(`${SPACE}/conversations/abc`), SPACE);
  assert.equal(spaceReturnPath(`/spaces/${UUID.toUpperCase()}`), SPACE);
  for (const bad of [
    null,
    '',
    '/spaces',
    '/spaces/discover',
    '/spaces/not-a-uuid',
    `//evil.example${SPACE}`,
    `https://evil.example${SPACE}`,
    `/\\evil.example${SPACE}`,
    `${SPACE}?next=//evil.example`,
    `/channels/${UUID}`,
    `/login?redirect=${SPACE}`,
  ]) {
    assert.equal(spaceReturnPath(bad), null, String(bad));
  }
});

test('the panel’s links come back to the Space', () => {
  assert.equal(signInToSpaceHref(SPACE), `/login?redirect=${encodeURIComponent(SPACE)}`);
  assert.equal(signUpToSpaceHref(SPACE), `/register?redirect=${encodeURIComponent(SPACE)}`);
});

test('the held Space takes them back once signed in and confirmed, past every sign-in step, and is then let go', () => {
  const at = (pathname: string, over: Partial<Parameters<typeof pendingSpaceStep>[0]> = {}) =>
    pendingSpaceStep({ space: SPACE, pathname, signedIn: true, isGuest: false, verified: true, holdsInvite: false, ...over });
  assert.equal(at('/'), 'go');
  assert.equal(at('/v2/notes'), 'go');
  assert.equal(at(SPACE), 'forget');
  assert.equal(at(`/v2${SPACE}/conversations/abc`), 'forget');
  for (const step of ['/login', '/register', '/check-email', '/verify-email', '/email-verified', '/onboarding', '/auth/google/callback', '/v2/onboarding']) {
    assert.equal(at(step), null, step);
  }
  assert.equal(at('/', { signedIn: false }), null);
  assert.equal(at('/', { isGuest: true }), null, 'a guest pass is not an account');
  assert.equal(at('/', { verified: false }), null);
  assert.equal(at('/', { holdsInvite: true }), null, 'a held invite goes first');
  assert.equal(at('/', { space: null }), null);
});

test('the invite’s own return is unchanged by the shared step check', () => {
  assert.equal(isASignInStep('/join/abc'), true);
  assert.equal(isASignInStep('/v2/onboarding'), true);
  assert.equal(isASignInStep('/spaces'), false);
  assert.equal(shouldReturnToInvite({ code: 'abc', pathname: '/', signedIn: true, isGuest: false, verified: true }), true);
  assert.equal(shouldReturnToInvite({ code: 'abc', pathname: '/check-email', signedIn: true, isGuest: false, verified: true }), false);
});

test('the panels at a Space’s address link back to it; the return is mounted for the whole app', () => {
  const gate = read('v2', 'features', 'collab', 'access.tsx');
  assert.match(gate, /const returnTo = spaceReturnPath\(pathname\);/);
  assert.match(gate, /<CollabSignedOutState returnTo=\{returnTo\} \/>/);
  assert.match(gate, /<CollabCreateAccountState returnTo=\{returnTo\} \/>/);
  const states = read('v2', 'features', 'collab', 'ui', 'states.tsx');
  assert.equal((states.match(/<AuthLink to="login" returnTo=\{returnTo\}>/g) ?? []).length, 2);
  assert.equal((states.match(/<AuthLink to="register" returnTo=\{returnTo\}>/g) ?? []).length, 1);
  const link = read('v2', 'features', 'collab', 'ui', 'AuthLink.tsx');
  assert.match(link, /if \(returnTo\) rememberPendingSpace\(returnTo\);/);
  const layout = read('app', 'layout.tsx');
  assert.match(layout, /<PendingInviteReturn \/>[\s\S]{0,200}<PendingSpaceReturn \/>/);
});

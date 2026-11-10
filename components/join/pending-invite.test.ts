import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inviteJoinPath, shouldReturnToInvite, signInToJoinHref, signUpToJoinHref } from './pending-invite';
import { safeReturnPath } from '@/lib/utils/auth-return';

/* The Space invite join fix (Backend's study, confirmed by the techlead, 10
 * November 2026). TEST DATA codes only.
 * (1) After sign-up from /join/{code}, the held code was never read again, so
 *     the join never finished. Now a signed-in, confirmed person is taken back
 *     to the invite, and the join screen finishes the join.
 * (2) A signed-out person who already had an account was sent to /register.
 *     Now sign-in comes first, with ?redirect= back to the invite. */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

const ready = { code: 'TESTCODE1', signedIn: true, isGuest: false, verified: true };

test('sign-in and sign-up both come back to the invite, through a path auth-return accepts', () => {
  assert.equal(inviteJoinPath('TESTCODE1'), '/join/TESTCODE1');
  assert.equal(signInToJoinHref('TESTCODE1'), '/login?redirect=%2Fjoin%2FTESTCODE1');
  assert.equal(signUpToJoinHref('TESTCODE1'), '/register?redirect=%2Fjoin%2FTESTCODE1');
  // The login and register forms read ?redirect= through safeReturnPath: the invite's path passes.
  assert.equal(safeReturnPath(new URLSearchParams(signInToJoinHref('TESTCODE1').split('?')[1]).get('redirect')), '/join/TESTCODE1');
  // A code is only ever a path segment.
  assert.equal(inviteJoinPath('a/b?c'), '/join/a%2Fb%3Fc');
});

test('a held invite takes a signed-in, confirmed person back to it, from anywhere past sign-up', () => {
  for (const pathname of ['/', '/c/abc', '/spaces', '/v2/spaces', '/notes/1', '/home']) {
    assert.equal(shouldReturnToInvite({ ...ready, pathname }), true, pathname);
  }
});

test('…but never from the steps before it, nor for a guest, an unconfirmed account or nobody', () => {
  for (const pathname of [
    '/join/TESTCODE1',
    '/login',
    '/register',
    '/check-email',
    '/verify-email/abc',
    '/email-verified',
    '/forgot-password',
    '/reset-password/x',
    '/auth/google/callback',
    '/onboarding',
    '/v2/onboarding',
  ]) {
    assert.equal(shouldReturnToInvite({ ...ready, pathname }), false, pathname);
  }
  assert.equal(shouldReturnToInvite({ ...ready, pathname: '/', code: null }), false);
  assert.equal(shouldReturnToInvite({ ...ready, pathname: '/', signedIn: false }), false);
  // A guest's join is refused by the server, so the code waits for their real account.
  assert.equal(shouldReturnToInvite({ ...ready, pathname: '/', isGuest: true }), false);
  // Unconfirmed: the invite would only ask them to confirm again, on every page.
  assert.equal(shouldReturnToInvite({ ...ready, pathname: '/', verified: false }), false);
  // A page that only starts like a step is not one.
  assert.equal(shouldReturnToInvite({ ...ready, pathname: '/joined-spaces' }), true);
});

test('the return is mounted once for the whole app, and moves only when it should', () => {
  const layout = read('app', 'layout.tsx');
  assert.match(layout, /<PwaInstallProvider \/>[\s\S]{0,200}<PendingInviteReturn \/>\s*\{children\}/);
  const finisher = read('components', 'join', 'PendingInviteReturn.tsx');
  assert.match(finisher, /const go = shouldReturnToInvite\(\{ code, pathname, signedIn, isGuest, verified \}\);/);
  assert.match(finisher, /if \(go && code\) router\.replace\(inviteJoinPath\(code\)\);/);
  assert.match(finisher, /state\.user\?\.is_verified === true/);
});

test('the join screen sends a signed-out viewer to sign in first, with sign-up beside it, both coming back', () => {
  const screen = read('components', 'join', 'JoinScreen.tsx');
  assert.match(screen, /sign_up: 'Sign in to join',/);
  assert.match(screen, /rememberPendingInvite\(code\);\s*router\.push\(action === 'sign_up' \? signInToJoinHref\(code\) : '\/check-email'\);/);
  assert.match(screen, /href=\{signUpToJoinHref\(code\)\}\s*onClick=\{\(\) => rememberPendingInvite\(code\)\}/);
  assert.doesNotMatch(screen, /router\.push\([^)]*'\/register'/);
});

test('back with this invite\'s code, the join finishes without a second tap, once', () => {
  const screen = read('components', 'join', 'JoinScreen.tsx');
  assert.match(screen, /const held = usePendingInvite\(\) === code;/);
  assert.match(screen, /if \(\(heldAction === 'join' \|\| heldAction === 'request'\) && accept\.isIdle\) accept\.mutate\(\);/);
  // Already a member: straight into the Space.
  assert.match(screen, /if \(heldAction === 'already_member' && heldSpace\) \{\s*forgetPendingInvite\(\);\s*router\.replace\(`\/spaces\/\$\{heldSpace\}`\);/);
  // Success and refusal both let the code go, so it never pulls the person back again.
  assert.match(screen, /onSuccess: \(response\) => \{[\s\S]{0,300}forgetPendingInvite\(\);/);
  assert.match(screen, /onError: \(error\) => \{[\s\S]{0,300}forgetPendingInvite\(\);/);
});

test('the invite\'s answer is cached per viewer, so a signed-out answer is not reused after sign-in', () => {
  // Fixture run, 10 November 2026: back from sign-in, the screen still showed the
  // signed-out "Sign in to join" from its cache, and the join never finished.
  const screen = read('components', 'join', 'JoinScreen.tsx');
  assert.match(screen, /queryKey: \['invite-preview', code, viewer\],/);
  assert.match(screen, /state\.isAuthenticated \? `\$\{state\.isGuest \? 'guest' : 'user'\}:\$\{state\.user\?\.id \?\? ''\}` : 'signed-out'/);
});

test('the sign-in and sign-up forms carry the way back to each other', () => {
  const login = read('components', 'auth', 'LoginForm.tsx');
  assert.match(login, /<AuthSwitchLink to="\/register">Sign up<\/AuthSwitchLink>/);
  assert.doesNotMatch(login, /href="\/register"/);
  const register = read('components', 'auth', 'RegisterForm.tsx');
  assert.equal(register.match(/<AuthSwitchLink to="\/login">Sign in<\/AuthSwitchLink>/g)?.length, 3);
  assert.doesNotMatch(register, /href="\/login"/);
  const link = read('components', 'auth', 'AuthSwitchLink.tsx');
  assert.match(link, /useSyncExternalStore\(noSubscription, returnPathFromLocation, \(\) => null\)/);
  assert.match(link, /returnPath \? `\$\{to\}\?redirect=\$\{encodeURIComponent\(returnPath\)\}` : to/);
});

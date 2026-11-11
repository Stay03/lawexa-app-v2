import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The signed-out flash after sign-in (card c2bf8980, techlead's go, 11
 * November 2026). Sign-in stored the token on the client and moved into v2,
 * whose layout rendered on the server with the OLD cookie, so the first paint
 * was the signed-out shell until SessionSync wrote the cookie and refreshed.
 * Now one module writes the cookie, and every sign-in and sign-out awaits it
 * before navigating. TEST DATA tokens only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const calls: { method: string; body: string | null }[] = [];
let respondOk = true;
const markerCookie = '';
globalThis.fetch = (async (_url: string, init?: { method?: string; body?: string }) => {
  calls.push({ method: init?.method ?? 'GET', body: init?.body ?? null });
  return { ok: respondOk } as Response;
}) as typeof fetch;
(globalThis as { document?: unknown }).document = {
  get cookie() {
    return markerCookie;
  },
};

const { mirrorSession } = await import('./session-mirror');

test('a fresh signed-out load with nothing mirrored sends nothing', async () => {
  calls.length = 0;
  assert.equal(await mirrorSession(null), false);
  assert.equal(calls.length, 0);
});

test('a token is mirrored once: the second ask, from SessionSync after the navigation, sends nothing', async () => {
  calls.length = 0;
  assert.equal(await mirrorSession('tok-test-a'), true);
  assert.deepEqual(calls, [{ method: 'POST', body: JSON.stringify({ token: 'tok-test-a' }) }]);
  assert.equal(await mirrorSession('tok-test-a'), false);
  assert.equal(calls.length, 1);
});

test('signing out clears it once; a new token mirrors again', async () => {
  calls.length = 0;
  assert.equal(await mirrorSession(null), true);
  assert.deepEqual(calls.map((call) => call.method), ['DELETE']);
  assert.equal(await mirrorSession(null), false);
  assert.equal(await mirrorSession('tok-test-b'), true);
  assert.deepEqual(calls.map((call) => call.method), ['DELETE', 'POST']);
});

test('calls run in order, so a change made mid-flight lands after, never dropped', async () => {
  calls.length = 0;
  const first = mirrorSession('tok-test-c');
  const second = mirrorSession(null);
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.deepEqual(calls.map((call) => call.method), ['POST', 'DELETE']);
});

test('a failed write changed nothing and is tried again next time; it never throws', async () => {
  calls.length = 0;
  respondOk = false;
  assert.equal(await mirrorSession('tok-test-d'), false);
  respondOk = true;
  assert.equal(await mirrorSession('tok-test-d'), true);
  assert.equal(calls.length, 2);
});

test('every sign-in and sign-out writes the cookie before it moves on', () => {
  const auth = read('lib', 'hooks', 'useAuth.ts');
  // Login and register: the mirror is awaited between setAuth and any push.
  for (const kind of ['LoginFormData', 'RegisterFormData']) {
    const start = auth.indexOf(`(data: ${kind})`);
    // To the mutation's own closing line (`\n  });`), past the calls inside it.
    const block = auth.slice(start, auth.indexOf('\n  });', start));
    const set = block.indexOf('setAuth(');
    const mirror = block.indexOf('await mirrorSession(response.data.token);');
    const push = block.indexOf('router.push(');
    assert.ok(set > -1 && mirror > set && push > mirror, `${kind}: setAuth, then the mirror, then the push`);
  }
  // Logout: cleared before the push.
  assert.match(auth, /clearAuth\(\);\s*queryClient\.clear\(\);[\s\S]*?await mirrorSession\(null\);\s*router\.push\('\/login'\);/);

  const google = read('app', '(auth)', 'auth', 'google', 'callback', 'page.tsx');
  assert.ok(
    google.indexOf('await mirrorSession(response.data.token);') > google.indexOf('setAuth(') &&
      google.indexOf('router.push(needsOnboarding') > google.indexOf('await mirrorSession('),
    'Google: setAuth, then the mirror, then the push',
  );

  const signOut = read('v2', 'features', 'settings', 'sign-out', 'sign-out.ts');
  assert.match(signOut, /useAuthStore\.getState\(\)\.clearAuth\(\);[\s\S]*?await mirrorSession\(null\);/);
  assert.doesNotMatch(signOut, /fetch\('\/api\/session'/);
});

test('SessionSync uses the same mirror and keeps no copy of its own', () => {
  const sync = read('app', 'v2', 'session-sync.tsx');
  assert.match(sync, /import \{ mirrorSession \} from '@\/lib\/session-mirror';/);
  assert.match(sync, /void mirrorSession\(token\)\.then\(\(changed\) => \{/);
  assert.doesNotMatch(sync, /fetch\('\/api\/session'|let lastSyncedToken|let queue/);
  // Only the mirror writes the cookie from the client.
  assert.equal((read('lib', 'session-mirror.ts').match(/fetch\('\/api\/session'/g) ?? []).length, 2);
});

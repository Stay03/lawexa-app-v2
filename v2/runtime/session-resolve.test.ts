import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RECOVERY_ATTEMPTS,
  backoffDelay,
  classifyMeFailure,
  resolveSessionWith,
} from './session-resolve';

/*
 * A blip in the API is not a sign-out (techlead, 14 October 2026; the
 * 20:54-20:56Z outage on 13 October). Only the server's 401 or 419, or no
 * session cookie, means signed out. Anything that may pass is tried again,
 * and if it does not pass the layout says it cannot reach Lawexa.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (...parts: string[]) =>
  readFileSync(join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');

const httpError = (status: number) => Object.assign(new Error(`status ${status}`), { status });
const named = (name: string) => Object.assign(new Error(name), { name });
const noPause = async () => {};

test('only the server’s 401 or 419 reads as signed out', () => {
  assert.equal(classifyMeFailure(httpError(401)), 'signed-out');
  assert.equal(classifyMeFailure(httpError(419)), 'signed-out');
  for (const status of [500, 502, 503, 504]) assert.equal(classifyMeFailure(httpError(status)), 'retry', `${status}`);
  // A 429 or another 4xx is not helped by asking again at once.
  assert.equal(classifyMeFailure(httpError(429)), 'unreachable');
  assert.equal(classifyMeFailure(httpError(404)), 'unreachable');
  // fetch's network failure, the attempt's timeout, a body that was not JSON.
  for (const name of ['TypeError', 'AbortError', 'TimeoutError', 'SyntaxError']) {
    assert.equal(classifyMeFailure(named(name)), 'retry', name);
  }
  assert.equal(classifyMeFailure('odd'), 'unreachable');
});

test('no session cookie is signed out, with no request', async () => {
  let calls = 0;
  const result = await resolveSessionWith(null, async () => { calls += 1; return { user: 'x' }; }, { pause: noPause });
  assert.deepEqual(result, { kind: 'signed-out' });
  assert.equal(calls, 0);
});

test('a user in the answer is signed in', async () => {
  const result = await resolveSessionWith('t', async () => ({ user: { id: 7 } }), { pause: noPause });
  assert.deepEqual(result, { kind: 'signed-in', user: { id: 7 } });
});

test('a 401 is signed out at once, never retried', async () => {
  let calls = 0;
  const result = await resolveSessionWith('t', async () => { calls += 1; throw httpError(401); }, { pause: noPause });
  assert.deepEqual(result, { kind: 'signed-out' });
  assert.equal(calls, 1);
});

test('a blip that passes on the second try is signed in', async () => {
  let calls = 0;
  const result = await resolveSessionWith('t', async () => {
    calls += 1;
    if (calls === 1) throw httpError(503);
    return { user: { id: 7 } };
  }, { pause: noPause });
  assert.deepEqual(result, { kind: 'signed-in', user: { id: 7 } });
  assert.equal(calls, 2);
});

test('a blip that does not pass is unreachable, never signed out', async () => {
  let calls = 0;
  const result = await resolveSessionWith('t', async () => { calls += 1; throw named('TypeError'); }, { pause: noPause });
  assert.deepEqual(result, { kind: 'unreachable' });
  assert.equal(calls, 2, 'two attempts in all');
});

test('an answer without a user, or a failure a retry will not change, is unreachable', async () => {
  assert.deepEqual(await resolveSessionWith('t', async () => ({ user: null }), { pause: noPause }), { kind: 'unreachable' });
  let calls = 0;
  assert.deepEqual(
    await resolveSessionWith('t', async () => { calls += 1; throw httpError(429); }, { pause: noPause }),
    { kind: 'unreachable' },
  );
  assert.equal(calls, 1);
});

test('each attempt has its own short timeout', async () => {
  const signals: AbortSignal[] = [];
  await resolveSessionWith('t', async (signal) => { signals.push(signal); throw httpError(500); }, { pause: noPause, timeoutMs: 50 });
  assert.equal(signals.length, 2);
  assert.notEqual(signals[0], signals[1]);
});

test('the client asks again after 2, 4, 8, 16 and 30 s, six times', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(backoffDelay), [2000, 4000, 8000, 16000, 30000, 30000]);
  assert.equal(RECOVERY_ATTEMPTS, 6);
});

/* ── Where it is wired ──────────────────────────────────────────────────── */

test('the layout draws "can’t reach Lawexa" for an unreachable API, and no guest shell', () => {
  const layout = read('app', 'v2', 'layout.tsx');
  assert.match(layout, /const \[resolution, recentsState\] = await Promise\.all\(\[\s*resolveSession\(\),/);
  const branch = layout.slice(layout.indexOf("if (resolution.kind === 'unreachable') {"), layout.indexOf('const session = resolution.kind'));
  assert.match(branch, /<SessionSync serverSignedIn=\{false\} serverUnreachable serverUserId=\{null\} \/>/);
  assert.match(branch, /<V2Unreachable \/>/);
  // Nothing that renders a page or caches under no viewer mounts in it.
  for (const absent of ['V2SessionProvider', 'V2CacheIdentityGuard', 'children', 'V2Sidebar']) {
    assert.ok(!branch.includes(absent), `${absent} stays out of the unreachable branch`);
  }
  assert.match(layout, /const session = resolution\.kind === 'signed-in' \? resolution\.user : null;/);
});

test('the other callers keep a null for "no reader to use", sharing the one round trip', () => {
  const session = read('v2', 'runtime', 'session.ts');
  assert.match(session, /export const resolveSession = cache\(/);
  assert.match(session, /return resolveSessionWith\(token, async \(signal\) => \{/);
  assert.match(session, /\('\/auth\/me', \{ signal \}\)/);
  assert.match(session, /export const verifySession = cache\(async \(\): Promise<SessionDTO \| null> => \{\s*const resolution = await resolveSession\(\);\s*return resolution\.kind === 'signed-in' \? resolution\.user : null;/);
  // Nothing catches every failure as "no session" any more.
  assert.doesNotMatch(session, /catch \{\s*\/\/ 401 \(revoked\/invalid token\) and network failures both mean/);
});

test('SessionSync arms no refresh of its own while the API is unreachable', () => {
  const sync = read('app', 'v2', 'session-sync.tsx');
  assert.match(sync, /serverUnreachable\?: boolean;\s*serverUserId: number \| null;\s*\}\): boolean \{\s*if \(serverUnreachable\) return false;/);
  assert.match(sync, /\[clientToken, clientUserId, serverSignedIn, serverUnreachable, serverUserId, router\]/);
});

test('the panel asks again on a backoff it clears, with no state', () => {
  const panel = read('v2', 'runtime', 'session-recovery.tsx');
  assert.match(panel, /if \(attempt >= RECOVERY_ATTEMPTS\) return;/);
  assert.match(panel, /\}, backoffDelay\(attempt\)\);/);
  assert.match(panel, /return \(\) => clearTimeout\(timer\);/);
  assert.match(panel, /onClick=\{\(\) => router\.refresh\(\)\}/);
  assert.doesNotMatch(panel, /useState|useRef/);
  assert.match(panel, /Can&apos;t reach Lawexa/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isAccountRole } from './account';

/* v2 Stage 1, item 1 (Stay, 19 October 2026, 02:10 UTC): a visitor who is not
 * signed in reads cases, statutes and notes as a GUEST, as v1 lets them. The
 * API answers those reads with a guest token and 401s them without one. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

test('a guest pass or a crawler is not an account; every signed-in role is', () => {
  for (const role of ['user', 'researcher', 'admin', 'superadmin']) assert.equal(isAccountRole(role), true, role);
  for (const role of ['guest', 'bot', null, undefined, '']) assert.equal(isAccountRole(role), false, String(role));
});

test('the layout mints the guest pass beside SessionSync, which carries it to the server', () => {
  const layout = strip(read('app', 'v2', 'layout.tsx'));
  assert.match(
    layout,
    /<SessionSync serverSignedIn=\{!!session\} serverUserId=\{user\?\.id \?\? null\} \/>\s*(?:\{\}\s*)?<GuestPass serverSignedIn=\{!!session\} \/>/,
  );
});

test('the pass is v1’s own guest call, minted once, after the store has read the device', () => {
  const pass = strip(read('v2', 'runtime', 'guest-pass.tsx'));
  // v1's call: it carries the referral attribution, the fingerprint and the device id.
  assert.match(pass, /authApi\.guestToken\(visitorId\)/);
  assert.match(pass, /useAuthStore\.getState\(\)\.setAuth\(response\.data\.user, response\.data\.token\)/);
  // One in flight at a time.
  assert.match(pass, /if \(minting\) return minting;/);
  // Never before the store has hydrated, and never over a session the server already knows.
  assert.match(pass, /if \(!hydrated \|\| serverSignedIn\) return;\s*if \(!token\) \{\s*void mint\(\);\s*return;\s*\}/);
  // A guest token the server could not read is checked, and renewed by the shared client on a 401.
  assert.match(pass, /if \(isGuest && token !== mintedToken\) renew\(\);/);
  assert.match(pass, /authApi\s*\.meSilent\(\)/);
});

test('until the pass arrives a library shows its loading shape; the panel is for a failed pass', () => {
  const gates: Array<[string[], string]> = [
    [['v2', 'features', 'cases', 'list', 'CasesBrowser.tsx'], 'CasesFallback'],
    [['v2', 'features', 'statutes', 'list', 'StatutesBrowser.tsx'], 'StatutesFallback'],
    [['v2', 'features', 'statutes', 'reader', 'StatuteScreen.tsx'], 'StatuteFallback'],
    [['v2', 'features', 'notes', 'library', 'NotesBrowser.tsx'], 'NotesFallback'],
    [['v2', 'features', 'notes', 'reader', 'NoteScreen.tsx'], 'NoteFallback'],
    [['v2', 'features', 'folders', 'list', 'FoldersBrowser.tsx'], 'FoldersFallback'],
    [['v2', 'features', 'folders', 'detail', 'FolderScreen.tsx'], 'FolderDetailFallback'],
  ];
  for (const [path, fallback] of gates) {
    const source = strip(read(...path));
    assert.match(source, /const guestPassFailed = useGuestPassFailed\(\);/, path.join('/'));
    assert.match(
      source,
      new RegExp(`if \\(!signedIn && !guestPassFailed\\) return <${fallback} />;\\s*if \\(!signedIn\\) \\{`),
      path.join('/'),
    );
  }
  for (const dir of [['cases', 'list'], ['statutes', 'list'], ['statutes', 'reader'], ['notes', 'library'], ['notes', 'reader']]) {
    const states = read('v2', 'features', ...dir, 'states.tsx');
    assert.match(states, /<Button size="sm" onClick=\{retryGuestPass\}>\s*Try again\s*<\/Button>/, dir.join('/'));
    assert.doesNotMatch(states, /available once you're signed in/, dir.join('/'));
  }
});

test('what belongs to an account stays off for a guest pass', () => {
  for (const file of ['V2Header.tsx', 'V2Sidebar.tsx', 'V2Drawer.tsx']) {
    assert.match(read('v2', 'shell', file), /const signedIn = !!user && isAccountRole\(user\.role\);/, file);
  }
  const home = read('app', 'v2', 'home.tsx');
  assert.match(home, /const signedIn = sessionSignedIn && isAccountRole\(role\);\s*[\s\S]*?usePreloadConversationScreen\(signedIn\);/);
  const kase = read('v2', 'features', 'cases', 'detail', 'CaseScreen.tsx');
  assert.match(kase, /const signedIn = sessionSignedIn && isAccountRole\(role\);/);
  const statute = read('v2', 'features', 'statutes', 'reader', 'StatuteScreen.tsx');
  assert.match(statute, /const hasAccount = signedIn && isAccountRole\(role\);/);
  assert.match(statute, /useDocumentChat\(subject, hasAccount\);/);
  assert.match(statute, /useIdlePreloadCaseChat\(hasAccount\);/);
  // The statute text itself still reads on the session, guest or not.
  assert.match(statute, /\.\.\.statutesQueries\.detail\(slug\),\s*enabled: signedIn,/);
  assert.match(read('app', 'v2', 'layout.tsx'), /<PlanCacheWatch userId=\{user && isAccountRole\(user\.role\) \? user\.id : null\} \/>/);
  assert.match(read('v2', 'features', 'conversations', 'server.ts'), /if \(!isAccountRole\(session\.user\.role\)\) return undefined;/);
});

test('a guest’s case offers an account where a reader over the limit is offered an upgrade', () => {
  const doc = read('v2', 'features', 'cases', 'detail', 'CaseDocument.tsx');
  assert.match(doc, /const role = useV2Session\(\)\.role;\s*const guest = role === 'guest';/);
  assert.match(doc, /<ViewLimitNotice message=\{detail\.limit_message\} guest=\{guest\} \/>/);
  const states = read('v2', 'features', 'cases', 'detail', 'states.tsx');
  assert.match(states, /if \(guest\) return <GuestSummaryNotice \/>;/);
  assert.match(states, /Create a free account to read the summary/);
  assert.match(states, /href="\/register"[\s\S]*?Create an account[\s\S]*?href=\{signInHref\(pathname\)\}[\s\S]*?Sign in/);
});

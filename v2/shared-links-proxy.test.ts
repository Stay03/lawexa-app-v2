import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isMigratedToV2, isV2OnlySharedPath } from './routes.manifest';

/* A shared link to an address only v2 has a page for is served from v2 to
 * everyone (Arthur, 24 October 2026: "Challenge a friend" opened "This page
 * could not be found" for anyone without the v2 cookie). */

test('the shared addresses only v2 has: a quiz page and a statute section', () => {
  assert.equal(isV2OnlySharedPath('/quiz/q/46eeb040-0b25-4c44-8425-1c338f7d8867'), true);
  assert.equal(isV2OnlySharedPath('/statutes/labour-act-1974/part-2/section-7'), true);
  assert.equal(isV2OnlySharedPath('/statutes/labour-act-1974/section-7'), true);
  // v1 has these, so they stay where the reader's choice puts them.
  for (const path of ['/quiz', '/quiz/q', '/quiz/play', '/quiz/history', '/statutes', '/statutes/labour-act-1974', '/c/abc', '/notes/my-note', '/']) {
    assert.equal(isV2OnlySharedPath(path), false, path);
  }
  // Each is a v2 route, so the proxy has a page to serve there.
  assert.equal(isMigratedToV2('/quiz/q/abc'), true);
  assert.equal(isMigratedToV2('/statutes/a/b'), true);
});

test('the proxy serves them from v2 whatever the cookie or the browser; the rest by the reader’s choice', () => {
  const proxy = readFileSync(join(process.cwd(), 'proxy.ts'), 'utf8');
  assert.match(proxy, /import \{ isMigratedToV2, isV2OnlySharedPath \} from '@\/v2\/routes\.manifest';/);
  assert.match(proxy, /if \(\(hasV2Cookie \|\| isV2OnlySharedPath\(pathname\)\) && isMigratedToV2\(pathname\)\) \{\s*const url = request\.nextUrl\.clone\(\);\s*url\.pathname = pathname === '\/' \? V2_PREFIX : `\$\{V2_PREFIX\}\$\{pathname\}`;\s*return NextResponse\.rewrite\(url\);/);
});

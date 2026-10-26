import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { isMigratedToV2 } from './routes.manifest';

/* Every fixed in-app link in v2 names a page v2 serves, or one of the few v1
 * pages v2 sends people to on purpose (Arthur, 16 October 2026: "Upgrade plan"
 * pointed at /upgrade, which only v1 serves, and only as a redirect back into
 * v2's /pricing; the in-app navigation crossed apps mid-redirect and landed on
 * v2's error screen). A v1 page that renders crosses cleanly, because Next
 * loads the whole page when the root layout changes. A v1 page that only
 * redirects does not, so a link to it must point at where it redirects. */

/** v1 pages v2 links to on purpose: each renders a page of its own. `/admin`
 *  is the admin dashboard, reached from the account menu by an admin only
 *  (Stay, 26 October 2026); v2 has no admin pages. */
const V1_PAGES_V2_SENDS_TO = new Set(['/login', '/register', '/check-email', '/ambassadors', '/admin']);

const V2_ROOT = join(process.cwd(), 'v2');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

/** Static app paths a file links to: href="/x", href={'/x'}, both halves of
 *  a `cond ? '/x' : '/y'`, and router.push/replace('/x'). Query and hash cut. */
const LINK_PATTERNS = [
  /href=["'](\/[^"'#?{}$]*)["'#?]/g,
  /href=\{\s*['"`](\/[^'"`#?{}$]*)['"`#?]/g,
  /\?\s*['"](\/[a-z][^'"#?{}$]*)['"]\s*:\s*['"](\/[a-z][^'"#?{}$]*)['"]/g,
  /router\.(?:push|replace)\(\s*['"`](\/[^'"`#?{}$]*)['"`#?]/g,
];

function linkedPaths(source: string): string[] {
  return LINK_PATTERNS.flatMap((pattern) =>
    [...source.matchAll(pattern)].flatMap((match) => match.slice(1).filter(Boolean)),
  ).map((path) => path.replace(/\/$/, '') || '/');
}

test('every fixed v2 link names a v2 page or a v1 page v2 sends to on purpose', () => {
  const strays: string[] = [];
  for (const file of sourceFiles(V2_ROOT)) {
    for (const path of linkedPaths(readFileSync(file, 'utf8'))) {
      if (!isMigratedToV2(path) && !V1_PAGES_V2_SENDS_TO.has(path)) {
        strays.push(`${path} in ${relative(process.cwd(), file)}`);
      }
    }
  }
  assert.deepEqual(strays, []);
});

test('the scan finds the links it is meant to', () => {
  assert.deepEqual(
    linkedPaths(`<Link href="/pricing">x</Link> <a href={'/cases?page=2'}>y</a> href={a ? '/register' : '/pricing'} router.push('/spaces/')`),
    ['/pricing', '/cases', '/register', '/pricing', '/spaces'],
  );
});

test('/upgrade is a 308 to /pricing before any render, for links in e-mails and bookmarks', () => {
  const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8');
  assert.match(config, /source: '\/upgrade',\s*destination: '\/pricing',\s*permanent: true,/);
  assert.equal(isMigratedToV2('/pricing'), true);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* v2 Stage 1, item 3 (Tester Claude's walk, 18 October 2026): old saved links
 * open the right page, and no tab says "preview". */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test("an old radar settings link opens the radar's settings sheet", () => {
  const page = read('app', 'v2', 'radars', '[radarUuid]', 'settings', 'page.tsx');
  assert.match(page, /redirect\(`\/radars\/\$\{encodeURIComponent\(radarUuid\)\}\?settings=1`\);/);
  // The sheet opens from exactly that parameter.
  assert.match(read('v2', 'features', 'radars', 'detail', 'RadarScreen.tsx'), /searchParams\.get\('settings'\) === '1'/);
});

test("an old radar scan-log link opens the radar's All activity tab", () => {
  const page = read('app', 'v2', 'radars', '[radarUuid]', 'scan-log', 'page.tsx');
  assert.match(page, /redirect\(`\/radars\/\$\{encodeURIComponent\(radarUuid\)\}\?tab=activity`\);/);
  assert.match(read('v2', 'features', 'radars', 'detail', 'RadarScreen.tsx'), /raw === 'activity'/);
});

test('an old quiz resume link resumes the session; one without a session goes to the hub', () => {
  const page = read('app', 'v2', 'quiz', 'play', 'page.tsx');
  assert.match(page, /const session = Array\.isArray\(s\) \? s\[0\] : s;/);
  assert.match(page, /redirect\(session \? `\/quiz\/\$\{encodeURIComponent\(session\)\}` : '\/quiz'\);/);
});

test('the new design sets no "v2 preview" title or wording', () => {
  const layout = read('app', 'v2', 'layout.tsx');
  assert.doesNotMatch(layout, /export const metadata/);
  assert.doesNotMatch(read('app', 'v2', 'error.tsx'), /preview/i);
  // The root's title is what a page without one reads.
  assert.match(read('app', 'layout.tsx'), /default: "Lawexa - Where Modern Legal Work Happens",/);
});

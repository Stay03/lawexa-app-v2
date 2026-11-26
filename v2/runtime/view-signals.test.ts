import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanLanding, cleanReferrer, clientJson, isViewRequest, scrollPercent } from '@/lib/utils/view-signals';

/* Where a reader came from and how they read (Stay, 26 November 2026; Backend f9df9b4b). TEST DATA. */

test('the three headers go on the requests that open a case, a statute or a note, and no others', () => {
  for (const [method, url] of [
    ['get', '/cases/okafor-v-bello-2019'],
    ['get', '/cases/okafor-v-bello-2019?q=eviction'],
    ['post', '/cases/okafor-v-bello-2019/view'],
    ['get', '/statutes/lagos-tenancy-law-2011'],
    ['get', '/statutes/lagos-tenancy-law-2011/export-akn'],
    ['get', '/notes/test-data-note'],
    ['GET', '/api/notes/test-data-note'],
  ]) {
    assert.equal(isViewRequest(method, url), true, `${method} ${url}`);
  }
  for (const [method, url] of [
    ['get', '/cases'],
    ['get', '/cases/okafor-v-bello-2019/cited-by'],
    ['get', '/statutes'],
    ['get', '/statutes/countries'],
    ['get', '/statutes/lagos-tenancy-law-2011/nodes'],
    ['get', '/notes'],
    ['get', '/notes/my-notes'],
    ['get', '/notes/test-data-note/export-docx'],
    ['post', '/notes/test-data-note'],
    ['patch', '/cases/okafor-v-bello-2019'],
    ['get', '/conversations/abc'],
    ['get', undefined],
  ] as const) {
    assert.equal(isViewRequest(method, url), false, `${method} ${url}`);
  }
});

test('the referrer keeps origin and path only, never a query, and nothing of our own site', () => {
  const own = 'https://lawexa.com';
  assert.equal(cleanReferrer('https://www.google.com/search?q=tenant+rights+lagos', own), 'https://www.google.com/search');
  assert.equal(cleanReferrer('https://t.co/AbC123', own), 'https://t.co/AbC123');
  assert.equal(cleanReferrer('https://mail.example.test/reset?token=SECRET&email=a%40b.test', own), 'https://mail.example.test/reset');
  assert.equal(cleanReferrer('https://lawexa.com/cases?q=x', own), '');
  assert.equal(cleanReferrer('', own), '');
  assert.equal(cleanReferrer('not a url', own), '');
  assert.equal(cleanReferrer('android-app://com.google.android.gm/', own), '');
  assert.equal(cleanReferrer(`https://example.test/${'a'.repeat(2000)}`, own).length, 1000);
});

test('the landing page keeps its path and only the campaign tags', () => {
  assert.equal(
    cleanLanding('https://lawexa.com/cases/okafor-v-bello?utm_source=whatsapp&utm_medium=share&token=SECRET&email=a%40b.test&gclid=G1&fbclid=F1'),
    '/cases/okafor-v-bello?utm_source=whatsapp&utm_medium=share&gclid=G1&fbclid=F1',
  );
  assert.equal(cleanLanding('https://lawexa.com/join/ABCD-1234?code=SECRET'), '/join/ABCD-1234');
  assert.equal(cleanLanding('https://lawexa.com/'), '/');
  assert.equal(cleanLanding('not a url'), '');
});

test('the client JSON has the five fields, cut to what the server keeps', () => {
  const json = JSON.parse(clientJson({ webdriver: true, screenWidth: 390.4, screenHeight: 844, timeZone: `Africa/Lagos${'x'.repeat(80)}`, language: 'en-NG' }));
  assert.deepEqual(Object.keys(json), ['wd', 'sw', 'sh', 'tz', 'lang']);
  assert.equal(json.wd, true);
  assert.equal(json.sw, 390);
  assert.equal(json.tz.length, 64);
  assert.equal(json.lang, 'en-NG');
});

test('the furthest scroll is the bottom of the view against the whole page, 0 to 100', () => {
  assert.equal(scrollPercent(0, 800, 4000), 20);
  assert.equal(scrollPercent(3200, 800, 4000), 100);
  assert.equal(scrollPercent(5000, 800, 4000), 100);
  assert.equal(scrollPercent(0, 800, 0), 0);
});

test('the API client sends the headers on view requests and times a view from its token', () => {
  const client = readFileSync(join(process.cwd(), 'lib', 'api', 'client.ts'), 'utf8');
  assert.match(client, /if \(typeof window !== 'undefined'\) captureVisit\(\);/);
  assert.match(client, /if \(typeof window !== 'undefined' && isViewRequest\(config\.method, config\.url\)\) \{\s*Object\.assign\(config\.headers, viewHeaders\(\)\);/);
  assert.match(client, /const token = response\.headers\?\.\['x-view-token'\];\s*if \(typeof token === 'string' && token\) startView\(token, API_BASE_URL\);/);
  const signals = readFileSync(join(process.cwd(), 'lib', 'utils', 'view-signals.ts'), 'utf8');
  // The leave: one beacon, text/plain, to the leave route; sent on hide, on pagehide, and on a move to another page.
  assert.match(signals, /new Blob\(\[body\], \{ type: 'text\/plain' \}\)/);
  assert.match(signals, /leaveUrl = `\$\{apiBase\}\/api\/views\/leave`;/);
  assert.match(signals, /if \(document\.visibilityState === 'hidden'\) \{\s*sendLeave\(\);/);
  assert.match(signals, /window\.addEventListener\('pagehide', \(\) => sendLeave\(\)\);/);
  assert.match(signals, /if \(open && window\.location\.pathname !== open\.path\) sendLeave\(\);/);
});

test('a case the server drew counts its one view from the browser, with the visit headers (Backend, 26 November 2026)', () => {
  const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
  // The server read is a read ahead: the API counts no view for it.
  const server = read('v2', 'features', 'cases', 'server.ts');
  assert.match(server, /'X-Lawexa-Prefetch': '1',/);
  assert.match(read('lib', 'api', 'cases.ts'), /export const CASE_PREFETCH_HEADER = 'X-Lawexa-Prefetch';/);
  // The page marks it as read ahead, before the screen's effects, only when the server's read is in the page.
  const page = read('app', 'v2', 'cases', '[slug]', 'page.tsx');
  assert.match(page, /\{state \? <ServerReadMark slug=\{slug\} searchQuery=\{searchQuery\} \/> : null\}\s*<CaseScreen/);
  const mark = read('v2', 'features', 'cases', 'detail', 'ServerReadMark.tsx');
  assert.match(mark, /useLayoutEffect\(\(\) => \{\s*noteReadAhead\(slug, searchTermOf\(searchQuery\)\);/);
  // The screen then sends POST /cases/{slug}/view, which carries the three headers.
  assert.match(read('v2', 'features', 'cases', 'detail', 'CaseScreen.tsx'), /if \(drawn\) countOpen\(slug, searchTermOf\(searchQuery\)\);/);
  assert.equal(isViewRequest('post', '/cases/okafor-v-bello-2019/view'), true);
});

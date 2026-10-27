import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMigratedToV2 } from '@/v2/routes.manifest';
import {
  isStaticAssetUrl,
  SELF_DESTRUCT_SOURCE,
  serviceWorkerBodyFor,
  serviceWorkerWanted,
  SW_CACHE_PREFIX,
  SW_PATH,
  type WorkerGate,
} from './serve';

const REAL = '/* the real worker */';
const inside: WorkerGate = {
  uiCookie: 'v2',
  perfValue: undefined,
  v2Enabled: true,
  swSetting: undefined,
  v2Default: false,
  userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/140.0.0.0 Mobile Safari/537.36',
};

test('the real worker goes only to a browser inside v2 with the sw layer on', () => {
  assert.equal(serviceWorkerBodyFor(inside, REAL), REAL);
  // Other layers off do not affect it.
  assert.equal(serviceWorkerBodyFor({ ...inside, perfValue: 'ssr,idb' }, REAL), REAL);
  assert.equal(serviceWorkerBodyFor({ ...inside, perfValue: '' }, REAL), REAL);
});

test('with the new design the default, a browser with no choice gets the real worker', () => {
  assert.equal(serviceWorkerBodyFor({ ...inside, uiCookie: undefined, v2Default: true }, REAL), REAL);
});

test('everyone else gets the worker that removes itself', () => {
  const cases: [string, WorkerGate][] = [
    ['no v2 cookie (a v1 browser)', { ...inside, uiCookie: undefined }],
    ['another cookie value', { ...inside, uiCookie: 'v2preview' }],
    ['the sw layer off', { ...inside, perfValue: 'sw' }],
    ['the sw layer off in a list', { ...inside, perfValue: 'route,sw' }],
    ['every layer off', { ...inside, perfValue: 'off' }],
    ['v2 disabled on the server', { ...inside, v2Enabled: false }],
    ['the operator switch LAWEXA_SW=off', { ...inside, swSetting: 'off' }],
    // The switch (v2 Stage 1, item 9): the same rule the proxy serves pages by.
    ['classic chosen, with the new design the default', { ...inside, uiCookie: 'classic', v2Default: true }],
    ['a crawler with no choice, with the new design the default', { ...inside, uiCookie: undefined, v2Default: true, userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' }],
  ];
  for (const [name, gate] of cases) {
    assert.equal(serviceWorkerWanted(gate), false, name);
    assert.equal(serviceWorkerBodyFor(gate, REAL), SELF_DESTRUCT_SOURCE, name);
  }
});

test('the removing worker deletes the caches and unregisters, and answers no request', () => {
  assert.match(SELF_DESTRUCT_SOURCE, /self\.skipWaiting\(\)/);
  assert.match(SELF_DESTRUCT_SOURCE, new RegExp(`name\\.startsWith\\('${SW_CACHE_PREFIX}'\\)`));
  assert.match(SELF_DESTRUCT_SOURCE, /caches\.delete\(name\)/);
  assert.match(SELF_DESTRUCT_SOURCE, /self\.registration\.unregister\(\)/);
  assert.doesNotMatch(SELF_DESTRUCT_SOURCE, /'fetch'|respondWith/);
  // It is valid JavaScript.
  assert.doesNotThrow(() => new Function(SELF_DESTRUCT_SOURCE));
});

test('only same-origin files under /_next/static/ count as the app\'s code', () => {
  const origin = 'https://lawexa.com';
  assert.equal(isStaticAssetUrl('https://lawexa.com/_next/static/chunks/a1.js?dpl=abc', origin), true);
  assert.equal(isStaticAssetUrl('/_next/static/media/f.woff2', origin), true);
  for (const href of [
    'https://lawexa.com/_next/image?url=x',
    'https://lawexa.com/cases/some-case',
    'https://lawexa.com/api/x',
    'https://prod-api.lawexa.com/_next/static/chunks/a1.js',
    'https://cdn.example.com/_next/static/chunks/a1.js',
    'not a url ::',
  ]) {
    assert.equal(isStaticAssetUrl(href, origin), false, href);
  }
});

test('/sw.js is outside the v2 route manifest (the proxy never rewrites it)', () => {
  assert.equal(SW_PATH, '/sw.js');
  assert.equal(isMigratedToV2(SW_PATH), false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SW_STOP_MESSAGE, SW_WARM_MESSAGE } from './serve';

const here = dirname(fileURLToPath(import.meta.url));
const worker = readFileSync(join(here, 'lawexa-sw.js'), 'utf8');
const repo = (...parts: string[]) => readFileSync(join(here, '..', '..', '..', ...parts), 'utf8');

test('the worker answers only /_next/static/ GETs; pages, RSC and API calls never reach respondWith', () => {
  assert.equal((worker.match(/respondWith\(/g) ?? []).length, 1);
  assert.match(
    worker,
    /if \(request\.method !== 'GET' \|\| request\.headers\.has\('range'\)\) return;\s*const url = new URL\(request\.url\);\s*if \(url\.origin !== self\.location\.origin \|\| !url\.pathname\.startsWith\(STATIC_PREFIX\)\) return;\s*event\.respondWith\(serveStatic\(request\)\);/,
  );
  assert.match(worker, /const STATIC_PREFIX = '\/_next\/static\/';/);
  // No navigation preload: it would put the worker in the path of every page load.
  assert.doesNotMatch(worker, /navigationPreload/);
});

test('on Chromium, static routes serve /_next/static/ from the cache and send everything else to the network', () => {
  assert.match(worker, /\{ condition: \{ urlPattern: \{ pathname: '\/_next\/static\/\*' \} \}, source: \{ cacheName: CACHE \} \}/);
  assert.match(worker, /\{ condition: \{ urlPattern: \{ pathname: '\/\*' \} \}, source: 'network' \}/);
  // The cache rule comes first: the first matching rule wins.
  assert.ok(worker.indexOf("source: { cacheName: CACHE }") < worker.indexOf("source: 'network'"));
  assert.match(worker, /if \(typeof event\.addRoutes === 'function'\)/);
});

test('only whole same-origin answers are kept, in one cache whose name the removal path knows', () => {
  assert.match(worker, /return response\.ok && response\.status === 200 && response\.type === 'basic';/);
  assert.match(worker, /const CACHE = 'lawexa-static-v1';/);
  assert.match(worker, /const META = 'lawexa-sw-meta';/);
  assert.match(worker, /const WARM_MESSAGE = '([^']+)';/);
  assert.equal(worker.match(/const WARM_MESSAGE = '([^']+)';/)?.[1], SW_WARM_MESSAGE);
});

test('warming stops when the page removes the worker or a replacement waits', () => {
  assert.equal(worker.match(/const STOP_MESSAGE = '([^']+)';/)?.[1], SW_STOP_MESSAGE);
  assert.match(worker, /if \(data\.type === STOP_MESSAGE\) \{\s*stopped = true;\s*return;\s*\}/);
  assert.match(worker, /return stopped \|\| !!self\.registration\.waiting \|\| !!self\.registration\.installing;/);
  // Checked before the cache is opened and before every file.
  assert.match(worker, /async function warm\(urls\) \{\s*if \(shouldStop\(\)\) return;/);
  assert.match(worker, /for \(const href of urls\) \{\s*if \(shouldStop\(\)\) return;/);
  // The deploy comes from the files' own ?dpl=, not from the page.
  assert.match(worker, /const dpl = urls\.map\(dplOf\)\.find\(\(value\) => value !== ''\) \?\? '';/);
  assert.doesNotMatch(repo('v2', 'runtime', 'sw', 'register.ts'), /dataset\.dplId/);
});

test('a new version takes over at once, and the real worker never removes itself', () => {
  assert.match(worker, /self\.skipWaiting\(\);/);
  assert.match(worker, /await self\.clients\.claim\(\);/);
  assert.doesNotMatch(worker, /registration\.unregister/);
});

test('two deploys are kept and older ones deleted; an earlier deploy\'s copy of the same file is reused', () => {
  assert.match(worker, /const next = \{ current: dpl, previous: state\.current \};/);
  assert.match(worker, /const keep = new Set\(\[next\.current, next\.previous\]\);/);
  assert.match(worker, /await cache\.match\(request, \{ ignoreSearch: true \}\)/);
  assert.match(worker, /const MAX_ENTRIES = 800;/);
});

test('the worker is plain JavaScript with no imports', () => {
  assert.doesNotMatch(worker, /^\s*(import|export)\s/m);
  assert.doesNotMatch(worker, /importScripts/);
  assert.doesNotThrow(() => new Function(worker));
});

test('only the v2 layout mounts the worker, and leaving v2 removes it', () => {
  assert.match(repo('app', 'v2', 'layout.tsx'), /<ServiceWorkerMount \/>/);
  assert.doesNotMatch(repo('app', 'layout.tsx'), /ServiceWorkerMount|serviceWorker\.register/);
  assert.match(repo('app', 'v2', 'switch-back-button.tsx'), /void removeServiceWorker\(\)\.then\(\(\) => window\.location\.assign\('\/'\)\);/);
  assert.match(repo('v2', 'runtime', 'sw', 'register.ts'), /register\(SW_PATH, \{ scope: SW_SCOPE, updateViaCache: 'none' \}\)/);
});

test('the route sends the gated body uncached and is the only place /sw.js comes from', () => {
  const route = repo('app', 'sw.js', 'route.ts');
  assert.match(route, /'Cache-Control': 'no-store'/);
  assert.match(route, /'Content-Type': 'application\/javascript; charset=utf-8'/);
  assert.match(route, /process\.env\.V2_ENABLED === 'true'/);
  assert.throws(() => repo('public', 'sw.js'));
});

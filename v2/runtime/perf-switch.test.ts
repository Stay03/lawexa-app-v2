import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMigratedToV2 } from '@/v2/routes.manifest';
import { PERF_LAYER_COPY, PERF_LAYERS_HEADING } from '@/v2/features/settings/developer/perf-layers';
import {
  canUsePerfSwitch,
  layerOffInBrowser,
  layerOffValue,
  layersOffIn,
  nextPerfValue,
  PERF_LAYERS,
  perfValueInCookieString,
  setLayerOff,
} from './perf-switch';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, '..', '..', ...parts), 'utf8');

test('no cookie means every layer is on', () => {
  for (const layer of PERF_LAYERS) {
    assert.equal(layerOffValue(undefined, layer), false);
    assert.equal(layerOffValue('', layer), false);
  }
});

test('each layer turns off alone and leaves the other three on', () => {
  for (const layer of PERF_LAYERS) {
    for (const other of PERF_LAYERS) {
      assert.equal(layerOffValue(layer, other), other === layer, `${layer} off: ${other}`);
    }
  }
});

test('a list turns off exactly its layers; unknown names are ignored; "off" means all', () => {
  assert.deepEqual([...layersOffIn('ssr,idb')].sort(), ['idb', 'ssr']);
  assert.deepEqual([...layersOffIn('route,nonsense,read')].sort(), ['read', 'route']);
  assert.deepEqual([...layersOffIn('off')].sort(), [...PERF_LAYERS].sort());
});

test('turning one layer on or off keeps the others, in a fixed order; all on is empty', () => {
  assert.equal(nextPerfValue('', 'idb', true), 'idb');
  assert.equal(nextPerfValue('idb', 'ssr', true), 'ssr,idb');
  assert.equal(nextPerfValue('ssr,idb', 'ssr', false), 'idb');
  assert.equal(nextPerfValue('idb', 'idb', false), '');
  assert.equal(nextPerfValue('off', 'read', false), 'ssr,idb,route');
});

test('in the browser the switches read and write one cookie; all on clears it', () => {
  assert.equal(layerOffInBrowser('ssr'), false); // no document in node: the server's answer
  const g = globalThis as { document?: { cookie: string } };
  g.document = { cookie: '' };
  try {
    setLayerOff('route', true);
    assert.match(g.document.cookie, /^lawexa-perf=route; path=\/; max-age=31536000; samesite=lax$/);
    g.document.cookie = 'a=1; lawexa-perf=route%2Cread; b=2';
    assert.equal(perfValueInCookieString(g.document.cookie), 'route,read');
    assert.equal(layerOffInBrowser('route'), true);
    assert.equal(layerOffInBrowser('read'), true);
    assert.equal(layerOffInBrowser('ssr'), false);
    g.document.cookie = 'lawexa-perf=route';
    setLayerOff('route', false);
    assert.match(g.document.cookie, /^lawexa-perf=; path=\/; max-age=0; samesite=lax$/);
  } finally {
    delete g.document;
  }
});

test('only an admin or a superadmin can use the switches', () => {
  assert.equal(canUsePerfSwitch('admin'), true);
  assert.equal(canUsePerfSwitch('superadmin'), true);
  for (const role of ['user', 'researcher', 'guest', 'bot', null, undefined]) {
    assert.equal(canUsePerfSwitch(role), false);
  }
});

test('the Developer page shows the owner\'s four switches, with On and Off lines, to an admin only', () => {
  assert.equal(isMigratedToV2('/settings/developer'), true);
  assert.equal(PERF_LAYERS_HEADING, 'Performance layers (this browser only)');
  assert.deepEqual(
    PERF_LAYER_COPY.map((c) => [c.layer, c.label]),
    [
      ['ssr', 'Server-side rendering (SSR) of case pages'],
      ['idb', 'IndexedDB query cache (lawexa-query-cache)'],
      ['route', 'Route prefetch on hover or touch (Next.js router.prefetch)'],
      ['read', 'Case prefetch on hover (X-Lawexa-Prefetch)'],
    ],
  );
  for (const copy of PERF_LAYER_COPY) assert.ok(copy.on.length > 0 && copy.off.length > 0, copy.layer);
  const screen = read('v2', 'features', 'settings', 'developer', 'DeveloperScreen.tsx');
  assert.match(screen, /\{canUsePerfSwitch\(role\) \? \(/);
  assert.match(screen, /<span className="block">On: \{copy\.on\}<\/span>/);
  assert.match(screen, /<span className="mt-1 block">Off: \{copy\.off\}<\/span>/);
  assert.match(screen, /setLayerOff\(copy\.layer, !next\);\s*window\.location\.reload\(\);/);
  // The heading is drawn on screen, not only the shared block's hidden label.
  assert.match(screen, /id="perf-layers-heading"\s*className="mb-2 px-1 text-\[13px\] font-medium text-muted-foreground"/);
});

test('each layer is checked where it acts', () => {
  assert.match(read('v2', 'features', 'cases', 'server.ts'), /if \(layerOffValue\(\(await cookies\(\)\)\.get\(PERF_COOKIE\)\?\.value, 'ssr'\)\) return undefined;/);
  assert.match(read('v2', 'runtime', 'cache-identity-guard.tsx'), /setDeviceCacheOwner\(layerOffInBrowser\('idb'\) \? null : deviceCacheOwnerOf\(userId, role\)\)/);
  assert.match(read('v2', 'shell', 'use-intent-prefetch.ts'), /if \(!layerOffInBrowser\('route'\)\) router\.prefetch\(target\);\s*onIntent\?\.\(source\);/);
  assert.match(read('v2', 'features', 'cases', 'list', 'use-case-row-intent.ts'), /if \(layerOffInBrowser\('read'\)\) return;/);
});

test('the module the server imports has no React import (Turbopack refuses client hooks in a server component)', () => {
  const pure = read('v2', 'runtime', 'perf-switch.ts');
  assert.doesNotMatch(pure, /from 'react'/);
  assert.doesNotMatch(pure, /useSyncExternalStore|useState|useEffect/);
  assert.match(read('v2', 'runtime', 'use-perf-off.ts'), /^'use client';/);
});

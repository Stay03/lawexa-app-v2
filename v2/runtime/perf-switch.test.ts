import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMigratedToV2 } from '@/v2/routes.manifest';
import {
  canUsePerfSwitch,
  perfOffInBrowser,
  perfOffInCookieString,
  perfOffValue,
  setPerfOff,
} from './perf-switch';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, '..', '..', ...parts), 'utf8');

test('the switch is off only for the exact value "off"; absent or anything else is on', () => {
  assert.equal(perfOffValue('off'), true);
  assert.equal(perfOffValue(undefined), false);
  assert.equal(perfOffValue(null), false);
  assert.equal(perfOffValue('on'), false);
  assert.equal(perfOffValue('OFF'), false);
  assert.equal(perfOffInCookieString('a=1; lawexa-perf=off; b=2'), true);
  assert.equal(perfOffInCookieString('lawexa-perf=off'), true);
  assert.equal(perfOffInCookieString('xlawexa-perf=off'), false);
  assert.equal(perfOffInCookieString('lawexa-perf=offline'), false);
  assert.equal(perfOffInCookieString(''), false);
});

test('in the browser the switch reads and writes the cookie; on the server it is always on', () => {
  assert.equal(perfOffInBrowser(), false); // no document in node: the server's answer
  const g = globalThis as { document?: { cookie: string } };
  g.document = { cookie: '' };
  try {
    setPerfOff(true);
    assert.match(g.document.cookie, /^lawexa-perf=off; path=\/; max-age=31536000; samesite=lax$/);
    g.document.cookie = 'lawexa-perf=off';
    assert.equal(perfOffInBrowser(), true);
    setPerfOff(false);
    assert.match(g.document.cookie, /^lawexa-perf=; path=\/; max-age=0; samesite=lax$/);
  } finally {
    delete g.document;
  }
});

test('only an admin or a superadmin can use the switch', () => {
  assert.equal(canUsePerfSwitch('admin'), true);
  assert.equal(canUsePerfSwitch('superadmin'), true);
  for (const role of ['user', 'researcher', 'guest', 'bot', null, undefined]) {
    assert.equal(canUsePerfSwitch(role), false);
  }
});

test('the switch sits on the Developer page, shown only to an admin', () => {
  assert.equal(isMigratedToV2('/settings/developer'), true);
  const screen = read('v2', 'features', 'settings', 'developer', 'DeveloperScreen.tsx');
  assert.match(screen, /\{canUsePerfSwitch\(role\) \? \(/);
  assert.match(screen, /setPerfOff\(!next\);\s*window\.location\.reload\(\);/);
});

test('each speed feature consults the switch: server-built case, device cache, prefetch on intent', () => {
  const server = read('v2', 'features', 'cases', 'server.ts');
  assert.match(server, /if \(perfOffValue\(\(await cookies\(\)\)\.get\(PERF_COOKIE\)\?\.value\)\) return undefined;/);
  const guard = read('v2', 'runtime', 'cache-identity-guard.tsx');
  assert.match(guard, /setDeviceCacheOwner\(perfOffInBrowser\(\) \? null : deviceCacheOwnerOf\(userId, role\)\)/);
  const intent = read('v2', 'shell', 'use-intent-prefetch.ts');
  assert.match(intent, /if \(perfOffInBrowser\(\)\) return NO_INTENT;/);
});

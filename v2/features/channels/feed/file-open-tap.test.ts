import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The channel file open (Arthur, 11 October 2026): in an iPhone home-screen app a
 * file card spun, then said "Couldn't open it", and nothing downloaded. The tab was
 * opened after the URL was minted (a popup the app refuses) and with `noopener`
 * (which returns null even on success). The hook imports the API client and React,
 * so these pin its wiring by source: tab first, request second, no noopener. */
const source = readFileSync(join(process.cwd(), 'v2', 'features', 'channels', 'feed', 'use-file-url.ts'), 'utf8');
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const openBody = code.slice(code.indexOf('const open = (target: T) =>'), code.indexOf('return { open, opening'));

test('the tab opens in the tap, before the URL is requested', () => {
  const tabAt = openBody.indexOf("window.open('', '_blank')");
  const mintAt = openBody.indexOf('fresh.mutate(');
  assert.ok(tabAt >= 0, 'opens an empty tab');
  assert.ok(mintAt > tabAt, 'requests the URL after the tab is open');
});

test('noopener is never passed, so null means the engine refused', () => {
  assert.doesNotMatch(code, /noopener/);
  assert.match(openBody, /if \(!tab\) \{\s*setFailed\(true\);\s*return;\s*\}/);
});

test('the fresh URL navigates the tab with its opener cleared', () => {
  assert.match(openBody, /tab\.opener = null;\s*tab\.location\.href = url;/);
});

test('a failed or empty mint closes the empty tab and offers Try again', () => {
  assert.match(openBody, /if \(!url\) \{\s*tab\.close\(\);\s*setFailed\(true\);/);
  assert.match(openBody, /onError: \(error\) => \{\s*tab\.close\(\);\s*setFailed\(true\);\s*setGone\(isNotFoundError\(error\)\);/);
});

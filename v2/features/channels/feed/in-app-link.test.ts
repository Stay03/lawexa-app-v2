import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inAppPath } from './in-app-link';

/* A Lawexa link in a message opens inside Lawexa (12 October 2026): on an iPhone
 * home-screen app a new tab is Safari, so a shared case link left the app and
 * there was no way to open a Lawexa address inside it (Arthur). */

test('a lawexa.com link becomes its in-app path, query kept', () => {
  assert.equal(inAppPath('https://lawexa.com/cases/charles-v-state-of-lagos?kbdebug=1'), '/cases/charles-v-state-of-lagos?kbdebug=1');
});

test('www and apex behave the same', () => {
  assert.equal(inAppPath('https://www.lawexa.com/statutes/x'), '/statutes/x');
  assert.equal(inAppPath('https://LAWEXA.com/notes/y'), '/notes/y');
});

test('the hash is kept', () => {
  assert.equal(inAppPath('https://lawexa.com/statutes/act#section-5'), '/statutes/act#section-5');
});

test('http also counts; the bare origin is the home path', () => {
  assert.equal(inAppPath('http://lawexa.com'), '/');
});

test('an outside link keeps the new tab', () => {
  assert.equal(inAppPath('https://example.com/cases/x'), null);
  assert.equal(inAppPath('https://lawexa.com.evil.example/x'), null);
  assert.equal(inAppPath('https://prod-api.lawexa.com/api/x'), null);
});

test('mailto, other schemes and text that is not a URL are left to the caller', () => {
  assert.equal(inAppPath('mailto:hello@lawexa.com'), null);
  assert.equal(inAppPath('javascript:alert(1)'), null);
  assert.equal(inAppPath('not a url'), null);
});

test('MessageContent renders Lawexa links with next/link and keeps the new tab for the rest', () => {
  const source = readFileSync(join(process.cwd(), 'v2', 'features', 'channels', 'feed', 'MessageContent.tsx'), 'utf8');
  assert.match(source, /const path = inAppPath\(href\);/);
  assert.match(source, /<Link href=\{path\} prefetch=\{false\}/);
  assert.match(source, /target: '_blank', rel: 'noopener noreferrer nofollow'/);
  assert.match(source, /<MessageLink key=\{index\} href=\{segment\.href\} text=\{segment\.value\} \/>/);
});

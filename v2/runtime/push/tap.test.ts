import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPEN_URL_MESSAGE, tapTarget } from './tap';

const ORIGIN = 'https://lawexa.com';
const tap = (url: unknown) => ({ type: OPEN_URL_MESSAGE, url });

test('a tap opens the message it names, with its query and anchor', () => {
  assert.equal(tapTarget(tap('/channels/abc?message=42#m42'), ORIGIN), '/channels/abc?message=42#m42');
});

test('a full link on this site opens as a path', () => {
  assert.equal(tapTarget(tap('https://lawexa.com/channels/abc'), ORIGIN), '/channels/abc');
});

test('a link to another site is never followed', () => {
  assert.equal(tapTarget(tap('https://evil.example/channels/abc'), ORIGIN), null);
  assert.equal(tapTarget(tap('//evil.example/x'), ORIGIN), null);
  assert.equal(tapTarget(tap('javascript:alert(1)'), ORIGIN), null);
});

test('any other worker message is ignored', () => {
  assert.equal(tapTarget({ type: 'something-else', url: '/channels/abc' }, ORIGIN), null);
  assert.equal(tapTarget(tap(''), ORIGIN), null);
  assert.equal(tapTarget(tap(42), ORIGIN), null);
  assert.equal(tapTarget('/channels/abc', ORIGIN), null);
  assert.equal(tapTarget(null, ORIGIN), null);
});

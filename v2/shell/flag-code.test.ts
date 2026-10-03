import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flagArtworkCode } from './flag-code';

test('the United Kingdom, stored as "UK", uses the GB artwork', () => {
  assert.equal(flagArtworkCode('UK'), 'gb');
  assert.equal(flagArtworkCode('uk'), 'gb');
});

test('ISO codes pass through, lower-cased and trimmed', () => {
  assert.equal(flagArtworkCode('NG'), 'ng');
  assert.equal(flagArtworkCode(' GB '), 'gb');
  assert.equal(flagArtworkCode('gh'), 'gh');
});

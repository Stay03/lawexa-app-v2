import { test } from 'node:test';
import assert from 'node:assert/strict';

import { safeReturnPath } from './auth-return';

test('sign-in returns only to a path on this site', () => {
  assert.equal(safeReturnPath('/wrapped'), '/wrapped');
  assert.equal(safeReturnPath('/wrapped?r=TESTK7Q2'), '/wrapped?r=TESTK7Q2');
  assert.equal(safeReturnPath('//evil.example'), null);
  assert.equal(safeReturnPath('/\\evil.example'), null);
  assert.equal(safeReturnPath('https://evil.example'), null);
  assert.equal(safeReturnPath(''), null);
  assert.equal(safeReturnPath(null), null);
});

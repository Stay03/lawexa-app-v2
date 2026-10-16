import { test } from 'node:test';
import assert from 'node:assert/strict';

import { joinRequestStartRole } from './join-role';

/* Contributor by default (Stay, 11:03Z); Viewer only from the Owner's own
 * Viewer link (techlead, 16 October 2026: a test for each of the three cases). */

test('a Discover ask, or a link that set no role, starts on Contributor', () => {
  assert.equal(joinRequestStartRole('editor'), 'editor');
});

test("an ask through the Owner's Viewer link starts on Viewer", () => {
  assert.equal(joinRequestStartRole('viewer'), 'viewer');
});

test('a row without approves_as, or with a value this app does not know, starts on Contributor', () => {
  assert.equal(joinRequestStartRole(undefined), 'editor');
  assert.equal(joinRequestStartRole(null), 'editor');
  assert.equal(joinRequestStartRole('owner'), 'editor');
  assert.equal(joinRequestStartRole(''), 'editor');
});

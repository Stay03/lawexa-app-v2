import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canAccessV2Preview, canUseDeveloperSettings } from './v2-access';

/* Settings › Developer in the new design is staff only (owner, 28 October
 * 2026, Moving to v2 UI, B); the classic design's switch into the new one
 * stays open to every account. */

test('only researchers, admins and superadmins see the new design\'s Developer settings', () => {
  for (const role of ['researcher', 'admin', 'superadmin'] as const) assert.equal(canUseDeveloperSettings(role), true, role);
  for (const role of ['user', 'guest', 'bot'] as const) assert.equal(canUseDeveloperSettings(role), false, role);
  assert.equal(canUseDeveloperSettings(null), false);
  assert.equal(canUseDeveloperSettings(undefined), false);
});

test('every registered account can still move from the classic design to the new one', () => {
  for (const role of ['user', 'researcher', 'admin', 'superadmin'] as const) assert.equal(canAccessV2Preview(role), true, role);
  for (const role of ['guest', 'bot'] as const) assert.equal(canAccessV2Preview(role), false, role);
});

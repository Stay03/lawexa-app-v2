import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isMigratedToV2 } from './routes.manifest';

test('the inbox and every notification address are v2', () => {
  assert.equal(isMigratedToV2('/notifications'), true);
  assert.equal(isMigratedToV2('/notifications/0b1d6e2c-4f6a-4c55-9c1e-7f3a2b9d8e01'), true);
});

test('a path that only starts with the same letters is not', () => {
  assert.equal(isMigratedToV2('/notifications-x'), false);
  assert.equal(isMigratedToV2('/notificationsx/1'), false);
});

test('the exact entries stay exact', () => {
  assert.equal(isMigratedToV2('/bookmarks'), true);
  assert.equal(isMigratedToV2('/bookmarks/x'), false);
  assert.equal(isMigratedToV2('/invitations/x'), false);
});

test('the root is never a catch-all, and the notes carve-outs still fall through', () => {
  assert.equal(isMigratedToV2('/'), true);
  assert.equal(isMigratedToV2('/nowhere'), false);
  assert.equal(isMigratedToV2('/notes/abc/publish'), false);
});

test('the ambassador referrals address is a v2 redirect shell, and only that address', () => {
  // v2 Stage 1, item 10: the approval email's link opened a page with no menu.
  assert.equal(isMigratedToV2('/ambassadors/referrals'), true);
  // The landing page and the face card stay static files for everyone.
  assert.equal(isMigratedToV2('/ambassadors'), false);
  assert.equal(isMigratedToV2('/ambassadors/face-card'), false);
  const shell = readFileSync(join(process.cwd(), 'app', 'v2', 'ambassadors', 'referrals', 'page.tsx'), 'utf8');
  assert.match(shell, /redirect\('\/settings\/referrals'\);/);
});

test('My requests keeps v1 addresses: the list and each request are v2, and nothing beside them', () => {
  // Stay, 24 October 2026: "my requests in settings". The request emails link
  // to `/content-requests/{uuid}`, so the address did not move.
  assert.equal(isMigratedToV2('/content-requests'), true);
  assert.equal(isMigratedToV2('/content-requests/559c838d-278d-47b4-9fcc-89d0e408d361'), true);
  assert.equal(isMigratedToV2('/content-requestsx'), false);
  assert.equal(isMigratedToV2('/admin/content-requests'), false);
  // Appearance still falls through to v1.
  assert.equal(isMigratedToV2('/settings/appearance'), false);
});

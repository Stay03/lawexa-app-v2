import { test } from 'node:test';
import assert from 'node:assert/strict';
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

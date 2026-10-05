import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushedScreenFor } from './pushed-route';

test('the inbox is a pushed screen whose chevron means out', () => {
  for (const path of ['/notifications', '/v2/notifications']) {
    assert.deepEqual(
      pushedScreenFor(path),
      {
        backHref: '/',
        backLabel: 'Back to home',
        title: { kind: 'fixed', text: 'Notifications' },
        reach: 'anywhere',
      },
      path,
    );
  }
});

test('a notification address goes up to the inbox and prints no title', () => {
  assert.deepEqual(pushedScreenFor('/notifications/abc'), {
    backHref: '/notifications',
    backLabel: 'Back to notifications',
    title: { kind: 'none' },
  });
});

test('nothing deeper is claimed', () => {
  assert.equal(pushedScreenFor('/notifications/abc/def'), null);
});

test('the other screens keep the parent reach they had', () => {
  assert.equal(pushedScreenFor('/settings')?.reach, undefined);
  assert.equal(pushedScreenFor('/invitations')?.reach, undefined);
  assert.equal(pushedScreenFor('/bookmarks'), null);
});

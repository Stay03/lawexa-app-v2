import { test } from 'node:test';
import assert from 'node:assert/strict';

import { wrappedLaunchSeenKey, wrappedLaunchShouldOpen, type WrappedLaunchInputs } from './launch-model';

const ready: WrappedLaunchInputs = {
  hasWrapped: true,
  userId: 7,
  seenHere: false,
  introSeen: true,
  settled: true,
  screenHeld: false,
  showing: false,
  image: 'ready',
};

test('the Wrapped launch pop-up opens once for a student with a Wrapped, after the page settles and its picture loads', () => {
  assert.equal(wrappedLaunchShouldOpen(ready), true);
  assert.equal(wrappedLaunchShouldOpen({ ...ready, settled: false }), false);
  assert.equal(wrappedLaunchShouldOpen({ ...ready, image: 'loading' }), false);
  assert.equal(wrappedLaunchShouldOpen({ ...ready, image: 'failed' }), false);
});

test('the Wrapped launch pop-up never shows without a Wrapped, once seen, or while the redesign pop-up is still due', () => {
  assert.equal(wrappedLaunchShouldOpen({ ...ready, hasWrapped: false }), false);
  assert.equal(wrappedLaunchShouldOpen({ ...ready, userId: null }), false);
  assert.equal(wrappedLaunchShouldOpen({ ...ready, seenHere: true }), false);
  assert.equal(wrappedLaunchShouldOpen({ ...ready, introSeen: false }), false);
});

test('the Wrapped launch pop-up waits for an answer being written, but stays up once it is showing', () => {
  assert.equal(wrappedLaunchShouldOpen({ ...ready, screenHeld: true }), false);
  assert.equal(wrappedLaunchShouldOpen({ ...ready, screenHeld: true, showing: true }), true);
});

test('the launch pop-up keeps its mark per account', () => {
  assert.equal(wrappedLaunchSeenKey(7), 'lawexa-wrapped-launch-seen:7');
  assert.notEqual(wrappedLaunchSeenKey(7), wrappedLaunchSeenKey(8));
});

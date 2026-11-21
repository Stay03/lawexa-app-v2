import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WRAPPED_2026_LAUNCH, WRAPPED_BAR_FINALS_LAUNCH, launchFor, wrappedLaunchSeenKey, wrappedLaunchShouldOpen, type WrappedLaunchInputs } from './launch-model';

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

test('the 2026 launch wins for someone with a 2026 record, with its own picture and its own mark', () => {
  assert.equal(launchFor(true, true), WRAPPED_2026_LAUNCH);
  assert.equal(launchFor(false, true), WRAPPED_BAR_FINALS_LAUNCH);
  assert.equal(launchFor(false, false), null);
  assert.equal(WRAPPED_2026_LAUNCH.image.src, '/wrapped/og-2026.png');
  assert.equal(WRAPPED_2026_LAUNCH.text, 'See the character your year earned you.');
  assert.notEqual(WRAPPED_2026_LAUNCH.seenKey(7), wrappedLaunchSeenKey(7));
});

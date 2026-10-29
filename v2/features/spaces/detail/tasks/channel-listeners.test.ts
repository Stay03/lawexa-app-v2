import { test } from 'node:test';
import assert from 'node:assert/strict';

import { releaseChannel, retainChannel } from './channel-listeners';

test('the channel is left only when the last board listening on it unmounts', () => {
  assert.equal(retainChannel('spaces.a'), 1);
  assert.equal(retainChannel('spaces.a'), 2);
  assert.equal(retainChannel('spaces.b'), 1);
  // The first of two boards on spaces.a goes: stay on the channel.
  assert.equal(releaseChannel('spaces.a'), 1);
  // The last one goes: 0, so the hook leaves it.
  assert.equal(releaseChannel('spaces.a'), 0);
  // Another space's count is its own.
  assert.equal(releaseChannel('spaces.b'), 0);
  // A release with nothing counted never goes below 0.
  assert.equal(releaseChannel('spaces.c'), 0);
  // A new board after the leave starts again from 1.
  assert.equal(retainChannel('spaces.a'), 1);
  assert.equal(releaseChannel('spaces.a'), 0);
});

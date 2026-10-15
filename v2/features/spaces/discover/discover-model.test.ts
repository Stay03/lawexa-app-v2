import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { askRefusal, discoverAction } from './discover-model';

/* Public shared spaces (Arthur, 15 October 2026): listed on Discover, people
 * ask to join and the space's Owner approves in the People tab. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('a Discover card offers what the reader may do: open, ask, wait, or join a team space', () => {
  assert.equal(discoverAction({ kind: 'shared', my_status: 'member' }), 'open');
  assert.equal(discoverAction({ kind: 'shared', my_status: null }), 'ask');
  assert.equal(discoverAction({ kind: 'shared', my_status: 'pending' }), 'pending');
  // An older public team space is joined at once, as before.
  assert.equal(discoverAction({ kind: 'team', my_status: null }), 'join');
  assert.equal(discoverAction({ my_status: null }), 'join');
  // The older is_member is read only when my_status is absent.
  assert.equal(discoverAction({ kind: 'team', is_member: true }), 'open');
  assert.equal(discoverAction({ kind: 'shared', my_status: null, is_member: true }), 'ask');
});

test('a refused ask says why in plain words', () => {
  assert.equal(askRefusal(409), 'You are already in this space.');
  assert.equal(askRefusal(404), 'This space is no longer public.');
  assert.match(askRefusal(403), /Lawexa account/);
  assert.match(askRefusal(500), /Try again/);
});

test('the ask and its cancel go to the documented routes', () => {
  const api = read('lib', 'api', 'collab.ts');
  assert.match(api, /`\/spaces\/\$\{spaceUuid\}\/join-requests`,\s*\{\}/);
  assert.match(api, /`\/spaces\/\$\{spaceUuid\}\/join-requests\/mine`/);
});

test('every signed-in account reaches Discover, from the spaces list', () => {
  const screen = read('v2', 'features', 'spaces', 'discover', 'DiscoverScreen.tsx');
  assert.doesNotMatch(screen, /canAccessTeamChannels|TeamChannelsClosedState/);
  assert.match(screen, /Ask to join/);
  assert.match(screen, /Request sent/);
  assert.match(screen, /Cancel request/);
  const list = read('v2', 'features', 'spaces', 'list', 'SpacesBrowser.tsx');
  assert.match(list, /href="\/spaces\/discover"/);
});

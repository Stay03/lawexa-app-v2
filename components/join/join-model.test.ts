import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { joinActionLabel, joinedDestination } from './join-model';

/* A live quiz's game link on the join screen (Backend's shapes 7a007a8c:
 * the preview names the `game`, accept answers its `game_uuid`). TEST DATA
 * only. */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

test('an accepted invite lands in the game for a game link, else the channel or the Space', () => {
  assert.equal(joinedDestination({ space_uuid: 's-1', game_uuid: 'g-1' }), '/spaces/s-1?game=g-1');
  assert.equal(joinedDestination({ space_uuid: 's-1', channel_uuid: 'c-1', game_uuid: null }), '/channels/c-1');
  assert.equal(joinedDestination({ space_uuid: 's-1' }), '/spaces/s-1');
});

test('a game link’s button says it goes into the game', () => {
  assert.equal(joinActionLabel('join', true), 'Join the game');
  assert.equal(joinActionLabel('already_member', true), 'Open the game');
  assert.equal(joinActionLabel('sign_up', true), 'Sign in to join');
  // A removed member's game link waits for the owner, as any approval link does.
  assert.equal(joinActionLabel('request', true), 'Ask to join');
  assert.equal(joinActionLabel('join', false), 'Join');
  assert.equal(joinActionLabel('already_member', false), 'Open the space');
});

test('the join screen names the quiz and every way through lands by the one rule', () => {
  const screen = read('components', 'join', 'JoinScreen.tsx');
  assert.match(screen, /router\.push\(joinedDestination\(data\)\);/);
  assert.match(screen, /router\.replace\(joinedDestination\(\{ space_uuid: heldSpace, game_uuid: heldGame \}\)\);/);
  assert.match(screen, /router\.push\(joinedDestination\(\{ space_uuid: invite\.space_uuid, game_uuid: game\?\.uuid \?\? null \}\)\);/);
  assert.match(screen, /\{game\.quiz_title\}/);
  assert.match(screen, /\{joinActionLabel\(action, game !== null\)\}/);
});

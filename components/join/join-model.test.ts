import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isInviteCode, joinActionLabel, joinedDestination, readInviteCode } from './join-model';

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

test('the route code reads the same whether Next hands it over encoded or decoded', () => {
  const glued = 'HLUEoNpFPPtpXzcP Join my live quiz “TEST DATA — Offer & Acceptance” on Lawexa.';
  assert.equal(readInviteCode(encodeURIComponent(glued)), glued);
  assert.equal(readInviteCode('HLUEoNpFPPtpXzcP%20Join'), 'HLUEoNpFPPtpXzcP Join');
  assert.equal(readInviteCode('HLUEoNpFPPtpXzcP'), 'HLUEoNpFPPtpXzcP');
  // Not valid percent-encoding: taken as it came.
  assert.equal(readInviteCode('abc%E0%A4%A'), 'abc%E0%A4%A');
});

test('the invite API is asked for the code as one path segment', () => {
  const api = readFileSync(join(process.cwd(), 'lib', 'api', 'collab.ts'), 'utf8');
  assert.match(api, /`\/invite-links\/\$\{encodeURIComponent\(code\)\}`/);
  assert.match(api, /`\/invite-links\/\$\{encodeURIComponent\(code\)\}\/accept`/);
});

test('only a 16-character code from the server pool can be an invite; a glued link cannot', () => {
  assert.equal(isInviteCode('HLUEoNpFPPtpXzcP'), true);
  assert.equal(isInviteCode('HLUEoNpFPPtpXzcP Join my live quiz on Lawexa.'), false);
  assert.equal(isInviteCode('HLUEoNpFPPtpXzc'), false);
  // The pool leaves out 0, 1, l and O.
  assert.equal(isInviteCode('HLUEoNpFPPtpXzc0'), false);
  assert.equal(isInviteCode('HLUEoNpFPPtpXzcl'), false);
});

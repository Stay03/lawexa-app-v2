import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GAME_JOIN_REFUSALS, SPACES_QUERY_ROOT, gameJoinLands, isInviteCode, joinActionLabel, joinedDestination, readInviteCode } from './join-model';

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
  // Every way through (accepted, back from sign-in, already a member) goes into
  // the game first and lands by the one rule (`enter`, 14 November 2026).
  assert.match(screen, /enter\.mutate\(\{ \.\.\.data, play \}\);/);
  assert.match(screen, /enter\.mutate\(\{ space_uuid: heldSpace, channel_uuid: null, game_uuid: heldGame, play \}\);/);
  assert.match(screen, /enter\.mutate\(\{ space_uuid: invite\.space_uuid, channel_uuid: null, game_uuid: game\?\.uuid \?\? null, play \}\);/);
  assert.match(screen, /onSuccess: \(destination\) => router\.replace\(joinedDestination\(destination\)\),/);
  assert.match(screen, /\{game\.quiz_title\}/);
  // A game link asks Play or Watch up front (Arthur, 14 November 2026); a link
  // waiting on approval, and any other invite, keeps its one button.
  assert.match(screen, /const choosesMode = game !== null && action !== 'request';/);
  assert.match(screen, /onClick=\{\(\) => press\(true\)\}[\s\S]{0,300}Play/);
  assert.match(screen, /onClick=\{\(\) => press\(false\)\}[\s\S]{0,300}Watch/);
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

test('a code from the server pool, of a sane length, can be an invite; a glued link cannot', () => {
  assert.equal(isInviteCode('HLUEoNpFPPtpXzcP'), true);
  assert.equal(isInviteCode('HLUEoNpFPPtpXzcP Join my live quiz on Lawexa.'), false);
  // A well-formed code of another length still goes to the server (the generator may grow its codes).
  assert.equal(isInviteCode('HLUEoNpFPPtpXzc'), true);
  assert.equal(isInviteCode('HLUEoNpFPPtpXzcPq9rS'), true);
  assert.equal(isInviteCode('HLUE'), false);
  // The pool leaves out 0, 1, l and O.
  assert.equal(isInviteCode('HLUEoNpFPPtpXzc0'), false);
  assert.equal(isInviteCode('HLUEoNpFPPtpXzcl'), false);
});

test("the join reads every Space query again: its key root is v2's spacesQueries.all", () => {
  assert.deepEqual(SPACES_QUERY_ROOT, ['spaces']);
  const queries = readFileSync(join(process.cwd(), 'v2', 'features', 'spaces', 'queries.ts'), 'utf8');
  assert.match(queries, /all: \['spaces'\] as const,/);
});

test('a game link chosen to Play joins the game before it opens the lobby, on every way in', () => {
  const screen = readFileSync(join(process.cwd(), 'components', 'join', 'JoinScreen.tsx'), 'utf8');
  // Watch lands as a watcher, with the game's Join still there. Play's join lets
  // through only the game's own refusals (Techlead's review, 14 November 2026).
  assert.match(screen, /if \(destination\.game_uuid && destination\.play\) \{\s*try \{\s*await quizGamesApi\.join\(destination\.game_uuid\);\s*\} catch \(error\) \{\s*if \(!gameJoinLands\(isAxiosError\(error\) \? error\.response\?\.status : undefined\)\) throw error;/);
  assert.doesNotMatch(screen, /\.catch\(\(\) => undefined\)/);
  assert.match(screen, /await queryClient\.invalidateQueries\(\{ queryKey: SPACES_QUERY_ROOT \}\);/);
  // Join, Open the game, and the return from sign-in all go through it; the
  // fourth is the Try again after a failed game join (14 November 2026).
  assert.equal(screen.match(/enter\.mutate\(/g)?.length, 4);
  assert.doesNotMatch(screen, /router\.push\(joinedDestination/);
});

test("Play lands on the game only for the game's own refusals; any other failure is not a quiet Watch", () => {
  // ChannelQuizGameController::join: 403 late joining off, 404 gone, 409 over (finished or cancelled).
  assert.deepEqual(Object.keys(GAME_JOIN_REFUSALS).map(Number), [403, 404, 409]);
  assert.equal(gameJoinLands(403), true);
  assert.equal(gameJoinLands(404), true);
  assert.equal(gameJoinLands(409), true);
  // No network, a server error, an ended session, a throttle: stay and try again.
  for (const status of [undefined, 500, 502, 503, 401, 422, 429, 400]) assert.equal(gameJoinLands(status), false, String(status));
});

test('a failed game join stays on the join screen with a Try again that runs the game step alone', () => {
  const screen = readFileSync(join(process.cwd(), 'components', 'join', 'JoinScreen.tsx'), 'utf8');
  assert.match(screen, /\{enter\.isError && enter\.variables \? \(/);
  assert.match(screen, /We couldn&rsquo;t put you in the game/);
  // The Space join already happened: only `enter` (the game join and the landing) runs again.
  assert.match(screen, /onClick=\{\(\) => enter\.mutate\(enter\.variables\)\}>\s*Try again/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DISCOVER_QUERY_ROOT, LATE_JOIN_OFF_MESSAGE, SPACES_QUERY_ROOT, acceptedDestination, gameJoinLands, isInviteCode, joinActionLabel, joinedDestination, readInviteCode } from './join-model';

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

/* Arthur, 14 November 2026, 18:08Z: Join on LASU Law Students Space's link opened
 * /spaces/undefined. The accept answer has no `space_uuid`; the Space is in the
 * membership (Backend's read of SpaceInviteLinkService on live main). TEST DATA. */
const ACCEPTED = {
  status: 'joined' as const,
  member: { id: 7, role: 'member', is_active: true, space: { uuid: 'TEST-DATA-space-uuid', name: 'TEST DATA Law Students Space' } },
  channel_member: null,
  game_uuid: null,
};
const PREVIEW = { space_uuid: 'TEST-DATA-space-uuid', game: null };

test('an accepted invite opens the Space named in the answer, never /spaces/undefined', () => {
  const opened = acceptedDestination(PREVIEW, ACCEPTED);
  assert.ok(opened);
  assert.equal(joinedDestination(opened), '/spaces/TEST-DATA-space-uuid');
  // The answer alone is enough, and so is the preview alone.
  assert.equal(joinedDestination(acceptedDestination(null, ACCEPTED)!), '/spaces/TEST-DATA-space-uuid');
  assert.equal(joinedDestination(acceptedDestination(PREVIEW, { status: 'already_member' })!), '/spaces/TEST-DATA-space-uuid');
  // A game link: the game from the answer; a channel link: the channel from the answer.
  assert.equal(joinedDestination(acceptedDestination(PREVIEW, { ...ACCEPTED, game_uuid: 'g-1' })!), '/spaces/TEST-DATA-space-uuid?game=g-1');
  assert.equal(joinedDestination(acceptedDestination(PREVIEW, { ...ACCEPTED, channel_member: { channel: { uuid: 'c-1' }, is_active: true } })!), '/channels/c-1');
  // With neither, there is nowhere to go: the screen says it failed rather than open a broken link.
  assert.equal(acceptedDestination(null, { status: 'joined', member: null }), null);
  for (const href of [joinedDestination(opened)]) assert.doesNotMatch(href, /undefined/);
});

/* Fable's review of 10b9bb67: the preview names a channel link's channel for
 * everyone, but accept adds only Researchers and above to it. A Student who
 * accepts gets channel_member: null and must land in the Space. TEST DATA. */
test('a Student who accepts a channel link opens the Space, never the channel they were not added to', () => {
  const linkToChannel = { space_uuid: 'TEST-DATA-space-uuid', channel_uuid: 'TEST-DATA-channel-uuid', game: null };
  const student = { ...ACCEPTED, channel_member: null };
  assert.equal(joinedDestination(acceptedDestination(linkToChannel, student)!), '/spaces/TEST-DATA-space-uuid');
  // A Researcher on the same link is in the channel, and lands there.
  const researcher = { ...ACCEPTED, channel_member: { channel: { uuid: 'TEST-DATA-channel-uuid' }, is_active: true } };
  assert.equal(joinedDestination(acceptedDestination(linkToChannel, researcher)!), '/channels/TEST-DATA-channel-uuid');
  // The rule reads no channel from the preview at all.
  assert.doesNotMatch(read('components', 'join', 'join-model.ts'), /invite\?\.channel_uuid/);
});

test('the join screen opens the answer’s Space and reads the public-space list again', () => {
  const screen = read('components', 'join', 'JoinScreen.tsx');
  assert.doesNotMatch(screen, /\.\.\.data, play/);
  assert.match(screen, /const destination = acceptedDestination\(preview\.data\?\.data \?\? null, data\);\s*if \(destination\) enter\.mutate\(\{ \.\.\.destination, play \}\);/);
  assert.match(screen, /void queryClient\.invalidateQueries\(\{ queryKey: DISCOVER_QUERY_ROOT \}\);/);
  // The same key as v2's discover list.
  assert.deepEqual([...DISCOVER_QUERY_ROOT], ['discover-spaces']);
  assert.match(read('v2', 'features', 'invites', 'queries.ts'), /discover: \(params: DiscoverSpacesParams\) => \['discover-spaces', params\] as const,/);
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
  assert.match(screen, /if \(destination\) enter\.mutate\(\{ \.\.\.destination, play \}\);/);
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
  assert.match(screen, /if \(destination\.game_uuid && destination\.play\) \{\s*try \{\s*await quizGamesApi\.join\(destination\.game_uuid\);\s*\} catch \(error\) \{\s*const response = isAxiosError<\{ message\?: string \}>\(error\) \? error\.response : undefined;\s*if \(!gameJoinLands\(response\?\.status, response\?\.data\?\.message\)\) throw error;/);
  assert.doesNotMatch(screen, /\.catch\(\(\) => undefined\)/);
  assert.match(screen, /await queryClient\.invalidateQueries\(\{ queryKey: SPACES_QUERY_ROOT \}\);/);
  // Join, Open the game, and the return from sign-in all go through it; the
  // fourth is the Try again after a failed game join (14 November 2026).
  assert.equal(screen.match(/enter\.mutate\(/g)?.length, 4);
  assert.doesNotMatch(screen, /router\.push\(joinedDestination/);
});

test("Play lands on the game only for the game's own refusals; any other failure is not a quiet Watch", () => {
  // Backend's list for POST /quiz-games/{uuid}/join (14 November 2026).
  assert.equal(LATE_JOIN_OFF_MESSAGE, 'Late joining is turned off for this quiz.');
  assert.equal(gameJoinLands(403, LATE_JOIN_OFF_MESSAGE), true);
  assert.equal(gameJoinLands(404, undefined), true);
  assert.equal(gameJoinLands(409, 'This game is over.'), true);
  // The policy's 403 (not yet in the Space): the Space join did not take, so try again.
  assert.equal(gameJoinLands(403, 'This action is unauthorized.'), false);
  assert.equal(gameJoinLands(403, undefined), false);
  // No network, a server error, an ended session, a throttle: stay and try again.
  for (const status of [undefined, 500, 502, 503, 401, 422, 429, 400]) assert.equal(gameJoinLands(status, undefined), false, String(status));
});

test('a failed game join stays on the join screen with a Try again that runs the game step alone', () => {
  const screen = readFileSync(join(process.cwd(), 'components', 'join', 'JoinScreen.tsx'), 'utf8');
  assert.match(screen, /\{enter\.isError && enter\.variables \? \(/);
  assert.match(screen, /We couldn&rsquo;t put you in the game/);
  // The Space join already happened: only `enter` (the game join and the landing) runs again.
  assert.match(screen, /onClick=\{\(\) => enter\.mutate\(enter\.variables\)\}>\s*Try again/);
});

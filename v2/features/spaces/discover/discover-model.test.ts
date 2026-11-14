import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { joinOutcome } from '@/lib/utils/space-join';
import { CANCEL_FAILED, discoverAction, joinErrorCode, joinOpensSpace, joinRefusal } from './discover-model';

/* Public Spaces (Arthur's A, 12 November 2026, thread dcd06933): anyone new
 * joins a public Space at once from Discover; someone the Owner removed or
 * turned down sends a request the Owner decides on (WOZ's 324edd33). */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('a Discover card offers what the reader may do: open, join, or wait on a request', () => {
  assert.equal(discoverAction({ my_status: 'member' }), 'open');
  // Every public space is joined at once, shared or an older team space.
  assert.equal(discoverAction({ kind: 'shared', my_status: null }), 'join');
  assert.equal(discoverAction({ kind: 'team', my_status: null }), 'join');
  assert.equal(discoverAction({ my_status: null }), 'join');
  // A request the Owner has not decided on yet.
  assert.equal(discoverAction({ kind: 'shared', my_status: 'pending' }), 'pending');
  // The older is_member is read only when my_status is absent.
  assert.equal(discoverAction({ kind: 'team', is_member: true }), 'open');
  assert.equal(discoverAction({ kind: 'shared', my_status: null, is_member: true }), 'join');
});

test('a join comes to joined (201) or a request for the Owner (202, status pending)', () => {
  assert.equal(joinOutcome(201, { status: 'joined', space_uuid: 'TEST DATA' }), 'joined');
  // The /join route answers 201 with the member row.
  assert.equal(joinOutcome(201, { id: 7, role: 'member' }), 'joined');
  assert.equal(joinOutcome(202, { status: 'pending', space_uuid: 'TEST DATA' }), 'pending');
  // Asking again gives the same 202; the status alone also says it.
  assert.equal(joinOutcome(202, null), 'pending');
  assert.equal(joinOutcome(200, { status: 'pending' }), 'pending');
});

test('a joined reader goes into the Space; a request stays on the card as Request sent', () => {
  const screen = read('v2', 'features', 'spaces', 'discover', 'DiscoverScreen.tsx');
  assert.match(screen, /onSuccess: \(outcome\) => \{\s*if \(outcome === 'joined'\) router\.push\(`\/spaces\/\$\{space\.uuid\}`\);\s*\}/);
  const queries = read('v2', 'features', 'invites', 'queries.ts');
  // The list is read again either way, so a request shows "Request sent" from the server's my_status.
  assert.match(queries, /mutationFn: \(spaceUuid: string\) => discoverApi\.join\(spaceUuid\),\s*\/\/.*\s*onSettled: \(\) => \{\s*void client\.invalidateQueries\(\{ queryKey: \['discover-spaces'\] \}\);/);
  const api = read('lib', 'api', 'collab.ts');
  assert.match(api, /return joinOutcome\(response\.status, response\.data\?\.data\);/);
});

/* Arthur, 14 November 2026: Discover offered Join to a member (a list read
 * before the join), and the server's 409 "already an active member" read as a
 * failure. A 409 means they are in: the card opens the Space. */
test('a 409 on Join opens the Space, and every join answer reads the list again', () => {
  // Backend's answer: { success: false, message, errors: { code: 'already_member' } }.
  const already = { success: false, message: 'You are already an active member of this space.', errors: { code: 'already_member' } };
  assert.equal(joinOpensSpace(409, joinErrorCode(already)), true);
  for (const status of [403, 404, 500, undefined]) assert.equal(joinOpensSpace(status, 'already_member'), false, String(status));
  // Backend's membership answer: pending is `is_pending`; the Space is `space.uuid`.
  assert.equal(joinOutcome(201, { id: 7, is_active: true, is_pending: false, space: { uuid: 'TEST DATA' } }), 'joined');
  assert.equal(joinOutcome(201, { id: 7, is_active: false, is_pending: true, space: { uuid: 'TEST DATA' } }), 'pending');
  assert.match(read('lib', 'api', 'collab.ts'), /apiClient\.post<ApiResponse<SpaceJoinAnswer>>\(\s*`\/spaces\/\$\{spaceUuid\}\/join`/);
  // The list is read on every visit, so a member sees Open, not a Join that answers 409.
  assert.match(read('v2', 'features', 'invites', 'queries.ts'), /queryFn: \(\) => discoverApi\.spaces\(params\),[\s\S]{0,400}?staleTime: STALE_TIMES\.live,/);
  const screen = read('v2', 'features', 'spaces', 'discover', 'DiscoverScreen.tsx');
  assert.match(screen, /if \(joinOpensSpace\(response\?\.status, joinErrorCode\(response\?\.data\)\)\) router\.push\(`\/spaces\/\$\{space\.uuid\}`\);\s*else setRefusal\(joinRefusal\(response\?\.status, hasAccount, response\?\.data\?\.message\)\);/);
  assert.match(read('v2', 'features', 'invites', 'queries.ts'), /onSettled: \(\) => \{\s*void client\.invalidateQueries\(\{ queryKey: \['discover-spaces'\] \}\);/);
});

/* Fable's review of 10b9bb67: only the code means "already a member". A 409
 * without it (before Backend's branch is live, or a future refusal such as a
 * full Space) shows the server's message and opens nothing. TEST DATA. */
test('a 409 without the already_member code shows its message and does not open the Space', () => {
  const full = { success: false, message: 'TEST DATA. This space is full.', errors: null };
  assert.equal(joinErrorCode(full), undefined);
  assert.equal(joinOpensSpace(409, joinErrorCode(full)), false);
  assert.equal(joinOpensSpace(409, 'space_full'), false);
  assert.equal(joinRefusal(409, true, full.message).text, 'TEST DATA. This space is full.');
  assert.equal(joinRefusal(409, true, '').text, "That didn't work. Try again in a moment.");
  assert.equal(joinRefusal(409, false, full.message).offerAccount, false);
});

test('a request that could not be taken back says so', () => {
  assert.match(CANCEL_FAILED.text, /Try again/);
  assert.equal(CANCEL_FAILED.offerAccount, false);
});

/* v2 Stage 1, item 3: a failed join told a signed-in user to "Create an
 * account". Only a visitor without one, refused with the server's 403, is. */
test('only a visitor without an account, refused with a 403, is offered one', () => {
  assert.equal(joinRefusal(403, false).offerAccount, true);
  assert.equal(joinRefusal(403, true).offerAccount, false);
  assert.doesNotMatch(joinRefusal(403, true).text, /account to/);
  for (const status of [409, 404, 500, undefined]) {
    assert.equal(joinRefusal(status, false).offerAccount, false, String(status));
    assert.equal(joinRefusal(status, true).offerAccount, false, String(status));
  }
  const screen = read('v2', 'features', 'spaces', 'discover', 'DiscoverScreen.tsx');
  assert.match(screen, /const hasAccount = signedIn && role !== 'guest' && role !== 'bot';/);
  assert.match(screen, /\{refusal\.offerAccount \? \(/);
});

test('the join and the cancel go to the documented routes', () => {
  const api = read('lib', 'api', 'collab.ts');
  assert.match(api, /`\/spaces\/\$\{spaceUuid\}\/join`,\s*\{\}/);
  assert.match(api, /`\/spaces\/\$\{spaceUuid\}\/join-requests\/mine`/);
});

test('every signed-in account reaches Discover, from the spaces list, and the words match A', () => {
  const screen = read('v2', 'features', 'spaces', 'discover', 'DiscoverScreen.tsx');
  assert.doesNotMatch(screen, /canAccessTeamChannels|TeamChannelsClosedState/);
  assert.doesNotMatch(screen, /Ask to join|ask to join/);
  assert.match(screen, /Request sent/);
  assert.match(screen, /Cancel request/);
  const list = read('v2', 'features', 'spaces', 'list', 'SpacesBrowser.tsx');
  assert.match(list, /href="\/spaces\/discover"/);
  const form = read('v2', 'features', 'spaces', 'dialogs', 'SpaceFormDialog.tsx');
  assert.match(form, /description: 'Shown on Discover\. Anyone can join\.',/);
  assert.doesNotMatch(form, /People ask to join/);
});

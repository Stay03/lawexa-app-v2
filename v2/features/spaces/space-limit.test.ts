import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { spaceLimitOf } from '@/lib/utils/space-limit';
import { joinRefusal } from './discover/discover-model';

/* Organisation plans (Backend's org-plans-part9, SpaceLimitReachedException):
 * creating, joining, accepting an invite or a link, making a link and
 * inviting can be refused at a Space limit with a 403 whose errors.reason is
 * "space_limit_reached" and whose sentence names the plan and the limit. Every
 * surface says that sentence, and offers the plans. TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const SPACES = 'Your Free plan allows 3 Spaces, and you are in 3. Leave a Space or upgrade to join another.';
const body = (over: Record<string, unknown> = {}) => ({
  success: false,
  message: SPACES,
  errors: { reason: 'space_limit_reached', limit_type: 'spaces_max', limit: 3, plan: 'Free', ...over },
});

test("a Space limit is read from the server's 403, and nothing else reads as one", () => {
  assert.deepEqual(spaceLimitOf(403, body()), { message: SPACES, limitType: 'spaces_max', limit: 3, plan: 'Free' });
  assert.equal(spaceLimitOf(403, body({ limit_type: 'space_invites_max' }))?.limitType, 'space_invites_max');
  // Another 403, another status, or no sentence: not a Space limit.
  assert.equal(spaceLimitOf(403, { message: 'This action is unauthorized.' }), null);
  assert.equal(spaceLimitOf(403, body({ reason: 'not_allowed' })), null);
  assert.equal(spaceLimitOf(409, body()), null);
  assert.equal(spaceLimitOf(403, { ...body(), message: ' ' }), null);
  assert.equal(spaceLimitOf(403, null), null);
});

test("Discover's Join at a Space limit says the server's sentence, with the plans, never \"doesn't let your account join\"", () => {
  const limit = spaceLimitOf(403, body());
  assert.deepEqual(joinRefusal(403, true, SPACES, limit), { text: SPACES, offerAccount: false, offerPlans: true });
  // Any other 403 reads as before.
  assert.equal(joinRefusal(403, true, 'x', null).text, "This space doesn't let your account join.");
  const screen = read('v2', 'features', 'spaces', 'discover', 'DiscoverScreen.tsx');
  assert.match(screen, /joinRefusal\(response\?\.status, hasAccount, response\?\.data\?\.message, spaceLimitOf\(response\?\.status, response\?\.data\)\)/);
  assert.match(screen, /\{refusal\.offerPlans \? \(/);
});

test('every other surface says the sentence where the action was taken, with the plans', () => {
  const join = read('components', 'join', 'JoinScreen.tsx');
  assert.match(join, /setFailed\(limit \? limit\.message : refusalFor\(status\)\.title\);/);
  assert.match(join, /\{failedAtLimit \? \(/);
  const refusal = read('v2', 'features', 'invites', 'LinkRefusal.tsx');
  assert.match(refusal, /const limit = spaceLimitFromError\(error\);/);
  assert.match(refusal, /\{limit\.message\} <PlansLink \/>/);
  for (const panel of ['InviteLinkSection.tsx', 'InviteLinksPanel.tsx']) {
    assert.match(read('v2', 'features', 'invites', panel), /<LinkRefusal error=\{create\.error\}/);
  }
  const create = read('v2', 'features', 'spaces', 'dialogs', 'SpaceFormDialog.tsx');
  assert.match(create, /setAtLimit\(spaceLimitFromError\(failure\) !== null\);/);
  assert.match(create, /\{atLimit \? \(/);
});

test('the refusals said in place are not said again in a toast', () => {
  const queries = read('v2', 'features', 'invites', 'queries.ts');
  assert.match(queries, /inviteLinksApi\.create\(spaceUuid, payload\),[\s\S]{0,200}meta: \{ silentError: true \}/);
  assert.match(queries, /discoverApi\.join\(spaceUuid\),[\s\S]{0,400}meta: \{ silentError: true \}/);
});

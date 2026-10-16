import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { canAskToContribute } from './model';

/* Arthur's joining changes, part 2 (backend, 16 October 2026): a Viewer of a
 * shared space asks to become a Contributor; the Owner allows or declines on
 * the People tab. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('only a Viewer of a shared space may ask to contribute', () => {
  assert.equal(canAskToContribute({ kind: 'shared', my_role: 'member', my_content_role: 'viewer' }), true);
  assert.equal(canAskToContribute({ kind: 'shared', my_role: 'member', my_content_role: 'editor' }), false);
  assert.equal(canAskToContribute({ kind: 'shared', my_role: 'owner', my_content_role: 'owner' }), false);
  // A team space has no content roles to ask about.
  assert.equal(canAskToContribute({ kind: 'team', my_role: 'member', my_content_role: 'viewer' }), false);
});

test('the routes: ask, withdraw, and the Owner deciding by the member row id', () => {
  const api = read('lib', 'api', 'collab.ts');
  assert.match(api, /apiClient\.post<ApiResponse<null>>\(`\/spaces\/\$\{uuid\}\/role-requests`, \{\s*content_role: 'editor',\s*\}\)/);
  assert.match(api, /apiClient\.delete<ApiResponse<null>>\(\s*`\/spaces\/\$\{uuid\}\/role-requests\/mine`/);
  assert.match(api, /`\/space-role-requests\/\$\{memberId\}\/\$\{approve \? 'approve' : 'reject'\}`/);
  // The Owner's queue is the members list narrowed to the open asks.
  assert.match(api, /requests: params\.requests \? 1 : undefined,/);
});

test("the Viewer's control reads their own row; the Owner's list reads the asks queue", () => {
  const parts = read('v2', 'features', 'spaces', 'detail', 'people', 'RoleRequests.tsx');
  assert.match(parts, /const open = ownRow\?\.requested_content_role === 'editor';/);
  assert.match(parts, /Ask to contribute/);
  assert.match(parts, /Request sent/);
  assert.match(parts, /Withdraw request/);
  assert.match(parts, /spacesQueries\.members\(spaceUuid, \{ viewerId: session\.userId, requests: true \}\)/);
  assert.match(parts, /Wants to contribute/);
  // Failures inline, never a toast.
  assert.match(parts, /role="alert"/);
  const panel = read('v2', 'features', 'spaces', 'detail', 'people', 'SpacePeoplePanel.tsx');
  // The Owner has Invite there; a Viewer who may ask has the control instead.
  assert.match(panel, /\) : viewerMayAsk && membersQuery\.isSuccess \? \(\s*<ContributeAsk spaceUuid=\{space\.uuid\} ownRow=\{ownRow\} \/>/);
  // The asks sit above "Needs your approval", for the Owner of a shared space.
  assert.match(panel, /\{canManage && shared \? <RoleRequestsSection spaceUuid=\{space\.uuid\} \/> : null\}\s*\{canManage && waiting > 0/);
});

test('every decision on an ask refetches the roster and the queue (one key prefix)', () => {
  const mutations = read('v2', 'features', 'spaces', 'mutations.ts');
  for (const name of ['useAskToContribute', 'useWithdrawContributeRequest', 'useDecideRoleRequest']) {
    const body = mutations.slice(mutations.indexOf(`export function ${name}`));
    assert.match(body.slice(0, 700), /invalidateQueries\(\{ queryKey: spacesQueries\.membersOf\(spaceUuid\) \}\)/, name);
    assert.match(body.slice(0, 700), /meta: \{ silentError: true \}/, name);
  }
});

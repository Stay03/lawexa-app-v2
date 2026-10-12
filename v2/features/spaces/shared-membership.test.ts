import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Member, SpaceInvitation } from '@/types/collab';
import {
  contentRoleLabelOf,
  contentRoleOf,
} from '@/v2/features/collab/membership/content-role';
import {
  SHARED_INVITE_ROLES,
  TEAM_INVITE_ROLES,
} from '@/v2/features/collab/membership/invite-roles';
import { spaceInvitationRoleLabel } from '@/v2/features/invitations/row-model';
import {
  canManageMembership,
  contentRoleChangePayload,
  inviteLinkPayload,
  inviteRoleOptions,
  invitePayload,
  isLastOwnerLeaveError,
  isLastSharedOwner,
  isMembershipOwner,
} from './model';

/* Spaces F7 (12 October 2026; backend B2): a SHARED space's members are Owner,
 * Contributor and Viewer, and only the content Owner manages them. A team space
 * keeps today's owner, admin and member rules exactly. Pure rules first, then
 * the wiring pinned by source. */

const member = (
  uuid: string,
  role: Member['role'],
  extra: Partial<Member> = {},
): Member => ({
  id: 1,
  user: { uuid, name: uuid, username: null, avatar_url: null },
  role,
  role_label: role,
  is_active: true,
  is_pending: false,
  accepted_at: null,
  joined_at: null,
  left_at: null,
  created_at: '2026-10-12T00:00:00Z',
  ...extra,
});

test('a shared space is managed by its content Owner only; a team space by owner or admin', () => {
  // Shared: the content role decides, whatever the old role says.
  assert.equal(canManageMembership({ kind: 'shared', my_role: 'member', my_content_role: 'owner' }), true);
  assert.equal(canManageMembership({ kind: 'shared', my_role: 'admin', my_content_role: 'editor' }), false);
  assert.equal(canManageMembership({ kind: 'shared', my_role: 'owner', my_content_role: 'viewer' }), false);
  assert.equal(canManageMembership({ kind: 'shared', my_role: 'owner', my_content_role: null }), false);
  // Team (and an absent kind): today's rule, exactly.
  for (const kind of ['team', undefined] as const) {
    assert.equal(canManageMembership({ kind, my_role: 'owner', my_content_role: null }), true);
    assert.equal(canManageMembership({ kind, my_role: 'admin', my_content_role: 'viewer' }), true);
    assert.equal(canManageMembership({ kind, my_role: 'member', my_content_role: 'owner' }), false);
  }
  assert.equal(isMembershipOwner({ kind: 'shared', my_role: 'member', my_content_role: 'owner' }), true);
  assert.equal(isMembershipOwner({ kind: 'team', my_role: 'admin', my_content_role: 'owner' }), false);
});

test('role options: Viewer and Contributor on a shared space, Member and Admin on a team space', () => {
  assert.deepEqual(inviteRoleOptions('shared').map((option) => option.value), ['viewer', 'editor']);
  assert.deepEqual(inviteRoleOptions('team').map((option) => option.value), ['member', 'admin']);
  assert.equal(inviteRoleOptions('shared'), SHARED_INVITE_ROLES);
  assert.equal(inviteRoleOptions('team'), TEAM_INVITE_ROLES);
  // Owner rule: no dashes in UI copy.
  for (const option of [...SHARED_INVITE_ROLES, ...TEAM_INVITE_ROLES]) {
    assert.doesNotMatch(option.label, /[—–]/, option.label);
  }
});

test('content_role travels only on a shared space; a role from the other kind is refused', () => {
  assert.deepEqual(invitePayload('shared', { email: 'a@b.c' }, 'editor'), {
    email: 'a@b.c',
    role: 'member',
    content_role: 'editor',
  });
  assert.deepEqual(invitePayload('team', { email: 'a@b.c' }, 'admin'), {
    email: 'a@b.c',
    role: 'admin',
  });
  assert.equal(invitePayload('shared', { email: 'a@b.c' }, 'admin'), null);
  assert.equal(invitePayload('team', { email: 'a@b.c' }, 'viewer'), null);
  assert.deepEqual(contentRoleChangePayload('viewer'), { content_role: 'viewer' });
});

test('a space invite names its invitee by exactly one key, email or username', () => {
  // Backend 6d11c84: two identifiers or none is a 422, on both kinds of space.
  assert.deepEqual(invitePayload('shared', { username: 'ada_obi' }, 'viewer'), {
    username: 'ada_obi',
    role: 'member',
    content_role: 'viewer',
  });
  assert.deepEqual(invitePayload('team', { username: 'ada_obi' }, 'member'), {
    username: 'ada_obi',
    role: 'member',
  });
  for (const kind of ['shared', 'team'] as const) {
    const role = kind === 'shared' ? 'editor' : 'admin';
    for (const invitee of [{ email: 'a@b.c' }, { username: 'ada_obi' }]) {
      const payload = invitePayload(kind, invitee, role);
      assert.ok(payload);
      const keys = ['email', 'username', 'user_uuid'].filter((key) => key in payload);
      assert.deepEqual(keys, Object.keys(invitee), `${kind} ${keys.join(',')}`);
    }
  }
  // Only the identifier is copied, so a stray field cannot ride along.
  const stray = { email: 'a@b.c', username: 'ada_obi' };
  assert.deepEqual(invitePayload('team', stray, 'member'), { email: 'a@b.c', role: 'member' });
});

test('a shared invite link names its role and never a channel', () => {
  const shared = inviteLinkPayload('shared', {
    requiresApproval: true,
    channelUuid: 'channel-1',
    contentRole: 'editor',
  });
  assert.deepEqual(shared, { requires_approval: true, content_role: 'editor' });
  assert.equal('channel_uuid' in shared, false);
  assert.deepEqual(inviteLinkPayload('shared', { requiresApproval: false }), {
    requires_approval: false,
    content_role: 'viewer',
  });
  const team = inviteLinkPayload('team', { requiresApproval: true, channelUuid: 'channel-1' });
  assert.deepEqual(team, { requires_approval: true, channel_uuid: 'channel-1' });
  assert.equal('content_role' in team, false);
});

test('the last Owner of a shared space is refused before the request; team spaces are not', () => {
  const alone = [member('me', 'owner', { content_role: 'owner' }), member('b', 'member', { content_role: 'editor' })];
  assert.equal(isLastSharedOwner({ kind: 'shared' }, alone, 'me'), true);
  const two = [...alone, member('c', 'member', { content_role: 'owner' })];
  assert.equal(isLastSharedOwner({ kind: 'shared' }, two, 'me'), false);
  // An Owner who has left does not count.
  const leftOwner = [...alone, member('d', 'member', { content_role: 'owner', is_active: false })];
  assert.equal(isLastSharedOwner({ kind: 'shared' }, leftOwner, 'me'), true);
  assert.equal(isLastSharedOwner({ kind: 'shared' }, alone, 'b'), false);
  assert.equal(isLastSharedOwner({ kind: 'team' }, alone, 'me'), false);
  assert.equal(isLastSharedOwner({}, alone, 'me'), false);
  assert.equal(isLastOwnerLeaveError(409), true);
  assert.equal(isLastOwnerLeaveError(400), false);
});

test('content roles before B2 are derived as the backend does; labels prefer the server', () => {
  assert.equal(contentRoleOf(member('a', 'owner')), 'owner');
  assert.equal(contentRoleOf(member('a', 'admin')), 'editor');
  assert.equal(contentRoleOf(member('a', 'member')), 'editor');
  assert.equal(contentRoleOf(member('a', 'member', { content_role: 'viewer' })), 'viewer');
  assert.equal(contentRoleLabelOf(member('a', 'member', { content_role: 'viewer' })), 'Viewer');
  assert.equal(
    contentRoleLabelOf(member('a', 'member', { content_role: 'viewer', content_role_label: 'Lecteur' })),
    'Lecteur',
  );
});

test('the inbox shows the content role for a shared space and the old role for a team space', () => {
  const invitation = (kind: 'team' | 'shared' | undefined): SpaceInvitation => ({
    id: 1,
    space: { uuid: 's', name: 'S', type: 'work', description: null, kind },
    role: 'member',
    role_label: 'Member',
    content_role: 'editor',
    content_role_label: 'Contributor',
    invited_by: null,
    created_at: '2026-10-12T00:00:00Z',
  });
  assert.equal(spaceInvitationRoleLabel(invitation('shared')), 'Contributor');
  assert.equal(spaceInvitationRoleLabel(invitation('team')), 'Member');
  assert.equal(spaceInvitationRoleLabel(invitation(undefined)), 'Member');
});

/* ── The wiring, pinned by source ─────────────────────────────────────────── */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('the members sheet reads content roles on a shared space and keeps team rules', () => {
  const sheet = read('v2', 'features', 'spaces', 'detail', 'SpaceMembersSheet.tsx');
  assert.match(sheet, /const isOwner = isMembershipOwner\(membership\);/);
  assert.match(sheet, /const canManage = canManageMembership\(membership\);/);
  assert.match(sheet, /const payload = invitePayload\(kind, invitee, role\);/);
  assert.match(sheet, /identifier="email-or-username"/);
  assert.match(sheet, /roles=\{inviteRoles\}/);
  assert.match(sheet, /linkScope=\{\{ spaceUuid: space\.uuid, contentRoles: shared \}\}/);
  assert.match(sheet, /contentRoles=\{shared\}/);
  assert.match(sheet, /canManage && !shared\s*\?\s*\(target\) =>\s*updateRole\.mutate\(\{\s*userUuid: target\.user\.uuid,\s*payload: \{ role: 'admin' \}/);
  assert.match(sheet, /canManage && shared\s*\?\s*\(target, next\) =>\s*updateRole\.mutate\(\{\s*userUuid: target\.user\.uuid,\s*payload: contentRoleChangePayload\(next\)/);
  // The last Owner's way out is decided before the request (design round 1,
  // was a refusal before the request): the route is read off the roster, and
  // a 409 (or a team owner's 400) still lands in the same designed state.
  assert.match(
    sheet,
    /: spaceLeaveRoute\(space, members, viewerUuid, membersQuery\.isSuccess\);/,
  );
  assert.match(
    sheet,
    /\(shared && isLastOwnerLeaveError\(apiError\.status\)\) \|\|\s*isOwnerMustTransferError\(apiError\.status\)[\s\S]*?setLeaveRefused\(true\);/,
  );
  // The designed message names the way forward, once (backend B2).
  assert.match(sheet, /Choose a new owner first/);
  assert.match(sheet, /Make another member the owner, then you can leave\./);
  assert.doesNotMatch(sheet, /Got it/);
  // What the sheet promises on a shared space.
  assert.match(sheet, /and you become a Contributor\./);
  assert.match(sheet, /The conversations, folders and files you added stay in it for the other members\./);
});

test('the frame governs a shared space by its content role', () => {
  const frame = read('v2', 'features', 'collab', 'shell', 'CollabFrame.tsx');
  assert.match(frame, /const canManage = canManageMembership\(membership\);/);
  assert.match(frame, /const isOwner = isMembershipOwner\(membership\);/);
});

test('links and the waiting list speak content roles on a shared space, never a channel', () => {
  const section = read('v2', 'features', 'invites', 'InviteLinkSection.tsx');
  assert.match(section, /inviteLinkPayload\(contentRole \? 'shared' : 'team', \{/);
  assert.match(section, /contentRole === undefined \|\| link\.content_role === contentRole/);
  const panel = read('v2', 'features', 'invites', 'InviteLinksPanel.tsx');
  assert.match(panel, /inviteLinkPayload\(contentRoles \? 'shared' : 'team', \{/);
  assert.doesNotMatch(panel, /channel_uuid/);
  // Both panels are steps of the members sheet since design round 1 (they
  // were two sheets on the space page, each passed `isSharedSpace(space)`).
  const sheet = read('v2', 'features', 'spaces', 'detail', 'SpaceMembersSheet.tsx');
  assert.match(sheet, /<InviteLinksPanel spaceUuid=\{space\.uuid\} contentRoles=\{shared\} \/>/);
  assert.match(sheet, /<SpaceJoinRequestsPanel spaceUuid=\{space\.uuid\} contentRoles=\{shared\} \/>/);
  const requests = read('v2', 'features', 'invites', 'JoinRequestsPanel.tsx');
  assert.match(requests, /const joinsAs = contentRoles \? request\.content_role_label\?\.trim\(\) : undefined;/);
  const dialog = read('v2', 'features', 'collab', 'membership', 'InvitePeopleDialog.tsx');
  assert.doesNotMatch(dialog, /[—–]\s*can invite/);
  // The list is drawn by the shared RoleSelect since design round 1.
  assert.match(dialog, /<RoleSelect id="invite-role" value=\{role\} roles=\{roles\} onChange=\{setRole\} \/>/);
  const select = read('v2', 'features', 'collab', 'membership', 'RoleSelect.tsx');
  assert.match(select, /roles\.map\(\(option\) =>/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Member } from '@/types/collab';
import { SHARED_INVITE_ROLES, TEAM_INVITE_ROLES } from '@/v2/features/collab/membership/invite-roles';
import { approvalLabel } from '@/v2/features/invites/link-model';
import { isNavItemActive } from '@/v2/shell/nav.config';
import { movePickerCutLine, offersRemoveFromSpace } from './content-model';
import {
  MEMBERS_SHEET_PARAM,
  othersInSpace,
  parseMembersSheetView,
  rosterCountLabel,
  showsPrivateMark,
  spaceKindMark,
  spaceLeaveRoute,
  spaceHeaderFacts,
  spaceMenuItems,
  spaceOwnerLabel,
  spacePrincipleLine,
  spaceRoleLabel,
  splitRoster,
} from './model';

/* Spaces design round 1 (12 October 2026): the fixes to the round 0
 * critique, and the techlead's three decisions on F3. Pure rules first, then
 * the wiring, pinned by source. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

function member(
  uuid: string,
  overrides: Partial<Pick<Member, 'role' | 'content_role' | 'is_active' | 'is_pending'>> = {},
): Member {
  return {
    id: uuid.length,
    user: { uuid, name: uuid, username: null, avatar_url: null } as unknown as Member['user'],
    role: 'member',
    role_label: 'Member',
    is_active: true,
    is_pending: false,
    accepted_at: null,
    joined_at: null,
    left_at: null,
    created_at: '2026-10-12T00:00:00Z',
    ...overrides,
  };
}

/* ── Who you are in a space (critique 1) ─────────────────────────────────── */

test('the role line says who you are, by content role on a shared space', () => {
  const shared = (my_content_role: 'owner' | 'editor' | 'viewer' | null) =>
    spaceRoleLabel({ kind: 'shared', my_role: 'member', my_content_role });
  assert.equal(shared('owner'), 'You’re the owner');
  assert.equal(shared('editor'), 'You’re a contributor');
  assert.equal(shared('viewer'), 'You’re a viewer');
  assert.equal(shared(null), null);
});

test('a team space speaks the content roles too (design round 2, NICE 3)', () => {
  // The server's content role leads, whatever the old role says.
  assert.equal(
    spaceRoleLabel({ kind: 'team', my_role: 'member', my_content_role: 'editor' }),
    'You’re a contributor',
  );
  assert.equal(
    spaceRoleLabel({ kind: 'team', my_role: 'owner', my_content_role: 'owner' }),
    'You’re the owner',
  );
  // An absent kind is a team space (every space before B1).
  assert.equal(spaceRoleLabel({ my_role: 'owner', my_content_role: null }), 'You’re the owner');
});

test('the space header prints the type and privacy, not the role (Arthur, 15 October 2026)', () => {
  assert.deepEqual(
    spaceHeaderFacts({ type_label: 'Study', kind: 'shared', is_private: true }),
    ['Study', 'Private'],
  );
  assert.deepEqual(
    spaceHeaderFacts({ type_label: 'Work', kind: 'team', is_private: false }),
    ['Work', 'Public'],
  );
  // A public shared space (15 October 2026) says so.
  assert.deepEqual(
    spaceHeaderFacts({ type_label: 'Work', kind: 'shared', is_private: false }),
    ['Work', 'Public'],
  );
  // The spaces list row was redrawn as a chat-list row (Stay, 15 October 2026);
  // spaces-list-rows.test.ts pins it now.
  const row = read('v2', 'features', 'spaces', 'list', 'SpaceRow.tsx');
  assert.doesNotMatch(row, /spaceRoleLabel/);
  const header = read('v2', 'features', 'spaces', 'detail', 'SpacePlaceHeader.tsx');
  // The name first, the line under it, ending with the members count (B4).
  assert.match(
    header,
    /<MetaLine\s+as="span"\s+className="text-sm"\s+lead=\{spaceHeaderFacts\(space\)\}\s+trail=\{\[spaceMembersLabel\(space\.active_members_count\)\]\}\s*\/>/,
  );
  assert.ok(
    header.indexOf('<SpaceHeading name={space.name}') < header.indexOf('{facts}'),
    'the name before the line',
  );
  assert.doesNotMatch(header, /spaceRoleLabel|spaceOwnerLabel/);
  const frame = read('v2', 'features', 'spaces', 'detail', 'states.tsx');
  assert.match(
    frame,
    /<MetaLine\s+className="mt-0\.5 text-sm"\s+lead=\{identity\.facts\}\s+trail=\{\[spaceMembersLabel\(identity\.membersCount\)\]\}\s*\/>/,
  );
});

/* ── Stay's two lines, on every shared space (critique 3) ────────────────── */

test('Stay’s lines read true for each role, and a team space has none', () => {
  const line = (my_content_role: 'owner' | 'editor' | 'viewer' | null) =>
    spacePrincipleLine({ kind: 'shared', my_content_role });
  const members =
    'Members can add to this space. What’s here is organised for the whole team.';
  assert.equal(line('owner'), members);
  assert.equal(line('editor'), members);
  assert.equal(
    line('viewer'),
    'Contributors and the owner add to this space. What’s here is organised for the whole team.',
  );
  assert.equal(spacePrincipleLine({ kind: 'team', my_content_role: 'owner' }), null);
  assert.doesNotMatch(line('viewer') ?? '', /Lawexa/);
});

test('the lines are drawn whether or not the space holds anything: in the details sheet the name opens', () => {
  // Since Stay's 15 October 2026 note the top is one row; the description and
  // the lines live in the sheet, and the name opens it when there is any.
  const sheet = read('v2', 'features', 'spaces', 'detail', 'SpaceAboutSheet.tsx');
  assert.match(sheet, /<SpaceAbout\s+description=\{space\.description\}\s+principle=\{spacePrincipleLine\(\{/);
  const header = read('v2', 'features', 'spaces', 'detail', 'SpacePlaceHeader.tsx');
  assert.match(header, /onOpenAbout=\{hasAbout \? onOpenAbout : undefined\}/);
  assert.doesNotMatch(header, /<SpaceAbout\s/);
});

/* ── "Personal" and the lock say nothing (critiques 4 and 10) ────────────── */

test('a space with no organisation has no owner label', () => {
  assert.equal(spaceOwnerLabel({ organization: null }), null);
  assert.equal(
    spaceOwnerLabel({ organization: { uuid: 'o', name: 'Acme Chambers', type: 'law_firm' } as never }),
    'Acme Chambers',
  );
  const about = read('v2', 'features', 'spaces', 'detail', 'SpaceLobbyBlocks.tsx');
  assert.match(about, /\{space\.organization \? \(\s*<LobbyFact term="Belongs to">/);
  assert.doesNotMatch(about, /term="Owner"/);
});

test('the lock shows only where it can differ: a private team space', () => {
  assert.equal(showsPrivateMark({ kind: 'shared', is_private: true }), false);
  assert.equal(showsPrivateMark({ kind: 'team', is_private: true }), true);
  assert.equal(showsPrivateMark({ kind: 'team', is_private: false }), false);
  assert.equal(showsPrivateMark({ is_private: true }), true);
  // The list row now always says Private or Public, as an icon (spaceIsPrivate).
  assert.match(read('v2', 'features', 'spaces', 'list', 'SpaceRow.tsx'), /const isPrivate = spaceIsPrivate\(space\);/);
  // The space header says Private or Public in words, so it has no lock
  // (Arthur, 15 October 2026).
  assert.doesNotMatch(
    read('v2', 'features', 'spaces', 'detail', 'SpacePlaceHeader.tsx'),
    /privateMark|<Lock/,
  );
});

/* ── The approved menu (critique 2) ──────────────────────────────────────── */

test('the menu: Members and Leave for everyone, Rename and the link steps for the Owner, Delete for the Owner', () => {
  assert.deepEqual(spaceMenuItems({ canManage: false, isOwner: false, leaveRoute: 'leave' }), [
    'members',
    'leave',
  ]);
  assert.deepEqual(spaceMenuItems({ canManage: true, isOwner: true, leaveRoute: 'leave' }), [
    'members',
    'invite-links',
    'waiting',
    'rename',
    'leave',
    'delete',
  ]);
  // A team space's admin manages but does not own.
  assert.deepEqual(spaceMenuItems({ canManage: true, isOwner: false, leaveRoute: 'leave' }), [
    'members',
    'invite-links',
    'waiting',
    'rename',
    'leave',
  ]);
  // The last Owner alone is never offered a Leave that can only be refused.
  assert.deepEqual(
    spaceMenuItems({ canManage: true, isOwner: true, leaveRoute: 'delete-instead' }),
    ['members', 'invite-links', 'waiting', 'rename', 'delete'],
  );
  // The last Owner with others keeps Leave, which asks for a new owner.
  assert.ok(
    spaceMenuItems({ canManage: true, isOwner: true, leaveRoute: 'choose-new-owner' }).includes('leave'),
  );
});

test('the page publishes the menu from the one rule and opens the frame’s dialogs', () => {
  const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
  assert.match(screen, /spaceMenuItems\(\{ canManage, isOwner, leaveRoute \}\)\.map\(\(item\) => verbs\[item\]\)/);
  assert.match(screen, /label: 'Members', icon: Users, onSelect: openRoster/);
  // Design round 2: the row asks for the rule above it. 16 October 2026: it
  // is "Edit space", the whole form (was 'Rename' with `openRename`).
  assert.match(screen, /label: 'Edit space',\s*icon: Pencil,\s*separatorBefore: true,\s*onSelect: openEdit/);
  assert.match(screen, /label: 'Leave space',\s*icon: LogOut,\s*destructive: true,\s*onSelect: openLeave/);
  assert.doesNotMatch(screen, /if \(!canManage\) return NO_SCREEN_ACTIONS;/);
  // "Edit space" came back on 16 October 2026 as the edit row's label
  // (techlead); the other two stay retired.
  assert.doesNotMatch(screen, /Invite by link|You decide who actually gets in/);
  const frame = read('v2', 'features', 'collab', 'shell', 'CollabFrame.tsx');
  // Design round 2: the key carries a prefix, apart from the sheet's (was
  // `key={space.uuid}`, the same key as its sibling).
  assert.match(frame, /<DeleteSpaceDialog\s+key=\{`delete-\$\{space\.uuid\}`\}/);
  assert.match(frame, /leaveOpen=\{leaveOpen\}\s*onLeaveOpenChange=\{setLeaveOpen\}\s*onDeleteSpace=\{openDelete\}/);
  // The Owner steps of the sheet are gated like the create param.
  assert.match(frame, /\{ links: canManage, requests: canManage, invite: canManage \}/);
  const dialog = read('v2', 'features', 'spaces', 'dialogs', 'SpaceFormDialog.tsx');
  assert.match(dialog, /title=\{isEdit \? 'Edit space' : 'Create a Space'\}/);
});

test('the members sheet steps round-trip through ?roster=', () => {
  for (const view of ['members', 'links', 'requests', 'invite'] as const) {
    assert.equal(parseMembersSheetView(MEMBERS_SHEET_PARAM[view]), view);
  }
  assert.equal(MEMBERS_SHEET_PARAM.members, '1');
  assert.equal(parseMembersSheetView(null), 'members');
  assert.equal(parseMembersSheetView('edit'), 'members');
});

/* ── Leaving never ends in a dead end (critique 11) ──────────────────────── */

test('what Leave leads to, for the last Owner and for everyone else', () => {
  const owner = member('me', { role: 'owner', content_role: 'owner' });
  const other = member('them', { content_role: 'editor' });
  const invitee = member('invited', { content_role: 'viewer', is_active: false, is_pending: true });
  const shared = { kind: 'shared' as const };
  assert.equal(spaceLeaveRoute(shared, [owner, other], 'me', true), 'choose-new-owner');
  assert.equal(spaceLeaveRoute(shared, [owner, invitee], 'me', true), 'delete-instead');
  assert.equal(spaceLeaveRoute(shared, [owner], 'me', true), 'delete-instead');
  // Unknown until the roster lands: the server's 409 is read instead.
  assert.equal(spaceLeaveRoute(shared, [owner], 'me', false), 'leave');
  // Not the last Owner, or not a shared space: the plain confirmation.
  assert.equal(spaceLeaveRoute(shared, [owner, other], 'them', true), 'leave');
  assert.equal(spaceLeaveRoute({ kind: 'team' }, [owner], 'me', true), 'leave');
  // The people a sole Owner can hand the space to: joined, active, not them.
  assert.deepEqual(othersInSpace([owner, other, invitee], 'me').map((m) => m.user.uuid), ['them']);
});

test('the sheet offers Delete in Leave’s place, and the hand-over step, in one contraction style', () => {
  const sheet = read('v2', 'features', 'spaces', 'detail', 'SpaceMembersSheet.tsx');
  assert.match(sheet, /inStep \? undefined : leaveRoute === 'delete-instead' \? \(/);
  assert.match(sheet, /Choose new owner/);
  assert.match(sheet, /Choose the new owner/);
  assert.match(sheet, /You’re the only owner of \$\{space\.name\}\. Make another member the owner, then you can leave\./);
  assert.doesNotMatch(sheet, /You are the only owner|Transfer ownership first/);
  // A transfer started from Leave asks the leave question again.
  assert.match(sheet, /if \(leaveAfterTransfer\) \{[\s\S]*?onLeaveOpenChange\(true\);/);
});

/* ── The members count matches the rows (critique 7) ─────────────────────── */

test('the members sheet counts the people in and the people invited apart', () => {
  const roster = [
    member('a', { content_role: 'owner' }),
    member('b'),
    member('c'),
    member('d'),
    member('e', { is_active: false, is_pending: true }),
  ];
  const { joined, invited } = splitRoster(roster);
  assert.equal(joined.length, 4);
  assert.equal(invited.length, 1);
  // Renamed 15 October 2026 (Stay): "invited" became "invite sent".
  assert.equal(rosterCountLabel(joined.length, invited.length), '4 members · 1 invite sent');
  assert.equal(rosterCountLabel(1, 0), '1 member');
  assert.equal(rosterCountLabel(3, 2), '3 members · 2 invites sent');
  const sheet = read('v2', 'features', 'spaces', 'detail', 'SpaceMembersSheet.tsx');
  assert.match(sheet, /rosterCountLabel\(joined\.length, invited\.length\)/);
  assert.match(sheet, />\s*Invite sent\s*</);
  const row = read('v2', 'features', 'collab', 'membership', 'RosterRow.tsx');
  assert.match(row, /\{member\.is_pending \? 'Cancel invitation' : 'Remove'\}/);
  // The faces left the header for the People tab (Stay, 15 October 2026),
  // which counts the people in and the invited apart the same way.
  const header = read('v2', 'features', 'spaces', 'detail', 'SpacePlaceHeader.tsx');
  assert.doesNotMatch(header, /PresenceStack/);
  const people = read('v2', 'features', 'spaces', 'detail', 'people', 'SpacePeoplePanel.tsx');
  assert.match(people, /rosterCountLabel\(joined\.length, invited\.length\)/);
});

/* ── Move to space: kinds, search, no silent cut (techlead 1 and 2) ──────── */

test('the picker names each space’s kind, and "Team" only for a viewer with Team Channels', () => {
  assert.equal(spaceKindMark({ kind: 'shared' }, false), 'Shared');
  assert.equal(spaceKindMark({ kind: 'shared' }, true), 'Shared');
  assert.equal(spaceKindMark({ kind: 'team' }, true), 'Team');
  assert.equal(spaceKindMark({ kind: 'team' }, false), null);
  assert.equal(spaceKindMark({}, true), null);
});

test('the picker says when the server holds more than the page it sent', () => {
  assert.equal(movePickerCutLine(30, { rows: 30, total: 42 }), 'Showing 30. Search to find more.');
  assert.equal(movePickerCutLine(22, { rows: 30, total: 42 }), 'Showing 22. Search to find more.');
  assert.equal(movePickerCutLine(12, { rows: 12, total: 12 }), null);
  assert.equal(movePickerCutLine(0, null), null);
});

test('the picker searches on the server, keeps team spaces and prints the cut line', () => {
  const dialog = read('v2', 'features', 'spaces', 'move', 'MoveToSpaceDialog.tsx');
  assert.match(dialog, /\.\.\.\(search\.term \? \{ search: search\.term \} : SPACES_BASELINE_PARAMS\),/);
  assert.match(dialog, /placeholderData: keepPreviousData,/);
  assert.match(dialog, /<SearchField[\s\S]*?label="Search your spaces"/);
  assert.match(dialog, /const kind = spaceKindMark\(space, teamChannelsOpen\);/);
  assert.match(dialog, /\{cutLine \? \(\s*<p className="-mt-3 text-xs text-muted-foreground">\{cutLine\}<\/p>/);
  assert.match(dialog, /rows && pagination \? \{ rows: rows\.length, total: pagination\.total \} : null,/);
  // The list API sends the search term the picker passes.
  const api = read('lib', 'api', 'collab.ts');
  assert.match(api, /'\/spaces', \{\s*params: \{\s*search: params\.search \|\| undefined,/);
});

/* ── The folder page reads its space (techlead 3) ────────────────────────── */

test('Remove from space is offered only for an item that names its space', () => {
  assert.equal(offersRemoveFromSpace({ space: { uuid: 's', name: 'S' } }), true);
  assert.equal(offersRemoveFromSpace({ space: null }), false);
  assert.equal(offersRemoveFromSpace({}), false);
  const folder = read('v2', 'features', 'folders', 'detail', 'FolderScreen.tsx');
  assert.match(folder, /space: folder\.space \?\? null,/);
  const types = read('v2', 'features', 'folders', 'types.ts');
  assert.match(types, /space\?: \{ uuid: string; name: string \} \| null;/);
});

/* ── Copy (critiques 11, 16, 21) ─────────────────────────────────────────── */

test('a link says what it does, literally, with the role it gives', () => {
  assert.equal(
    approvalLabel({ requires_approval: true }),
    'People who use this link join after you approve them.',
  );
  assert.equal(
    approvalLabel({ requires_approval: false }),
    'Anyone with this link joins without your approval.',
  );
  assert.equal(
    approvalLabel({ requires_approval: false }, 'Viewer'),
    'Anyone with this link joins as Viewer without your approval.',
  );
  assert.equal(
    approvalLabel({ requires_approval: true }, 'Contributor'),
    'People who use this link join as Contributor after you approve them.',
  );
  for (const parts of [
    ['v2', 'features', 'invites', 'link-model.ts'],
    ['v2', 'features', 'invites', 'InviteLinksPanel.tsx'],
    ['v2', 'features', 'invites', 'InviteLinkSection.tsx'],
    ['v2', 'features', 'spaces', 'detail', 'SpaceMembersSheet.tsx'],
  ]) {
    // UI strings only: the comments may quote what was wrong.
    for (const literal of read(...parts).match(/(['`])(?:(?!\1)[^\\\n])*\1/g) ?? []) {
      assert.doesNotMatch(literal, /straight in|actually gets in/, `${parts.join('/')}: ${literal}`);
    }
  }
});

test('both places show a link as its full address with Copy beside it', () => {
  const panel = read('v2', 'features', 'invites', 'InviteLinksPanel.tsx');
  assert.match(panel, /<InviteLinkField code=\{link\.code\} dead=\{dead\} \/>/);
  assert.doesNotMatch(panel, /\/join\/\{link\.code\}/);
  const section = read('v2', 'features', 'invites', 'InviteLinkSection.tsx');
  assert.match(section, /<InviteLinkField code=\{link\.code\} \/>/);
  const link = read('v2', 'features', 'invites', 'link.tsx');
  assert.match(link, /value=\{inviteUrl\(code\)\}/);
  assert.match(link, /<CopyLinkButton code=\{code\} variant="outline" size="default"/);
});

test('a role is a name in the closed select and a meaning in the open list', () => {
  assert.deepEqual(
    SHARED_INVITE_ROLES.map((option) => [option.label, option.description]),
    [
      ['Viewer', 'Can read everything in the space'],
      ['Contributor', 'Can also add to the space and continue its conversations'],
    ],
  );
  assert.deepEqual(TEAM_INVITE_ROLES.map((option) => option.label), ['Member', 'Admin']);
  // No dashes anywhere, and no comma in a name: a comma there meant the meaning
  // was riding in the label again. A meaning may list things.
  for (const option of [...SHARED_INVITE_ROLES, ...TEAM_INVITE_ROLES]) {
    assert.doesNotMatch(option.label, /[—–,]/, option.label);
    assert.doesNotMatch(option.description ?? '', /[—–]/, option.label);
  }
  const select = read('v2', 'features', 'collab', 'membership', 'RoleSelect.tsx');
  assert.match(select, /<SelectValue>\{current\?\.label\}<\/SelectValue>/);
});

/* ── Layout and chrome (critiques 5, 6, 12, 13, 14, 15, 17, 18, 19) ──────── */

test('the crest’s corner mark sits on the corner, off the letters', () => {
  const crest = read('v2', 'features', 'collab', 'kit', 'Crest.tsx');
  assert.match(crest, /mark: 'size-3\.5 -bottom-1 -right-1',/);
  assert.match(crest, /mark: 'size-\[18px\] -bottom-1 -right-1',/);
  assert.match(crest, /rounded-full bg-background text-muted-foreground ring-2 ring-background/);
});

test('the space name is a visible heading at every width, and the bar steps back while it shows', () => {
  const header = read('v2', 'features', 'spaces', 'detail', 'SpacePlaceHeader.tsx');
  assert.match(header, /<span className="line-clamp-2 min-w-0 break-words"/);
  assert.doesNotMatch(header, /sr-only md:not-sr-only/);
  assert.match(header, /setSpaceTitleOnScreen\(entry\.isIntersecting\)/);
  const slot = read('v2', 'features', 'collab', 'shell', 'CollabHeaderSlot.tsx');
  assert.match(slot, /const stepBack = channelName === null && titleOnScreen;/);
});

test('every space takes the list’s column, in the page and its silhouette (B4)', () => {
  const parts = read('v2', 'features', 'spaces', 'detail', 'lobby-parts.tsx');
  assert.match(parts, /export const SPACE_PAGE_COLUMN =\s*'mx-auto flex min-h-full w-full max-w-3xl flex-col/);
  assert.doesNotMatch(parts, /max-w-5xl/);
  const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
  assert.equal(screen.match(/<div className=\{SPACE_PAGE_COLUMN\}>/g)?.length, 2, 'the home and its refusals');
  const states = read('v2', 'features', 'spaces', 'detail', 'states.tsx');
  assert.match(states, /<div className=\{SPACE_PAGE_COLUMN\}>/);
});

test('one identity on a team space, and "New channel" only in the rail', () => {
  const rail = read('v2', 'features', 'collab', 'shell', 'SpaceRail.tsx');
  assert.doesNotMatch(rail, /PresenceStack|spaceOwnerLabel/);
  // The Channels tab and its phone "New channel" went with design B4.
  const header = read('v2', 'features', 'spaces', 'detail', 'SpacePlaceHeader.tsx');
  assert.doesNotMatch(header, /New channel/);
  const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
  assert.doesNotMatch(screen, /openCreateChannel/);
});

test('sheets draw no focus outline round the whole panel; collab dialogs get a dark edge', () => {
  const sheet = read('components', 'ui', 'sheet.tsx');
  assert.match(sheet, /data-\[side=right\]:sm:max-w-sm outline-none"/);
  const surface = read('v2', 'features', 'collab', 'kit', 'dialog-surface.ts');
  assert.match(surface, /'dark:bg-card dark:ring-foreground\/10'/);
  for (const parts of [
    ['v2', 'features', 'spaces', 'detail', 'SpaceMembersSheet.tsx'],
    ['v2', 'features', 'spaces', 'detail', 'DeleteSpaceDialog.tsx'],
    ['v2', 'features', 'spaces', 'detail', 'content', 'RemoveFromSpaceDialog.tsx'],
  ]) {
    assert.match(read(...parts), /<AlertDialogContent className=\{COLLAB_DIALOG_SURFACE\}>/, parts.join('/'));
  }
});

test('the invitations screen has a title on a desktop and keeps Spaces lit in the nav', () => {
  const screen = read('v2', 'features', 'invitations', 'InvitationsScreen.tsx');
  assert.match(screen, /<h1 className="sr-only md:not-sr-only[^"]*">\s*Invitations\s*<\/h1>/);
  const isActive = (pathname: string) => (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const spaces = { href: '/spaces', alsoActiveOn: ['/invitations'] };
  assert.equal(isNavItemActive(spaces, isActive('/invitations')), true);
  assert.equal(isNavItemActive(spaces, isActive('/spaces/abc')), true);
  assert.equal(isNavItemActive(spaces, isActive('/folders')), false);
  assert.equal(isNavItemActive({ href: '/folders' }, isActive('/invitations')), false);
  const nav = read('v2', 'shell', 'nav.config.ts');
  assert.match(nav, /href: '\/spaces',\s*icon: Boxes,[\s\S]*?alsoActiveOn: \['\/invitations'\],/);
});

test('a thread row truncates once at most', () => {
  const row = read('v2', 'features', 'spaces', 'detail', 'SpaceThreadRow.tsx');
  // One fact in the lead: the channel joins the last message's one truncation
  // (16 October 2026), and stands alone when there is none.
  assert.match(row, /lead=\{\[\s*thread\.last_message \? \(\s*<LastMessagePreview\s+key="preview"\s+preview=\{thread\.last_message\}\s+prefix=\{showProvenance \? provenance : null\}\s*\/>\s*\) : showProvenance \? \(\s*provenance\s*\) : null,\s*\]\}/);
  // Until the list carries the preview, the follower count holds the trail.
  assert.match(row, /\? \[\s*followerLabel\(thread\.active_members_count\),/);
});

test('on a phone "New" sits on the title row; from sm: "New space" ends the toolbar', () => {
  const browser = read('v2', 'features', 'spaces', 'list', 'SpacesBrowser.tsx');
  assert.match(browser, /className=\{cn\(CREATE_PILL, FOCUS_RING, 'mt-0\.5 sm:hidden'\)\}/);
  assert.match(browser, /className=\{cn\(CREATE_PILL, FOCUS_RING, 'hidden sm:inline-flex'\)\}/);
  // Discover's quiet link takes the right edge before it (15 October 2026).
  assert.match(browser, /'v2-interactive ml-auto inline-flex h-9 items-center gap-1\.5 rounded-full/);
});

test('an Owner alone in an empty space is offered people', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(
    panel,
    /onInvite: scope !== null && canManage && space\.active_members_count <= 1 \? scope\.openInvite : null,/,
  );
  const states = read('v2', 'features', 'spaces', 'detail', 'content', 'states.tsx');
  assert.match(states, /onInvite \? \(\s*<Button type="button" variant="outline" size="sm" onClick=\{onInvite\}>/);
});

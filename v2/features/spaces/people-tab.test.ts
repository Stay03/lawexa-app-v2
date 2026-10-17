import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Member } from '@/types/collab';
import { invitedRows } from './detail/people/people-model';
import { SPACE_TAB_LABELS, parseSpaceTab } from './model';

/* The People tab (Stay, 15 October 2026, "Inside a space" point 6: "inside the
 * space, there should be a people tab which should list members, there should
 * have the list of members and those pending to join in"; techlead: the
 * Invited and Asked-to-join lists for whoever manages the people only). */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const member = (uuid: string, pending: boolean): Member => ({
  id: uuid.length,
  user: { uuid, name: `Person ${uuid}`, username: uuid, avatar_url: null },
  role: 'member',
  role_label: 'Member',
  is_active: !pending,
  is_pending: pending,
  accepted_at: null,
  joined_at: null,
  left_at: null,
  created_at: '2026-10-15T10:00:00+00:00',
});

test('the pill is People, reachable by ?tab=people for every viewer', () => {
  assert.equal(SPACE_TAB_LABELS.people, 'People');
  assert.equal(parseSpaceTab('people'), 'people');
});

test('the Invited list: pending rows only, each person once, the pending list first', () => {
  const pendingList = [member('b', true), member('c', true)];
  const fromRoster = [member('c', true), member('d', true), member('a', false)];
  assert.deepEqual(
    invitedRows(fromRoster, pendingList).map((row) => row.user.uuid),
    ['b', 'c', 'd'],
  );
  // An API from before the pending list ignores `status` and answers the
  // active members: none of them is shown as invited.
  assert.deepEqual(invitedRows([], [member('a', false), member('e', false)]), []);
});

test('the panel: members for everyone; invite, links, Invited and Asked to join for whoever manages', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'people', 'SpacePeoplePanel.tsx');
  assert.match(panel, /useQuery\(spacesQueries\.members\(space\.uuid, \{ viewerId: session\.userId \}\)\)/);
  // The pending list is asked for only by someone who may read it (403 otherwise).
  assert.match(panel, /status: 'pending' \}\),\s*enabled: canManage,/);
  assert.match(panel, /const invited = canManage \? invitedRows\(roster\.invited, pendingQuery\.data\?\.data \?\? \[\]\) : \[\];/);
  assert.match(panel, /const requests = useSpaceJoinRequests\(space\.uuid, canManage\);/);
  // Invite and the links open the members sheet's own steps: it owns `?invite=`.
  assert.match(panel, /onClick=\{scope\.openInvite\}/);
  assert.match(panel, /onClick=\{scope\.openInviteLinks\}/);
  assert.doesNotMatch(panel, /useUrlOverlay/);
  assert.match(panel, /\{canManage && waiting > 0 \? \(/);
  assert.match(panel, /<SpaceJoinRequestsPanel spaceUuid=\{space\.uuid\} \/>/);
  // Stay's names (15 October 2026): "Invite sent" and "Needs your approval".
  assert.match(panel, />\s*Needs your approval\s*</);
  assert.match(panel, />\s*Invite sent\s*</);
  assert.doesNotMatch(panel, />\s*(Invited|Asked to join)\s*</);
  // One row for the tab and the sheet.
  assert.match(panel, /const rosterRow = useSpaceRosterRow\(\{ space, viewerUuid, canManage, shared \}\);/);
});

test('the top is one row; the name opens the details sheet on ?panel=about (Stay, 15 October 2026)', () => {
  const header = read('v2', 'features', 'spaces', 'detail', 'SpacePlaceHeader.tsx');
  assert.match(header, /<header className=\{SPACE_HEADER_ROW\}>/);
  assert.match(header, /export const SPACE_HEADER_ROW = 'flex items-center gap-3 pb-2';/);
  for (const gone of [/PresenceStack/, /New channel/, /<SpaceAbout\s/]) assert.doesNotMatch(header, gone);
  // The name is a button only when there is something behind it.
  assert.match(header, /onOpenAbout=\{hasAbout \? onOpenAbout : undefined\}/);
  assert.match(header, /aria-haspopup="dialog"/);
  const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
  assert.match(screen, /canOpen: space \? \{ edit: canManage, about: true, invites: false, requests: false \} : undefined,/);
  assert.match(
    screen,
    /<SpacePlaceHeader\s+space=\{space\}\s+membership=\{scope\.membership\}\s+onOpenAbout=\{openAbout\}\s+onOpenRoster=\{scope\.openRoster\}\s*\/>/,
  );
  assert.match(
    screen,
    /<SpaceAboutSheet\s+space=\{space\}\s+membership=\{scope\.membership\}\s+onEdit=\{canManage \? openEdit : undefined\}\s+\{\.\.\.panel\.bind\('about'\)\}\s*\/>/,
  );
  const sheet = read('v2', 'features', 'spaces', 'detail', 'SpaceAboutSheet.tsx');
  assert.match(sheet, /side="bottom"/);
  assert.match(sheet, /memberCountLabel\(space\.active_members_count\)/);
});

test('the manager-only lists are asked for as the space opens, and fade in (inside-shots-1)', () => {
  const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
  assert.match(screen, /const peopleReads = eligible && space !== null && canManage;/);
  assert.match(screen, /status: 'pending' \}\),\s*enabled: peopleReads,/);
  assert.match(screen, /useSpaceJoinRequests\(spaceUuid, peopleReads\);/);
  const panel = read('v2', 'features', 'spaces', 'detail', 'people', 'SpacePeoplePanel.tsx');
  assert.equal((panel.match(/className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"/g) ?? []).length, 2);
});

test('the home draws the People pill, and the silhouette has its shape', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(panel, /tab === 'people' \? \(\s*<SpacePeoplePanel space=\{space\} \/>/);
  // People has nothing to search.
  assert.match(panel, /\{tab === 'people' \? null : \(\s*<div className="flex min-w-0 flex-1 items-center gap-2">\s*<SearchField/);
  const states = read('v2', 'features', 'spaces', 'detail', 'states.tsx');
  assert.match(states, /tab === 'people' \? \([\s\S]{0,200}<RosterSkeleton \/>/);
  // The members call passes the status through.
  assert.match(read('lib', 'api', 'collab.ts'), /page: params\.page \?\? 1,\s*status: params\.status,/);
});

test('a join request row: two compact buttons at the end, the channel sentence still before its buttons (Stay, 15 October 2026)', () => {
  const requests = read('v2', 'features', 'invites', 'JoinRequestsPanel.tsx');
  assert.doesNotMatch(requests, /className="flex-1"/);
  assert.match(requests, /\{channel \? null : \(\s*<DecideButtons channel=\{false\} deciding=\{deciding\} onDecide=\{onDecide\} \/>\s*\)\}/);
  assert.match(requests, /Saying yes also lets them into[\s\S]*?<DecideButtons channel deciding=\{deciding\} onDecide=\{onDecide\} \/>/);
  // No role picker on the row (Stay, 16 October 2026): the server's default.
  assert.doesNotMatch(requests, /RoleSelect|Joins as|contentRole/);
  assert.match(requests, /<div className="ml-auto flex shrink-0 gap-2">/);
});

test('a space chat row says its last message and who sent it (Stay, 15 October 2026)', async () => {
  const { lastMessageLine } = await import('./model');
  const at = '2026-10-15T12:30:00+00:00';
  assert.equal(lastMessageLine({ role: 'user', preview: 'Can a tenant withhold rent?', created_at: at, author: { uuid: 'u2', name: 'User2 Tester' } }, 'u1'), 'User2 Tester: Can a tenant withhold rent?');
  assert.equal(lastMessageLine({ role: 'user', preview: 'Mine', created_at: at, author: { uuid: 'u1', name: 'User Tester' } }, 'u1'), 'You: Mine');
  assert.equal(lastMessageLine({ role: 'assistant', preview: 'A short answer', created_at: at, author: null }, 'u1'), 'Lawexa: A short answer');
  // A sender the server withholds leaves the preview alone; whitespace folds.
  assert.equal(lastMessageLine({ role: 'user', preview: 'Two\n lines', created_at: at, author: null }, 'u1'), 'Two lines');
  // An outsider gets the owner's name with no uuid: never "You" by mistake.
  assert.equal(lastMessageLine({ role: 'user', preview: 'Hi', created_at: at, author: { name: 'Owner Name' } }, null), 'Owner Name: Hi');
  assert.equal(lastMessageLine(null, 'u1'), null);
  assert.equal(lastMessageLine({ role: 'user', preview: '  ', created_at: at }, 'u1'), null);
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  // No message to preview: say so, never "You" (techlead, 15 October 2026).
  assert.match(panel, /byline=\{lastMessageLine\(entry\.item\.last_message, viewerUuid\) \?\? 'No messages yet'\}/);
  assert.doesNotMatch(panel, /spaceChatByline/);
});

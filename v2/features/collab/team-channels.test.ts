import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { UserRole } from '@/types/auth';
import type { V2SessionSnapshot } from '@/v2/runtime/session-context';
import { visibleNavItems } from '@/v2/shell/nav.config';
import { canOpenTeamChannels, collabAccessState, isTeamChannelsPath } from './model';

/* Team Channels follow the SERVER's flag, `can_access_team_channels` (researchers and
 * above today; Stay, 11 October 2026). The app reads the flag and never the role, so
 * who gets Team Channels can change on the server alone (techlead's decision). The new
 * Spaces stay open to every registered account. */

const session = (
  role: UserRole | null,
  canAccessTeamChannels: boolean,
  extra: Partial<V2SessionSnapshot> = {},
): V2SessionSnapshot =>
  ({
    signedIn: role !== null,
    userId: role === null ? null : 7,
    name: null,
    email: null,
    avatarUrl: null,
    username: null,
    role,
    isVerified: true,
    authProvider: 'google',
    canSetPrice: false,
    isAmbassador: null,
    profileCountryName: null,
    profileCountryCode: null,
    isLawyer: false,
    canAccessTeamChannels,
    ...extra,
  }) as V2SessionSnapshot;

test('Team Channels open on the server flag, whatever the role says', () => {
  assert.equal(canOpenTeamChannels(session('researcher', true)), true);
  assert.equal(canOpenTeamChannels(session('user', false)), false);
  // The flag decides both ways: a role never opens or closes the door by itself.
  assert.equal(canOpenTeamChannels(session('researcher', false)), false);
  assert.equal(canOpenTeamChannels(session('user', true)), true);
});

test('a regular user still opens Spaces but not Team Channels', () => {
  const user = session('user', false);
  assert.equal(collabAccessState(user), 'eligible');
  assert.equal(canOpenTeamChannels(user), false);
});

test('Team Channels also need the collab door: an unverified account is not let in', () => {
  const unverified = session('researcher', true, { authProvider: 'email', isVerified: false });
  assert.equal(collabAccessState(unverified), 'verify-email');
  assert.equal(canOpenTeamChannels(unverified), false);
});

test('Team Channels addresses: the index and every channel, in both address forms', () => {
  for (const path of ['/channels', '/channels/abc', '/v2/channels', '/v2/channels/abc']) {
    assert.equal(isTeamChannelsPath(path), true, path);
  }
  for (const path of ['/spaces', '/spaces/abc', '/channelsx', '/v2/spaces/abc', '/']) {
    assert.equal(isTeamChannelsPath(path), false, path);
  }
});

test('the nav shows "Team Channels" on the flag, and Spaces to every registered account', () => {
  const labels = (role: UserRole | null, canAccessTeamChannels: boolean) =>
    visibleNavItems({ role, canAccessTeamChannels }).map((item) => item.label);
  assert.ok(labels('researcher', true).includes('Team Channels'));
  assert.ok(!labels('user', false).includes('Team Channels'));
  assert.ok(!labels('researcher', false).includes('Team Channels'), 'the role alone never shows it');
  assert.ok(labels('user', false).includes('Spaces'));
  assert.ok(!labels('guest', false).includes('Spaces'));
});

/* The wiring, pinned by source: .tsx and React. */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('the session carries the server flag, false when the server does not send it', () => {
  const server = read('v2', 'runtime', 'session.ts');
  // Beside the user on /auth/me (data.can_access_team_channels), never on it.
  assert.match(server, /can_access_team_channels: result\.data\?\.can_access_team_channels === true,/);
  assert.doesNotMatch(server, /user\.can_access_team_channels/);
  assert.match(read('app', 'v2', 'layout.tsx'), /canAccessTeamChannels=\{user\?\.can_access_team_channels \?\? false\}/);
  for (const surface of ['V2Sidebar.tsx', 'V2Drawer.tsx']) {
    assert.match(read('v2', 'shell', surface), /canAccessTeamChannels: user\?\.can_access_team_channels \?\? false/, surface);
  }
});

test('the gate, the spine, both homes and discover all read the flag, never the role', () => {
  const access = read('v2', 'features', 'collab', 'access.tsx');
  assert.match(access, /isTeamChannelsPath\(pathname\) && !canOpenTeamChannels\(session\)/);
  assert.match(access, /<TeamChannelsClosedState \/>/);
  const spine = read('v2', 'runtime', 'realtime', 'spine.tsx');
  assert.match(spine, /channelsQueries\.mine\(\{ viewerId \}\), enabled: canOpenTeamChannels\(session\)/);
  // The collab frame asks for the channel list only with the flag too, through
  // `showsChannels` (Spaces F2: the flag AND a team space on a space route,
  // the flag itself on a channel route). The Spaces list no longer reads it:
  // its rows lost the channel chips (Stay, 15 October 2026).
  const browser = read('v2', 'features', 'spaces', 'list', 'SpacesBrowser.tsx');
  assert.doesNotMatch(browser, /channelsQueries/);
  const frame = read('v2', 'features', 'collab', 'shell', 'CollabFrame.tsx');
  assert.match(frame, /channelsQueries\.mine\(\{ viewerId \}\),\s*enabled: eligible && showsChannels,/);
  assert.match(frame, /const showsChannels = isSpaceRoute[\s\S]{0,200}?: canOpenTeamChannels\(session\);/);
  // The nav row's unread dot reads the same list from every page's sidebar and
  // drawer: below researcher it asked anyway and collected a 403 per page
  // (real-server pass 5). The space mentions beside it stay on Spaces access.
  const signal = read('v2', 'features', 'channels', 'my-channels', 'nav-signal.tsx');
  assert.match(signal, /useQuery\(\{ \.\.\.channels, enabled: canOpenTeamChannels\(session\), select: selectUnreadPresent \}\)/);
  assert.match(signal, /useQuery\(\{ \.\.\.spaces, enabled: eligible, select: sumSpaceMentions \}\)/);
  for (const home of ['WorkHome.tsx', 'StudyHome.tsx']) {
    const source = read('v2', 'shell', 'designs', home);
    assert.match(source, /const \{ canAccessTeamChannels \} = useV2Session\(\);/, home);
    assert.match(source, /\{canAccessTeamChannels \? <ChannelMessagesSection \/>/, home);
    assert.doesNotMatch(source, /canAccessCollab/, home);
  }
  const sections = read('v2', 'shell', 'designs', 'sections', 'HomeSections.tsx');
  assert.match(sections, /<HomeSection title="Jump back in" action=\{\{ href: '\/channels', label: 'All' \}\}>/);
  // Discover is every signed-in account's since public shared spaces arrived
  // (Arthur, 15 October 2026); the server decides which rows each one gets.
  const discover = read('v2', 'features', 'spaces', 'discover', 'DiscoverScreen.tsx');
  assert.doesNotMatch(discover, /canAccessTeamChannels/);
  assert.doesNotMatch(read('v2', 'features', 'collab', 'model.ts'), /canAccessTeamChannels\(session\.role\)/);
});

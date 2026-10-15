import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { UserRole } from '@/types/auth';
import type { ContentRole, Space, SpaceKind } from '@/types/collab';
import type { V2SessionSnapshot } from '@/v2/runtime/session-context';
import {
  canAddContent,
  canSpaceBeOpen,
  createSpaceKind,
  defaultSpaceTab,
  isSharedSpace,
  parseSpaceTab,
  spaceChatByline,
  spaceContentCountsLabel,
  spaceKind,
  spaceShowsChannels,
  spaceTabs,
  showsTeamMark,
  uniqueRowsById,
} from './model';

/* Spaces F2 (Stay, 11 October 2026): one Space holds chats, folders and files
 * for every member; channels stay with TEAM spaces, for researchers and above.
 * Pure rules first, then the wiring of the .tsx files, pinned by source. */

const TEAM_ROLES: readonly UserRole[] = ['researcher', 'admin', 'superadmin'];

/** A verified, signed-in session. It carries the role AND the server flag the
 *  Team Channels rule may read, set the same way, so these tests hold whichever
 *  of the two `canOpenTeamChannels` reads. */
const session = (role: UserRole): V2SessionSnapshot =>
  ({
    signedIn: true,
    userId: 7,
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
    canAccessTeamChannels: TEAM_ROLES.includes(role),
  }) as V2SessionSnapshot;

const researcher = session('researcher');
const user = session('user');

test('an absent kind is a team space, the only kind before backend B1', () => {
  assert.equal(spaceKind({}), 'team');
  assert.equal(spaceKind({ kind: 'team' }), 'team');
  assert.equal(spaceKind({ kind: 'shared' }), 'shared');
  assert.equal(isSharedSpace({}), false);
  assert.equal(isSharedSpace({ kind: 'shared' }), true);
});

test('channels show only on a team space, to someone who may open Team Channels', () => {
  const cases: readonly [SpaceKind | undefined, V2SessionSnapshot, boolean][] = [
    ['team', researcher, true],
    [undefined, researcher, true],
    ['shared', researcher, false],
    ['team', user, false],
    [undefined, user, false],
    ['shared', user, false],
  ];
  for (const [kind, viewer, expected] of cases) {
    assert.equal(
      spaceShowsChannels({ kind }, viewer),
      expected,
      `${kind ?? 'absent'} × ${viewer.role}`,
    );
  }
  for (const role of TEAM_ROLES) {
    assert.equal(spaceShowsChannels({ kind: 'team' }, session(role)), true, role);
  }
});

test('only an Owner or a Contributor may add content; the old my_role does not count', () => {
  const cases: readonly [ContentRole | null | undefined, boolean][] = [
    ['owner', true],
    ['editor', true],
    ['viewer', false],
    [null, false],
    [undefined, false],
  ];
  for (const [role, expected] of cases) {
    assert.equal(canAddContent({ my_content_role: role }), expected, String(role));
  }
  const teamAdmin: Pick<Space, 'my_role' | 'my_content_role'> = {
    my_role: 'admin',
    my_content_role: null,
  };
  assert.equal(canAddContent(teamAdmin), false);
});

test('the tabs by kind × role: Channels first, and the default, only where channels show', () => {
  const tabsFor = (kind: SpaceKind, viewer: V2SessionSnapshot) =>
    spaceTabs(spaceShowsChannels({ kind }, viewer));
  // People last, for every member of every kind (Stay, 15 October 2026).
  assert.deepEqual(tabsFor('team', researcher), ['channels', 'chats', 'folders', 'files', 'people']);
  assert.deepEqual(tabsFor('shared', researcher), ['chats', 'folders', 'files', 'people']);
  assert.deepEqual(tabsFor('team', user), ['chats', 'folders', 'files', 'people']);
  assert.deepEqual(tabsFor('shared', user), ['chats', 'folders', 'files', 'people']);
  assert.equal(defaultSpaceTab(true), 'channels');
  assert.equal(defaultSpaceTab(false), 'chats');
});

test('?tab= resolves against the tabs this viewer has, never to a missing one', () => {
  assert.equal(parseSpaceTab('files', false), 'files');
  assert.equal(parseSpaceTab('channels', true), 'channels');
  assert.equal(parseSpaceTab('channels', false), 'chats');
  assert.equal(parseSpaceTab('nonsense', true), 'channels');
  assert.equal(parseSpaceTab(null, false), 'chats');
});

test('a shared space is never offered as open; a create sends a kind only for researcher+', () => {
  assert.equal(canSpaceBeOpen('team'), true);
  assert.equal(canSpaceBeOpen('shared'), false);
  assert.equal(createSpaceKind('team', true), 'team');
  assert.equal(createSpaceKind('shared', true), 'shared');
  assert.equal(createSpaceKind('team', false), undefined);
  assert.equal(createSpaceKind('shared', false), undefined);
});

test('a shared space says what it holds; no counts on the payload means no claim', () => {
  assert.equal(
    spaceContentCountsLabel({ conversations_count: 3, folders_count: 1, files_count: 2 }),
    // The tab's own word since design round 1 (was "3 chats").
    '3 conversations · 1 folder · 2 files',
  );
  assert.equal(
    spaceContentCountsLabel({ conversations_count: 0, folders_count: 0, files_count: 1 }),
    '1 file',
  );
  assert.equal(
    spaceContentCountsLabel({ conversations_count: 0, folders_count: 0, files_count: 0 }),
    'Nothing added yet',
  );
  assert.equal(spaceContentCountsLabel({}), null);
});

test('a space chat names its owner, or "You" for the viewer', () => {
  assert.equal(spaceChatByline({ id: 7, name: 'Ada' }, 7), 'You');
  assert.equal(spaceChatByline({ id: 8, name: 'Ada Obi' }, 7), 'Ada Obi');
  assert.equal(spaceChatByline(null, 7), null);
  assert.equal(spaceChatByline(undefined, null), null);
});

/* ── The wiring, pinned by source ─────────────────────────────────────────── */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('the frame: no rail, drawer, channel dialog or channel request unless channels show', () => {
  const frame = read('v2', 'features', 'collab', 'shell', 'CollabFrame.tsx');
  // The one answer, from the detail, else the cached row, and yes on a channel
  // route (the gate above turned everyone below researcher away there).
  assert.match(
    frame,
    /const showsChannels = isSpaceRoute\s*\?\s*space !== null\s*\?\s*spaceShowsChannels\(space, session\)\s*:\s*cachedSpace !== null && spaceShowsChannels\(cachedSpace, session\)\s*:\s*canOpenTeamChannels\(session\);/,
  );
  // Both channel reads are gated on it.
  assert.match(
    frame,
    /channelsQueries\.bySpace\([\s\S]*?enabled:\s*eligible &&\s*showsChannels &&/,
  );
  assert.match(
    frame,
    /channelsQueries\.mine\(\{ viewerId \}\),\s*enabled: eligible && showsChannels,/,
  );
  // The rail's PRESENCE (aside and width, drawer, header toggle) guesses like
  // the page silhouette while the kind is unknown: an unknown kind is team.
  assert.match(
    frame,
    /const railShown = isSpaceRoute\s*\?\s*space !== null\s*\?\s*spaceShowsChannels\(space, session\)\s*:\s*spaceShowsChannels\(\{ kind: cachedSpace\?\.kind \?\? 'team' \}, session\)\s*:\s*canOpenTeamChannels\(session\);/,
  );
  assert.match(frame, /const hasRail = !placeRefused && railShown;/);
  assert.match(frame, /\{hasRail \? \(\s*<aside/);
  assert.match(frame, /\{hasRail \? \(\s*<SpaceDrawer/);
  assert.doesNotMatch(frame, /\{placeRefused \? null : \(/);
  assert.match(frame, /const headerOpenRail = railShown \? openRail : null;/);
  // No REQUEST reads the guess: only the known answer gates them.
  assert.doesNotMatch(frame, /enabled:[^;]*railShown/);
  // The create-channel dialog and its param wait for the known answer too.
  assert.match(frame, /canManage && showsChannels \? \(\s*<ChannelFormDialog/);
  assert.match(frame, /\{ channel: canManage && showsChannels \}/);
  const slot = read('v2', 'features', 'collab', 'shell', 'CollabHeaderSlot.tsx');
  assert.match(slot, /if \(context\.openRail === null\) return null;/);
});

test('the space page: tabs from the model, the lobby only on Channels, threads only there', () => {
  const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
  assert.match(screen, /const showsChannels = scope\?\.showsChannels \?\? false;/);
  assert.match(screen, /const tab = parseSpaceTab\(tabParam, showsChannels\);/);
  assert.match(screen, /quietReplaceUrlParams\(\{ tab: value \}\)/);
  assert.match(screen, /<SpaceTabs\s+showsChannels=\{showsChannels\}/);
  assert.match(screen, /\{tab === 'channels' \? \(\s*<>[\s\S]{0,800}?<div className=\{SPACE_LOBBY_GRID\}>/);
  assert.match(screen, /<SpaceContentPanel key=\{tab\} tab=\{tab\} spaceUuid=\{space\.uuid\} \/>/);
  assert.match(
    screen,
    /enabled: eligible && space !== null && showsChannels && tab === 'channels',/,
  );
  // New channel sits at the top of the Channels tab since Stay's 15 October note.
  assert.match(screen, /\{canManage && showsChannels \? \(\s*<div className="mb-4 lg:hidden">/);
  const tabs = read('v2', 'features', 'spaces', 'detail', 'SpaceTabs.tsx');
  assert.match(tabs, /spaceTabs\(showsChannels\)/);
  assert.match(tabs, /<TabRow/);
});

test('the content lists: their own keys under spaces, read-only rows', () => {
  const queries = read('v2', 'features', 'spaces', 'queries.ts');
  for (const leaf of ['conversations', 'folders', 'files']) {
    assert.match(
      queries,
      new RegExp(`\\.\\.\\.spacesQueries\\.contentsOf\\(spaceUuid\\),\\s*'${leaf}',\\s*params,\\s*\\{ viewerId \\},`),
      leaf,
    );
  }
  const api = read('lib', 'api', 'collab.ts');
  for (const path of ['conversations', 'folders', 'files']) {
    assert.match(api, new RegExp(`\`/spaces/\\$\\{spaceUuid\\}/${path}\``), path);
  }
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.doesNotMatch(panel, /onDelete=|onRename=/);
  assert.doesNotMatch(panel, /FilesTab/);
  // Every list keeps each row once across pages.
  assert.doesNotMatch(panel, /flatMap/);
  for (const idOf of ['chatId', 'folderUuid', 'fileId']) {
    assert.match(panel, new RegExp(`uniqueRowsById\\(pages, ${idOf}\\)`), idOf);
  }
  // Files open through the tap-first opener, never the channel download hook.
  const fileRow = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceFileRow.tsx');
  assert.match(fileRow, /const \{ open, opening, failed, gone \} = useOpenFileInNewTab\(\);/);
  assert.doesNotMatch(fileRow, /useDownloadChannelFile/);
  // Deleting or leaving a space drops its cached contents with it.
  const mutations = read('v2', 'features', 'spaces', 'mutations.ts');
  assert.equal(
    mutations.match(/removeQueries\(\{ queryKey: spacesQueries\.contentsOf\(spaceUuid\) \}\)/g)?.length,
    2,
  );
});

test('each row once across pages, the first copy kept', () => {
  const pages = [
    { data: [{ id: 1, v: 'a' }, { id: 2, v: 'b' }] },
    { data: [{ id: 2, v: 'b-again' }, { id: 3, v: 'c' }] },
  ];
  assert.deepEqual(
    uniqueRowsById(pages, (row) => row.id).map((row) => row.v),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(uniqueRowsById([], (row: { id: number }) => row.id), []);
});

test('the "Team" mark needs an explicit team kind and a viewer with Team Channels', () => {
  assert.equal(showsTeamMark({ kind: 'team' }, true), true);
  assert.equal(showsTeamMark({}, true), false);
  assert.equal(showsTeamMark({ kind: 'shared' }, true), false);
  assert.equal(showsTeamMark({ kind: 'team' }, false), false);
});

test('the spaces list marks team spaces and asks for channels only for researcher+', () => {
  const row = read('v2', 'features', 'spaces', 'list', 'SpaceRow.tsx');
  // Design round 4: the row's mark is the move picker's `spaceKindMark`
  // (was `showsTeamMark` and a literal "Team"), which keeps the Team rule.
  assert.match(row, /const kind = spaceKindMark\(space, canOpenTeamChannels\);/);
  assert.match(row, /\{kind \? \(/);
  // Design round 1: the viewer's role leads the line (was
  // `[holds ?? space.type_label, spaceOwnerLabel(space)]`).
  // Design round 2: the facts after the role are one list, shared by the
  // phone's second line and the single line from sm: up (was
  // `[role, holds ?? space.type_label, spaceOwnerLabel(space)]`), built by
  // `inside(max)` so the phone can cap its chips (round 2, NICE 4).
  assert.match(
    row,
    /hasChips \? \(\s*<ChannelChips key="chips" activity=\{activity\} max=\{maxChips\} \/>\s*\) : \(\s*holds \?\? space\.type_label\s*\),\s*spaceOwnerLabel\(space\),/,
  );
  assert.match(row, /lead=\{\[role, \.\.\.inside\(\)\]\}/);
  const browser = read('v2', 'features', 'spaces', 'list', 'SpacesBrowser.tsx');
  assert.match(
    browser,
    /channelsQueries\.mine\(\{ viewerId \}\),\s*enabled: canOpenTeamChannels\(session\),/,
  );
  assert.match(browser, /const teamChannelsOpen = canOpenTeamChannels\(session\);/);
  assert.match(browser, /canOpenTeamChannels=\{teamChannelsOpen\}/);
});

test('the page follows a soft navigation that changes ?tab=', () => {
  const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
  assert.match(
    screen,
    /if \(urlTab !== seenUrlTab\) \{\s*setSeenUrlTab\(urlTab\);\s*setTabParam\(urlTab\);\s*\}/,
  );
});

test('the create dialog: kind sent only for researcher+, no "open" for a shared space', () => {
  const dialog = read('v2', 'features', 'spaces', 'dialogs', 'SpaceFormDialog.tsx');
  assert.match(dialog, /const canChooseKind = !isEdit && canOpenTeamChannels\(session\);/);
  assert.match(dialog, /kind: createSpaceKind\(chosenKind, canChooseKind\),/);
  assert.match(dialog, /\{canChooseKind \? \(\s*<ChoiceCards\s+legend="Kind"/);
  assert.match(dialog, /const isPrivate = !canBeOpen \|\| privacy === 'private';/);
  assert.match(dialog, /\{canBeOpen \? \(\s*<ChoiceCards\s+legend="Who can join"/);
});

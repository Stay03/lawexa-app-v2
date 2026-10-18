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
  SPACE_TABS,
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

test('the pills are the same for every kind and role; channels stay in the rail (B4)', () => {
  // People last (Stay, 15 October 2026); no Channels pill (design B4).
  assert.deepEqual(SPACE_TABS, ['all', 'conversations', 'files', 'folders', 'people']);
  // Channels still show where they did, in the rail.
  const shows = (kind: SpaceKind, viewer: V2SessionSnapshot) => spaceShowsChannels({ kind }, viewer);
  assert.equal(shows('team', researcher), true);
  assert.equal(shows('shared', researcher), false);
  assert.equal(shows('team', user), false);
  // Every space opens on All, with the message box under it.
  assert.equal(defaultSpaceTab(), 'all');
});

test('?tab= resolves to a pill, never to a missing one', () => {
  assert.equal(parseSpaceTab('files'), 'files');
  assert.equal(parseSpaceTab('people'), 'people');
  assert.equal(parseSpaceTab('channels'), 'all');
  assert.equal(parseSpaceTab('chats'), 'all');
  assert.equal(parseSpaceTab('nonsense'), 'all');
  assert.equal(parseSpaceTab(null), 'all');
});

test('a shared space is never offered as open; a create sends a kind only for researcher+', () => {
  assert.equal(canSpaceBeOpen('team'), true);
  // Public shared spaces (Arthur, 15 October 2026): listed on Discover.
  assert.equal(canSpaceBeOpen('shared'), true);
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

test('the space page: pills from the model, one panel, no channel read (B4)', () => {
  const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
  assert.match(screen, /const tab = parseSpaceTab\(tabParam\);/);
  assert.match(screen, /quietReplaceUrlParams\(\{ tab: value \}\)/);
  assert.match(screen, /<SpaceContentPanel space=\{space\} tab=\{tab\} onTabChange=\{setTab\} \/>/);
  assert.doesNotMatch(screen, /SpaceTabs|threadsBySpace|showsChannels/);
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(panel, /<TabRow\s+tabs=\{PILLS\}/);
  assert.match(panel, /const PILLS = SPACE_TABS\.map\(\(id\) => \(\{ id, label: SPACE_TAB_LABELS\[id\] \}\)\);/);
});

test('the content feed: its own key under spaces, read-only rows', () => {
  const queries = read('v2', 'features', 'spaces', 'queries.ts');
  assert.match(queries, /queryKey: \[\.\.\.spacesQueries\.itemsOf\(spaceUuid\), params, \{ viewerId \}\] as const,/);
  const api = read('lib', 'api', 'collab.ts');
  assert.match(api, /`\/spaces\/\$\{spaceUuid\}\/items`/);
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  // Rename on the reader's own folders only (Arthur, 17 October 2026, item
  // 6). Delete is in a file's menu since 15 October 2026.
  assert.doesNotMatch(panel, /onRename/);
  assert.equal((panel.match(/onDelete:/g) ?? []).length, 1);
  assert.match(panel, /onCopyToMine: copyFile,\s*onDelete: /);
  assert.doesNotMatch(panel, /FilesTab/);
  // The list keeps each item once across pages, keyed by kind and id.
  assert.doesNotMatch(panel, /flatMap/);
  assert.match(panel, /uniqueRowsById\(pages, itemKey\)/);
  assert.match(
    panel,
    /const itemKey = \(entry: SpaceItem\): string =>\s*entry\.type === 'folder' \|\| entry\.type === 'channel' \|\| entry\.type === 'thread'\s*\? `\$\{entry\.type\}:\$\{entry\.item\.uuid\}`\s*: `\$\{entry\.type\}:\$\{entry\.item\.id\}`;/,
  );
  // Files open through the tap-first opener, from the file's card (its row
  // opens the card), never the channel download hook.
  const card = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceFileCard.tsx');
  assert.match(card, /const \{ open, opening, failed, gone \} = useOpenFileInNewTab\(\);/);
  assert.doesNotMatch(card, /useDownloadChannelFile/);
  assert.doesNotMatch(read('v2', 'features', 'spaces', 'detail', 'content', 'feed-rows.tsx'), /useOpenFileInNewTab|useDownloadChannelFile/);
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
  // The spaces list row was redrawn as a chat-list row (Stay, 15 October 2026);
  // spaces-list-rows.test.ts pins it now.
  // The row no longer marks kinds or reads channels, so the list asks for no
  // channels at all, for any role.
  const row = read('v2', 'features', 'spaces', 'list', 'SpaceRow.tsx');
  assert.doesNotMatch(row, /spaceKindMark|ChannelChips/);
  const browser = read('v2', 'features', 'spaces', 'list', 'SpacesBrowser.tsx');
  assert.doesNotMatch(browser, /channelsQueries|canOpenTeamChannels/);
});

test('the page follows a soft navigation that changes ?tab=', () => {
  const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
  assert.match(
    screen,
    /if \(urlTab !== seenUrlTab\) \{\s*setSeenUrlTab\(urlTab\);\s*setTabParam\(urlTab\);\s*\}/,
  );
});

test('the create dialog asks no kind and no owner: every new space is a shared one, Private or Public (Stay, Arthur, 15 October 2026)', () => {
  const dialog = read('v2', 'features', 'spaces', 'dialogs', 'SpaceFormDialog.tsx');
  // Sent without asking: with no kind the server makes the old team space.
  assert.match(dialog, /kind: 'shared',/);
  assert.match(dialog, /const kind: SpaceKind = space \? spaceKind\(space\) : 'shared';/);
  assert.doesNotMatch(dialog, /legend="Kind"|legend="Owner"|organization_uuid|canChooseKind|organizationsQueries/);
  // Who can join: on step two of create and on the edit form, Private first.
  assert.match(dialog, /const isPrivate = !canBeOpen \|\| privacy === 'private';/);
  assert.match(dialog, /const privacyField = canBeOpen \? \(\s*<ChoiceCards\s+legend="Who can join"/);
  assert.equal((dialog.match(/\{privacyField\}/g) ?? []).length, 2);
  assert.match(dialog, /\{nameField\}\s*\{goalField\}\s*\{privacyField\}\s*<\/div>/);
  assert.match(dialog, /title: 'Public',\s*description: 'Shown on Discover\. People ask to join, and you approve them\.',/);
});

test('create is two steps: the type first, then the fields, with no preview (Stay, 15 October 2026)', () => {
  const dialog = read('v2', 'features', 'spaces', 'dialogs', 'SpaceFormDialog.tsx');
  // No type until one is picked, and nothing to submit without one.
  assert.match(dialog, /const type: SpaceType \| null = isEdit \? editType : urlType;/);
  assert.match(dialog, /const canSubmit = type !== null && name\.trim\(\)\.length > 0 && changed && !submitting;/);
  // Step one: the two cards are buttons that move on; no Create Space yet.
  assert.match(dialog, /onChoose=\{\(\) => chooseType\(choice\.value\)\}/);
  assert.match(dialog, /stepParam\.show\(next\);/);
  assert.match(dialog, /\{showsTypeStep \? null : \(\s*<Button\s+type="button"\s+onClick=\{handleSubmit\}/);
  // Step two: the type chosen and the way back, then the fields.
  // The step mark, with the type picked as a chip (the phone redo, 15 October 2026).
  assert.match(dialog, /<StepMark step=\{2\} chosen=\{chosen\} \/>/);
  assert.match(dialog, /\{`Step \$\{step\} of 2`\}/);
  assert.match(dialog, /<div className="space-y-4">\s*\{nameField\}\s*\{goalField\}\s*\{privacyField\}\s*<\/div>/);
  assert.match(dialog, /const changeType = \(\) => stepParam\.close\(\);/);
  // The bar is the same on both steps; Back is step two's footer button.
  assert.doesNotMatch(dialog, /onBack=/);
  assert.match(dialog, /variant="secondary"\s+onClick=\{changeType\}[\s\S]{0,120}?>\s*Back\s*<\/Button>/);
  assert.match(dialog, /\{isEdit \|\| showsTypeStep \? \(\s*<Button[\s\S]{0,300}?Cancel/);
  // On a desktop the card's top stands still between the steps.
  assert.match(dialog, /anchor=\{isEdit \? 'center' : 'top'\}/);
  // One question style on both steps, and no line under create's title.
  assert.match(dialog, /className=\{STEP_QUESTION\}>\s*What are you working on\?/);
  assert.match(dialog, /\{isEdit \? 'Space name' : 'Name your space'\}/);
  assert.doesNotMatch(dialog, /Keep conversations and resources together/);
  // On a phone, create and edit are one sheet frame (techlead, 16 October
  // 2026: Stay rejected the full-screen phone popup); was
  // `size={isEdit ? 'fill' : 'content'}`. A tap beside it keeps an edit too.
  assert.match(dialog, /size="content"/);
  assert.doesNotMatch(dialog, /size=\{isEdit/);
  assert.match(dialog, /guardUnsaved=\{isEdit \? changed : name\.trim\(\) !== '' \|\| description\.trim\(\) !== ''\}/);
  // A phone does not raise the keyboard by itself on step two.
  assert.match(dialog, /if \(window\.matchMedia\('\(min-width: 48rem\)'\)\.matches\) nameRef\.current\?\.focus\(\);/);
  // Cancel and Create Space side by side, FieldPanel's pair.
  assert.match(dialog, /variant="secondary"[\s\S]{0,320}?Cancel[\s\S]{0,400}?className="flex-1 md:w-auto md:flex-none"/);
  const overlay = read('v2', 'shell', 'overlay', 'ResponsiveOverlay.tsx');
  assert.doesNotMatch(overlay, /onBack/);
  assert.match(overlay, /anchor === 'top' && SURFACE_DESKTOP_TOP,/);
  assert.match(overlay, /const SURFACE_DESKTOP_TOP =\s*'md:top-\[max\(2rem,12dvh\)\] md:translate-y-0 /);
  // Each step slides in from its side, and only with motion allowed.
  assert.match(dialog, /entered === 'forward' \? 'motion-safe:slide-in-from-right-4' : 'motion-safe:slide-in-from-left-4'/);
  // The preview is gone.
  assert.doesNotMatch(dialog, /SpacePreview|SpaceCrest|Preview/);
});

test('step two has its own URL, so Back goes step two → step one → closed (Stay, 15 October 2026)', () => {
  const dialog = read('v2', 'features', 'spaces', 'dialogs', 'SpaceFormDialog.tsx');
  // `?step=work|study`, its own pushed entry; never `?type=`, the list's filter.
  assert.match(dialog, /const STEP_PARAM = 'step';/);
  assert.match(dialog, /const stepParam = useUrlOverlay\(STEP_PARAM, \{ canOpen: !isEdit \}\);/);
  assert.match(dialog, /return value === 'work' \|\| value === 'study' \? value : null;/);
  assert.match(dialog, /const showsTypeStep = !isEdit && urlType === null;/);
  // Closing from step two, and a create that succeeds there, leave over both
  // of the dialog's entries at once, only when the one under step two is an
  // overlay's own; otherwise step two is blanked in place.
  assert.match(dialog, /readHistoryStamp\(OVERLAY_STAMP_KEY\) === STEP_PARAM && stepAboveOverlayRef\.current/);
  assert.match(dialog, /window\.history\.go\(-2\);/);
  assert.match(dialog, /stepParam\.closeInPlace\(\);\s*after\(\);/);
  assert.match(dialog, /else leaveFromStepTwo\(finish\);/);
  // Every close goes through it: the overlay's own and Cancel.
  assert.match(dialog, /onOpenChange=\{handleOpenChange\}/);
  assert.match(dialog, /onClick=\{\(\) => handleOpenChange\(false\)\}/);
  const overlay = read('v2', 'runtime', 'use-url-overlay.ts');
  assert.match(overlay, /export const OVERLAY_STAMP_KEY = '__v2Overlay';/);
});

test('the name and goal examples follow the type picked (Stay, 15 October 2026)', () => {
  const dialog = read('v2', 'features', 'spaces', 'dialogs', 'SpaceFormDialog.tsx');
  assert.match(dialog, /name: 'e\.g\. Okafor & Sons',/);
  assert.match(dialog, /goal: 'e\.g\. Review the lease and draft a reply to the landlord’s notice',/);
  assert.match(dialog, /name: 'e\.g\. Constitutional Law, Bar Finals prep',/);
  assert.match(dialog, /goal: 'e\.g\. Revise for the Bar Finals and practise past questions',/);
  assert.match(dialog, /const examples = TYPE_EXAMPLES\[type \?\? 'work'\];/);
  assert.match(dialog, /placeholder=\{examples\.name\}/);
  assert.match(dialog, /placeholder=\{examples\.goal\}/);
});

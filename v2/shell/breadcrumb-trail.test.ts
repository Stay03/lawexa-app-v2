import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  NO_BREADCRUMB_DATA,
  breadcrumbTrail,
  crumbResolves,
  trailRouteFor,
  type BreadcrumbData,
  type BreadcrumbTrail,
} from './breadcrumb-trail';
import { provisionCrumbLabel } from '@/v2/features/statutes/reader/provision';
import { UNTITLED_FOLDER_NAME, folderDisplayName } from '@/v2/features/folders/folder-row-model';
import {
  clearHeaderContext,
  headerContextFor,
  setHeaderContext,
  snapshotHeaderContext,
} from './header-context';
import { clearHeaderPlace, headerPlaceFor, setHeaderPlace } from './header-place';

/* The desktop bar's breadcrumb trail (Arthur, 16 October 2026: "I think it's
 * good", on the mock-ups). Pure rules first, then the wiring, pinned by source. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const SPACE = '6d3c8110-3b34-403a-aed5-bd669a52cf56';

const KNOWN: BreadcrumbData = {
  spaceName: 'Adeyemi chambers',
  tabLabel: 'Files',
  chatTitle: 'Lease review',
  chatSpace: { label: 'Adeyemi chambers', href: `/spaces/${SPACE}` },
  chatIsPersonal: false,
  channelName: 'general',
  channelIsThread: false,
  channelSpaceUuid: SPACE,
  channelSpaceName: 'Adeyemi chambers',
  caseTitle: 'Adeyemi v. Okafor',
  statuteTitle: 'Courts Act',
  sectionLabel: 'Section 1 · Application',
  folderName: 'Leases',
  folderParent: { uuid: 'f-parent', name: 'Property' },
  noteTitle: 'Notes on estoppel',
};

function shape(trail: BreadcrumbTrail | null) {
  assert.ok(trail);
  return trail.parts.map((part) => [part.label, part.href ?? null]);
}

/** Every part but the last links somewhere, Library never does, and the last never does. */
function assertLinks(trail: BreadcrumbTrail | null) {
  assert.ok(trail);
  const last = trail.parts.length - 1;
  trail.parts.forEach((part, index) => {
    if (index === last) assert.equal(part.href, undefined, 'the current page is not a link');
    else if (part.label === 'Library') assert.equal(part.href, undefined, 'there is no Library page');
    else assert.ok(part.href, `${part.label} links to its page`);
  });
}

test('a space on a tab: Spaces › the space › the tab', () => {
  const trail = breadcrumbTrail(`/spaces/${SPACE}`, KNOWN);
  assert.deepEqual(shape(trail), [
    ['Spaces', '/spaces'],
    ['Adeyemi chambers', `/spaces/${SPACE}`],
    ['Files', null],
  ]);
  assertLinks(trail);
  // The internal address carries the same trail.
  assert.deepEqual(breadcrumbTrail(`/v2/spaces/${SPACE}`, KNOWN), trail);
});

test('a chat in a space: Spaces › the space › the chat', () => {
  const trail = breadcrumbTrail('/c/abc', KNOWN);
  assert.deepEqual(shape(trail), [
    ['Spaces', '/spaces'],
    ['Adeyemi chambers', `/spaces/${SPACE}`],
    ['Lease review', null],
  ]);
  assertLinks(trail);
});

test('a personal chat: Conversations › the chat; an unplaced chat is not guessed', () => {
  const trail = breadcrumbTrail('/c/abc', { ...KNOWN, chatSpace: null, chatIsPersonal: true });
  assert.deepEqual(shape(trail), [
    ['Conversations', '/conversations'],
    ['Lease review', null],
  ]);
  assertLinks(trail);
  // Not yet known to be in a space or not: the first part is a skeleton.
  assert.deepEqual(shape(breadcrumbTrail('/c/abc', { ...KNOWN, chatSpace: null })), [
    [null, null],
    ['Lease review', null],
  ]);
  // A place wins over a stale personal flag.
  assert.equal(breadcrumbTrail('/c/abc', { ...KNOWN, chatIsPersonal: true })?.parts[0].label, 'Spaces');
});

test('find a space: Spaces › Find a space', () => {
  const trail = breadcrumbTrail('/spaces/discover', NO_BREADCRUMB_DATA);
  assert.deepEqual(shape(trail), [
    ['Spaces', '/spaces'],
    ['Find a space', null],
  ]);
  assertLinks(trail);
});

test('a team channel: Spaces › the space › # the channel; a thread takes no #', () => {
  const trail = breadcrumbTrail(`/channels/${SPACE}`, KNOWN);
  assert.deepEqual(shape(trail), [
    ['Spaces', '/spaces'],
    ['Adeyemi chambers', `/spaces/${SPACE}`],
    ['# general', null],
  ]);
  assertLinks(trail);
  const thread = breadcrumbTrail(`/channels/${SPACE}`, {
    ...KNOWN,
    channelName: 'Is the lease void?',
    channelIsThread: true,
  });
  assert.equal(thread?.parts.at(-1)?.label, 'Is the lease void?');
  assert.deepEqual(shape(breadcrumbTrail(`/channels/${SPACE}`, NO_BREADCRUMB_DATA)), [
    ['Spaces', '/spaces'],
    [null, null],
    [null, null],
  ]);
});

test('a folder: Library › Folders › the one parent › the folder', () => {
  const trail = breadcrumbTrail('/folders/f-1', KNOWN);
  assert.deepEqual(shape(trail), [
    ['Library', null],
    ['Folders', '/folders'],
    ['Property', '/folders/f-parent'],
    ['Leases', null],
  ]);
  assertLinks(trail);
  // A top-level folder has no parent part.
  const top = breadcrumbTrail('/folders/f-1', { ...KNOWN, folderParent: null });
  assert.deepEqual(shape(top), [
    ['Library', null],
    ['Folders', '/folders'],
    ['Leases', null],
  ]);
  assertLinks(top);
  // Before the folder lands, its name is a skeleton and no parent is shown.
  assert.deepEqual(shape(breadcrumbTrail('/folders/f-1', { ...KNOWN, folderName: null })), [
    ['Library', null],
    ['Folders', '/folders'],
    [null, null],
  ]);
});

test('a note: Library › Notes › the note', () => {
  const trail = breadcrumbTrail('/notes/estoppel', KNOWN);
  assert.deepEqual(shape(trail), [
    ['Library', null],
    ['Notes', '/notes'],
    ['Notes on estoppel', null],
  ]);
  assertLinks(trail);
  assert.equal(breadcrumbTrail('/notes/estoppel', NO_BREADCRUMB_DATA)?.parts.at(-1)?.label, null);
});

test('a statute: Library › Statutes › the statute', () => {
  const trail = breadcrumbTrail('/statutes/courts-act-1993', KNOWN);
  assert.deepEqual(shape(trail), [
    ['Library', null],
    ['Statutes', '/statutes'],
    ['Courts Act', null],
  ]);
  assertLinks(trail);
});

test('a statute section: Library › Statutes › the statute › the section', () => {
  const trail = breadcrumbTrail('/statutes/courts-act-1993/section-1', KNOWN);
  assert.deepEqual(shape(trail), [
    ['Library', null],
    ['Statutes', '/statutes'],
    ['Courts Act', '/statutes/courts-act-1993'],
    ['Section 1 · Application', null],
  ]);
  assertLinks(trail);
  // Until the document has parsed, the address's own label, never a guessed heading.
  const early = breadcrumbTrail('/statutes/courts-act-1993/section-54-2', {
    ...KNOWN,
    sectionLabel: null,
  });
  assert.equal(early?.parts.at(-1)?.label, 'Section 54(2)');
  // A segment that is not a citation is the statute itself; deeper is a 404.
  assert.equal(breadcrumbTrail('/statutes/courts-act-1993/whatever', KNOWN)?.parts.length, 3);
  assert.equal(breadcrumbTrail('/statutes/courts-act-1993/section-1/x', KNOWN), null);
});

test('a case: Library › Cases › the case', () => {
  const trail = breadcrumbTrail('/cases/adeyemi-v-okafor', KNOWN);
  assert.deepEqual(shape(trail), [
    ['Library', null],
    ['Cases', '/cases'],
    ['Adeyemi v. Okafor', null],
  ]);
  assertLinks(trail);
});

test('a name not known yet stays null, so it draws a skeleton', () => {
  assert.deepEqual(shape(breadcrumbTrail(`/spaces/${SPACE}`, NO_BREADCRUMB_DATA)), [
    ['Spaces', '/spaces'],
    [null, `/spaces/${SPACE}`],
    [null, null],
  ]);
  assert.equal(breadcrumbTrail('/cases/x', NO_BREADCRUMB_DATA)?.parts.at(-1)?.label, null);
  assert.equal(breadcrumbTrail('/statutes/x', NO_BREADCRUMB_DATA)?.parts.at(-1)?.label, null);
  const chat = breadcrumbTrail('/c/abc', { ...NO_BREADCRUMB_DATA, chatSpace: KNOWN.chatSpace });
  assert.equal(chat?.parts.at(-1)?.label, null);
});

test('every other address keeps the bar it had', () => {
  for (const path of [
    '/',
    '/work',
    '/spaces',
    `/spaces/${SPACE}/extra`,
    '/channels',
    `/channels/${SPACE}/extra`,
    '/cases',
    '/cases/x/report',
    '/statutes',
    '/c',
    '/c/abc/extra',
    '/folders',
    '/folders/abc/extra',
    '/notes',
    '/notes/mine',
    '/notes/create',
    '/notes/abc/edit',
  ]) {
    assert.equal(breadcrumbTrail(path, KNOWN), null, path);
    assert.deepEqual(trailRouteFor(path), { kind: 'none' }, path);
  }
});

test('a section heading joins its label, without its closing full stop', () => {
  assert.equal(provisionCrumbLabel('Section 1', 'Application.'), 'Section 1 · Application');
  assert.equal(provisionCrumbLabel('Section 54(2)', 'Powers of the court'), 'Section 54(2) · Powers of the court');
  assert.equal(provisionCrumbLabel('Section 3', ''), 'Section 3');
});

/* ── The wiring ───────────────────────────────────────────────────────────── */

test('the trail is desktop-only and only its last part truncates', () => {
  const view = read('v2', 'shell', 'V2Breadcrumb.tsx');
  // Nothing on a phone.
  assert.match(view, /<Breadcrumb className="hidden min-w-0 items-center gap-2 md:flex">/);
  assert.match(view, /<BreadcrumbList className="min-w-0 flex-nowrap/);
  // The last part is the page, and the only one that gives way.
  assert.match(
    view,
    /index === last \? \(\s*<BreadcrumbItem className="min-w-0">[\s\S]{0,200}?<BreadcrumbPage className="min-w-0 truncate px-1\.5 py-1 font-medium text-foreground">/,
  );
  assert.match(view, /<BreadcrumbItem className="shrink-0">/);
  assert.equal((view.match(/truncate/g) ?? []).length, 2, 'the docblock and the last part');
  // A name still on its way is a skeleton, never a link.
  assert.match(view, /part\.label === null \? \(\s*<CrumbSkeleton \/>\s*\) : part\.href \?/);
  // The chevrons are muted and quieter still.
  assert.match(view, /<BreadcrumbSeparator className="text-muted-foreground opacity-60">\s*<ChevronRight \/>/);
});

test('the trail reads the screens’ cache and never fetches', () => {
  const view = read('v2', 'shell', 'V2Breadcrumb.tsx');
  assert.match(view, /\.\.\.spacesQueries\.detail\(spaceUuid, \{ viewerId: session\.userId \}\),\s*enabled: false,/);
  assert.match(view, /\.\.\.statutesQueries\.detail\(slug\), enabled: false/);
  assert.match(view, /\.\.\.casesQueries\.detail\(slug, searchQuery\),\s*enabled: false,/);
  assert.match(view, /\.\.\.channelsQueries\.detail\(channelUuid, \{ viewerId \}\),\s*enabled: false,/);
  assert.match(view, /\.\.\.spacesQueries\.detail\(spaceUuid \?\? '', \{ viewerId \}\),\s*enabled: false,/);
  assert.match(view, /\.\.\.conversationsQueries\.detail\(\{ conversationId, viewerId \}\),\s*enabled: false,/);
  assert.match(view, /\.\.\.foldersQueries\.detail\(\{ uuid, viewerId \}\),\s*enabled: false,/);
  assert.match(view, /\.\.\.notesQueries\.detail\(\{ slug, viewerId \}\),\s*enabled: false,/);
  // Every read in the file is one of those.
  assert.equal((view.match(/useQuery\(/g) ?? []).length, 8);
  assert.equal((view.match(/enabled: false,?\s*\}\);/g) ?? []).length, 8);
  // `?q=` is read under a boundary.
  assert.match(view, /<Suspense fallback=\{pending \? <TrailView trail=\{pending\} \/> : null\}>\s*<CaseTrail/);
});

test('the bar hides its centre from md: only on a trail route', () => {
  const header = read('v2', 'shell', 'V2Header.tsx');
  assert.match(
    header,
    /const showsTrail = breadcrumbTrail\(path, NO_BREADCRUMB_DATA\) !== null;/,
  );
  assert.match(header, /showsTrail && 'md:grid-cols-\[minmax\(0,1fr\)_auto\]',/);
  assert.match(header, /'v2-safe-top grid h-14 grid-cols-\[1fr_auto_1fr\] items-center gap-2 px-3',/);
  assert.match(header, /hiddenFromMd=\{showsTrail\}/);
  assert.match(header, /<div className=\{cn\('grid min-w-0 place-items-center', hiddenFromMd && 'md:hidden'\)\}>/);
  // The trail takes the label's slot; elsewhere the label stays.
  assert.match(header, /\{showsTrail \? \(\s*<V2Breadcrumb[\s\S]{0,300}?\/>\s*\) : leftLabel \? \(/);
  assert.match(header, /crumb=\{screen\?\.crumb \?\? null\}/);
});

test('the space and the statute publish the part only they know', () => {
  const space = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
  assert.match(space, /const crumb = hasSpace \? SPACE_TAB_LABELS\[tab\] : null;/);
  assert.match(space, /setScreenContext\(\{ pathname, back: null, actions, crumb \}\);/);
  const statute = read('v2', 'features', 'statutes', 'reader', 'StatuteDocument.tsx');
  assert.match(statute, /\(\) => \(citation \? provisionCrumb\(sectionIndex, citation\) : null\),/);
  assert.match(statute, /setScreenContext\(\{ pathname, back: null, actions: NO_SCREEN_ACTIONS, crumb \}\);/);
  assert.match(statute, /useEffect\(\(\) => \(\) => clearScreenContext\(\), \[\]\);/);
  // An equal crumb is a no-op publish, like the rest of the context.
  assert.match(read('v2', 'shell', 'screen-context.ts'), /\(left\.crumb \?\? null\) === \(right\.crumb \?\? null\)/);
});

/* ── The checker's round (16 October 2026) ────────────────────────────────── */

test('a chat reads its title and place only while they were published for it', () => {
  // A tap from chat A publishes chat B's title while the address is still A.
  setHeaderContext({ title: 'Chat B', confidential: false }, 'b');
  const snapshot = snapshotHeaderContext();
  assert.deepEqual(headerContextFor(snapshot, 'b'), { title: 'Chat B', confidential: false });
  assert.deepEqual(headerContextFor(snapshot, 'a'), { title: null, confidential: false });
  // An unowned publish names no chat.
  setHeaderContext({ title: 'Folder', confidential: false });
  assert.equal(headerContextFor(snapshotHeaderContext(), 'b').title, null);
  clearHeaderContext();

  const place = { label: 'Adeyemi chambers', href: `/spaces/${SPACE}` };
  assert.deepEqual(headerPlaceFor({ place, owner: 'a' }, 'a'), place);
  assert.equal(headerPlaceFor({ place, owner: 'a' }, 'b'), null);
  assert.equal(headerPlaceFor({ place: null, owner: null }, 'a'), null);
  // The store's own owner rules still hold: another chat's clear leaves it.
  setHeaderPlace(place, 'a');
  clearHeaderPlace('b');
  clearHeaderPlace('a');
});

test('a blank folder name reads as the folder screen prints it', () => {
  assert.equal(folderDisplayName('  Leases '), 'Leases');
  assert.equal(folderDisplayName('   '), UNTITLED_FOLDER_NAME);
  assert.equal(folderDisplayName(null), UNTITLED_FOLDER_NAME);
  const rows = read('v2', 'features', 'folders', 'folder-row-model.ts');
  assert.match(rows, /name: folderDisplayName\(record\.name\),/);
  const view = read('v2', 'shell', 'V2Breadcrumb.tsx');
  assert.match(view, /folderName: folder \? folderDisplayName\(folder\.name\) : null,/);
  assert.match(view, /name: folderDisplayName\(parent\.name\)/);
});

test('a read that can never name its part draws no trail', () => {
  assert.equal(crumbResolves({ isError: false, hasData: false }), true, 'still loading: skeleton');
  assert.equal(crumbResolves({ isError: false, hasData: true }), true);
  assert.equal(crumbResolves({ isError: true, hasData: false }), false, 'refused');
  assert.equal(crumbResolves({ isError: true, hasData: true }), true, 'a failed refetch keeps its page');
  assert.equal(crumbResolves({ isError: false, hasData: false }, false), false, 'never asked for');
});

test('each trail checks its read and the visitor before it draws', () => {
  const view = read('v2', 'shell', 'V2Breadcrumb.tsx');
  const body = (name: string) => view.slice(view.indexOf(`function ${name}(`), view.indexOf('\nfunction ', view.indexOf(`function ${name}(`) + 1));
  for (const name of ['FolderTrail', 'NoteTrail', 'StatuteTrail']) {
    assert.match(body(name), /if \(!crumbResolves\(\{ isError, hasData: data !== undefined \}, signedIn\)\) return null;/, name);
  }
  assert.match(body('CaseTrail'), /if \(!crumbResolves\(\{ isError, hasData: data !== undefined \}\)\) return null;/);
  assert.match(body('SpaceTrail'), /const allowed = collabAccessState\(session\) === 'eligible';/);
  assert.match(body('SpaceTrail'), /if \(!crumbResolves\(\{ isError, hasData: data !== undefined \}, allowed\)\) return null;/);
  const channel = body('ChannelTrail');
  assert.match(channel, /crumbResolves\(\{ isError: channelRead\.isError, hasData: channel !== null \}, allowed\)/);
  assert.match(channel, /crumbResolves\(\{ isError: spaceRead\.isError, hasData: spaceRead\.data !== undefined \}\)/);
  // The channel's space comes from its own record, never the unguarded collab publish.
  assert.doesNotMatch(channel, /collab\?\.|collab\./);
  assert.match(channel, /channelSpaceUuid: spaceUuid,/);
  const chat = body('ChatTrail');
  assert.match(chat, /const \{ title: chatTitle, confidential \} = useHeaderContextFor\(conversationId\);/);
  assert.match(chat, /const chatSpace = useHeaderPlaceFor\(conversationId\);/);
  assert.match(chat, /if \(!confidential && !crumbResolves\(\{ isError, hasData: data !== undefined \}\)\) return null;/);
  // The header hands the trail no unguarded chat values.
  const header = read('v2', 'shell', 'V2Header.tsx');
  assert.match(header, /<V2Breadcrumb\s*pathname=\{path\}\s*collab=\{collab\}\s*crumb=\{screen\?\.crumb \?\? null\}\s*\/>/);
});

test('the folder page drops its own trail where the bar carries one', () => {
  const crumb = read('v2', 'features', 'folders', 'detail', 'FolderBreadcrumb.tsx');
  // `sm:` to `md:` only: from `md:` the bar's trail says the same thing.
  assert.match(crumb, /<nav aria-label="Breadcrumb" className="hidden sm:block md:hidden">/);
});

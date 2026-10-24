import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EMPTY_PAGE_CAP,
  FILES_CARD_LIMIT,
  canScrollForMore,
  emptyPagesInARow,
  filesCard,
  followEmptyCursor,
  membersLine,
  moreFilesLabel,
  spaceFacts,
  timelineDays,
  timelineRow,
  tintIndex,
} from './row-model';
import type { TimelineActor, TimelineEnvelope, TimelineEvent, TimelineFileItem, TimelineSpace } from './types';

/* Events shaped like the contract agreed with Backend (24 October 2026), with
 * the mock's own people and Spaces (`timeline-final/mocks3.html`). */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const screen = read('v2', 'features', 'home-timeline', 'HomeTimeline.tsx');

const NOW = Date.parse('2026-10-24T12:00:00Z');

const person = (id: number, name: string, extra: Partial<TimelineActor> = {}): TimelineActor => ({
  id,
  name,
  avatar: null,
  kind: 'user',
  is_you: false,
  ...extra,
});
const tunde = person(3, 'Tunde Musa');
const ada = person(1, 'Ada Okafor');
const kemi = person(2, 'Kemi Bello');
const you = person(9, 'Bola Test', { is_you: true });
const lawexa: TimelineActor = { id: 'ai', name: 'Lawexa', avatar: null, kind: 'ai', is_you: false };

const space = (name: string, extra: Partial<TimelineSpace> = {}): TimelineSpace => ({
  uuid: `uuid-${name.length}`,
  name,
  type: 'work',
  visibility: 'private',
  member_count: 4,
  ...extra,
});
const appeal = space('Adeyemi appeal');
const gray = space('Gray Partners');
const lease = space('Ikoyi lease');
const lekki = space('Lekki land');

const file = (id: number, name: string, mime: string, bytes: number): TimelineFileItem => ({
  id,
  name,
  kind: 'document',
  mime_type: mime,
  size_bytes: bytes,
  url: `/files/${id}`,
});
const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();

function event(fields: Partial<TimelineEvent> & Pick<TimelineEvent, 'kind'>): TimelineEvent {
  return {
    id: `e-${fields.kind}`,
    at: at(12),
    actor: tunde,
    space: appeal,
    count: 1,
    items: [],
    ...fields,
  } as TimelineEvent;
}

const row = (fields: Partial<TimelineEvent> & Pick<TimelineEvent, 'kind'>) => {
  const built = timelineRow(event(fields), NOW);
  assert.ok(built, `a ${fields.kind} event draws a row`);
  return built;
};

test('one file added: the file is the row, its type, size, who and where under it', () => {
  const r = row({ kind: 'files_added', items: [file(1, 'Record of appeal.pdf', PDF, 4.8 * 1024 * 1024)] });
  assert.equal(r.title, 'Record of appeal.pdf');
  assert.equal(r.meta, 'PDF · 4.8 MB · Tunde Musa · Adeyemi appeal');
  assert.deepEqual(r.lead, { type: 'icon', icon: 'document' });
  assert.equal(r.time, '12m');
  assert.equal(r.card, null);
});

test('a Word file says Word and its size in whole KB', () => {
  const r = row({ kind: 'files_added', actor: ada, space: lease, items: [file(2, 'Deed of assignment (draft 2).docx', DOCX, 118 * 1024)] });
  assert.equal(r.meta, 'Word · 118 KB · Ada Okafor · Ikoyi lease');
});

test('several files: "<who> added N files", the Space on the grey line, with the files card', () => {
  const items = [
    file(1, 'SPA v3 (signed).pdf', PDF, 1.2 * 1024 * 1024),
    file(2, 'Disclosure letter.pdf', PDF, 840 * 1024),
    file(3, 'Board minutes, 14 October.docx', DOCX, 96 * 1024),
  ];
  const r = row({ kind: 'files_added', actor: ada, space: gray, count: 3, items });
  assert.equal(r.title, 'Ada Okafor added 3 files');
  assert.equal(r.meta, 'Gray Partners');
  assert.deepEqual(r.lead, { type: 'icon', icon: 'files' });
  assert.deepEqual(r.card, {
    type: 'files',
    files: [
      { key: '1', name: 'SPA v3 (signed).pdf', icon: 'document', size: '1.2 MB' },
      { key: '2', name: 'Disclosure letter.pdf', icon: 'document', size: '840 KB' },
      { key: '3', name: 'Board minutes, 14 October.docx', icon: 'document', size: '96 KB' },
    ],
    more: 0,
  });
});

test('the files card lists three, then "and N more" against the whole count', () => {
  const five = [1, 2, 3, 4, 5].map((id) => file(id, `File ${id}.pdf`, PDF, 1024));
  const card = filesCard(five, 12);
  assert.equal(FILES_CARD_LIMIT, 3);
  assert.ok(card.type === 'files');
  assert.deepEqual(card.files.map((f) => f.name), ['File 1.pdf', 'File 2.pdf', 'File 3.pdf']);
  assert.equal(card.more, 9);
  assert.equal(moreFilesLabel(card.more), 'and 9 more');
  // Exactly three: no "more" line at all.
  const three = filesCard(five.slice(0, 3), 3);
  assert.ok(three.type === 'files');
  assert.equal(three.more, 0);
  assert.equal(moreFilesLabel(three.more), '');
  // Four sent with a count of four: one more.
  const four = filesCard(five.slice(0, 4), 4);
  assert.ok(four.type === 'files');
  assert.equal(moreFilesLabel(four.more), 'and 1 more');
});

test('an image, a video and a recording lead with their own icons', () => {
  const image = row({ kind: 'files_added', items: [{ ...file(1, 'Site.jpg', 'image/jpeg', 2048), kind: 'image' }] });
  assert.deepEqual(image.lead, { type: 'icon', icon: 'image' });
  const video = row({ kind: 'files_added', items: [{ ...file(1, 'Site visit.mp4', 'video/mp4', 2048), kind: 'video' }] });
  assert.deepEqual(video.lead, { type: 'icon', icon: 'video' });
  assert.match(video.meta, /^Video · /);
  const audio = row({ kind: 'files_added', items: [{ ...file(1, 'Hearing.mp3', 'audio/mpeg', 2048), kind: 'audio' }] });
  assert.deepEqual(audio.lead, { type: 'icon', icon: 'audio' });
  assert.match(audio.meta, /^Audio · /);
  // Film and Music, in the screen's icon map.
  assert.match(screen, /video: Film,\s*audio: Music,/);
});

test('a folder: its name, then its count, who and where', () => {
  const r = row({
    kind: 'folder_created',
    actor: ada,
    space: lease,
    items: [{ id: 'f-uuid', name: 'Title documents', url: '', item_count: 3 }],
  });
  assert.equal(r.title, 'Title documents');
  assert.equal(r.meta, '3 items · Ada Okafor · Ikoyi lease');
  assert.equal(r.href, '/folders/f-uuid');
  // The server's `url` is absolute; the row goes by the folder's uuid.
  const one = row({
    kind: 'folder_created',
    items: [{ id: 'abc', name: 'Briefs', url: 'https://demo.lawexa.com/folders/abc', item_count: 1 }],
  });
  assert.equal(one.meta, '1 item · Tunde Musa · Adeyemi appeal');
  assert.equal(one.href, '/folders/abc');
});

test('several folders in one hour: "<who> created N folders", listed in the files card', () => {
  const r = row({
    kind: 'folder_created',
    actor: ada,
    space: lease,
    count: 2,
    items: [
      { id: 'f-1', name: 'Disputes', url: '', item_count: 1 },
      { id: 'f-2', name: 'Leases', url: '', item_count: 4 },
    ],
  });
  assert.equal(r.title, 'Ada Okafor created 2 folders');
  assert.equal(r.meta, 'Ikoyi lease');
  assert.equal(r.href, `/spaces/${lease.uuid}?tab=folders`);
  assert.deepEqual(r.card, {
    type: 'files',
    files: [
      { key: 'f-1', name: 'Disputes', icon: 'folder', size: '1 item' },
      { key: 'f-2', name: 'Leases', icon: 'folder', size: '4 items' },
    ],
    more: 0,
  });
});

test('a deleted account is "Someone", with a grey person and no face', () => {
  const reply = row({ kind: 'reply', actor: null, conversation: { uuid: 'c', title: 'T' }, excerpt: 'Hi' });
  assert.equal(reply.title, 'Someone replied to you');
  assert.deepEqual(reply.lead, { type: 'icon', icon: 'person' });
  const joined = row({ kind: 'member_joined', actor: null });
  assert.equal(joined.title, 'Someone joined Adeyemi appeal');
  // Lawexa with no agent: a null id, the name "Lawexa", the mark.
  const answered = row({
    kind: 'lawexa_answered',
    actor: { id: null, name: 'Lawexa', avatar: null, kind: 'ai', is_you: false },
    asked_by: null,
    items: [{ id: 'c', title: 'Q', url: '' }],
  });
  assert.deepEqual(answered.lead, { type: 'lawexa' });
  assert.equal(answered.title, 'Lawexa answered');
});

test('a chat started: its title, then who and where', () => {
  const r = row({ kind: 'chat_started', items: [{ id: 'c-1', title: 'Fair hearing points', url: '' }] });
  assert.equal(r.title, 'Fair hearing points');
  assert.equal(r.meta, 'Tunde Musa · Adeyemi appeal');
  assert.deepEqual(r.lead, { type: 'icon', icon: 'chat' });
  assert.equal(r.href, '/c/c-1');
});

test('Lawexa answered: the mark, whom it answered, and the chat card with who asked', () => {
  const r = row({
    kind: 'lawexa_answered',
    actor: lawexa,
    space: gray,
    asked_by: kemi,
    items: [{ id: 'c-2', title: 'Can completion wait for the Governor’s consent?', url: '' }],
  });
  assert.equal(r.title, 'Lawexa answered Kemi Bello');
  assert.equal(r.meta, 'Gray Partners');
  assert.deepEqual(r.lead, { type: 'lawexa' });
  assert.deepEqual(r.card, {
    type: 'chat',
    title: 'Can completion wait for the Governor’s consent?',
    meta: 'Kemi Bello asked',
    href: '/c/c-2',
  });
  const mine = row({ kind: 'lawexa_answered', actor: lawexa, asked_by: you, items: [{ id: 'c-3', title: 'Q', url: '' }] });
  assert.equal(mine.title, 'Lawexa answered you');
  assert.ok(mine.card?.type === 'chat');
  assert.equal(mine.card.meta, 'You asked');
});

test('someone joined: "<who> joined <Space>", what the Space is under it', () => {
  const r = row({ kind: 'member_joined', actor: kemi, space: lease });
  assert.equal(r.title, 'Kemi Bello joined Ikoyi lease');
  assert.equal(r.meta, 'Work · Private · 4 members');
  assert.deepEqual(r.lead, { type: 'icon', icon: 'joined' });
  assert.equal(r.href, `/spaces/${lease.uuid}?tab=people`);
});

test('a reply: the face, "replied to you", the chat and Space, the words in a quote card', () => {
  const r = row({
    kind: 'reply',
    actor: kemi,
    space: gray,
    conversation: { uuid: 'c-9', title: 'Completion checklist' },
    excerpt: 'Can you confirm the escrow date before Friday? The buyer’s bank wants it in writing.',
  });
  assert.equal(r.title, 'Kemi Bello replied to you');
  assert.equal(r.meta, 'Completion checklist · Gray Partners');
  assert.deepEqual(r.lead, { type: 'person', name: 'Kemi Bello', avatar: null, tint: tintIndex(2) });
  assert.deepEqual(r.card, {
    type: 'quote',
    text: 'Can you confirm the escrow date before Friday? The buyer’s bank wants it in writing.',
    replyHref: '/c/c-9',
  });
  assert.equal(r.href, '/c/c-9');
});

test('a mention reads "mentioned you"; without words it has no card', () => {
  const r = row({ kind: 'mention', actor: ada, conversation: { uuid: 'c-1', title: 'Fair hearing points' }, excerpt: '  ' });
  assert.equal(r.title, 'Ada Okafor mentioned you');
  assert.equal(r.meta, 'Fair hearing points · Adeyemi appeal');
  assert.equal(r.card, null);
});

test('an invitation: who invited you, who is in it, and the invite card with its member-row id', () => {
  const r = row({
    kind: 'invite',
    space: lekki,
    needs_action: true,
    action: { type: 'accept', target: { type: 'space_invite', id: 41 } },
    members_preview: ['Ada Okafor', 'Kemi Bello'],
  });
  assert.equal(r.title, 'Tunde Musa invited you to a Space');
  assert.equal(r.meta, 'Ada Okafor, Kemi Bello and 2 others are in it');
  assert.deepEqual(r.lead, { type: 'icon', icon: 'invite' });
  assert.equal(r.href, null);
  assert.deepEqual(r.card, { type: 'invite', spaceName: 'Lekki land', facts: 'Work · Private · 4 members', invitationId: 41 });
  // A string id of digits is the same id; anything else gives no buttons.
  const stringId = row({ kind: 'invite', needs_action: true, action: { type: 'accept', target: { type: 'space_invite', id: '41' } } });
  assert.ok(stringId.card?.type === 'invite');
  assert.equal(stringId.card.invitationId, 41);
  const answered = row({ kind: 'invite', action: { type: 'accept', target: { type: 'space_invite', id: 41 } } });
  assert.ok(answered.card?.type === 'invite');
  assert.equal(answered.card.invitationId, null);
});

test('who is in it, at every count', () => {
  assert.equal(membersLine(['Ada Okafor', 'Kemi Bello'], 4), 'Ada Okafor, Kemi Bello and 2 others are in it');
  assert.equal(membersLine(['Ada Okafor', 'Kemi Bello'], 3), 'Ada Okafor, Kemi Bello and 1 other are in it');
  assert.equal(membersLine(['Ada Okafor', 'Kemi Bello'], 2), 'Ada Okafor and Kemi Bello are in it');
  assert.equal(membersLine(['Ada Okafor'], 1), 'Ada Okafor is in it');
  assert.equal(membersLine([], 1), '1 person is in it');
  assert.equal(membersLine([], 5), '5 people are in it');
});

test('what a Space is, in one line', () => {
  assert.equal(spaceFacts(space('x', { type: 'study', visibility: 'public', member_count: 1 })), 'Study · Public · 1 member');
});

test('a join request and a role request are plain rows to the Space’s people', () => {
  const join = row({ kind: 'join_request', actor: ada, space: lease, needs_action: true });
  assert.equal(join.title, 'Ada Okafor asked to join Ikoyi lease');
  assert.equal(join.href, `/spaces/${lease.uuid}?tab=people`);
  assert.equal(join.card, null);
  const role = row({ kind: 'role_request', actor: kemi, space: lease, needs_action: true });
  assert.equal(role.title, 'Kemi Bello asked for a new role in Ikoyi lease');
  assert.equal(role.card, null);
});

test('the reader is "You"', () => {
  const r = row({ kind: 'chat_started', actor: you, items: [{ id: 'c', title: 'T', url: '' }] });
  assert.equal(r.meta, 'You · Adeyemi appeal');
});

test('a kind this screen does not know, or an event missing its item, draws nothing', () => {
  assert.equal(timelineRow(event({ kind: 'poll_closed' as TimelineEvent['kind'] }), NOW), null);
  assert.equal(timelineRow(event({ kind: 'chat_started', items: [] }), NOW), null);
  assert.equal(timelineRow(event({ kind: 'reply' }), NOW), null);
});

test('no time until the clock is known', () => {
  const r = timelineRow(event({ kind: 'member_joined' }), null);
  assert.equal(r?.time, '');
});

test('a face keeps its tint from its id', () => {
  assert.equal(tintIndex(2), tintIndex(2));
  assert.equal(tintIndex(10), 2);
  assert.ok(tintIndex('abc') >= 0 && tintIndex('abc') < 8);
});

test('days are cut at the viewer’s midnight, not the server’s', () => {
  // 00:30 on 24 October in Lagos (UTC+1) is 23:30 on 23 October in UTC.
  const now = Date.parse('2026-10-24T09:00:00Z');
  const events = [
    event({ kind: 'member_joined', id: 'a', at: '2026-10-24T08:00:00Z' }),
    event({ kind: 'member_joined', id: 'b', at: '2026-10-23T23:30:00Z' }),
    event({ kind: 'member_joined', id: 'c', at: '2026-10-23T22:30:00Z' }),
    event({ kind: 'member_joined', id: 'd', at: '2026-10-20T10:00:00Z' }),
    event({ kind: 'member_joined', id: 'e', at: '2025-12-31T10:00:00Z' }),
  ];
  const lagos = timelineDays(events, now, 'Africa/Lagos');
  assert.deepEqual(
    lagos.map((day) => [day.label, day.rows.map((r) => r.key)]),
    [
      ['Today', ['a', 'b']],
      ['Yesterday', ['c']],
      ['20 Oct', ['d']],
      ['31 Dec 2025', ['e']],
    ],
  );
  const utc = timelineDays(events, now, 'UTC');
  assert.deepEqual(
    utc.map((day) => [day.label, day.rows.map((r) => r.key)]),
    [
      ['Today', ['a']],
      ['Yesterday', ['b', 'c']],
      ['20 Oct', ['d']],
      ['31 Dec 2025', ['e']],
    ],
  );
});

test('an event seen on two pages is drawn once; an unreadable time is left out', () => {
  const now = Date.parse('2026-10-24T09:00:00Z');
  const once = event({ kind: 'member_joined', id: 'x', at: '2026-10-24T08:00:00Z' });
  const days = timelineDays([once, once, event({ kind: 'member_joined', id: 'y', at: 'not a date' })], now, 'UTC');
  assert.deepEqual(days.map((day) => day.rows.map((r) => r.key)), [['x']]);
});

test('empty pages with a cursor are followed, five in a row at most', () => {
  const full = { events: [1] };
  const empty = { events: [] };
  assert.equal(emptyPagesInARow([full, empty, empty]), 2);
  assert.equal(followEmptyCursor([empty], true), true);
  assert.equal(followEmptyCursor([full, empty, empty, empty, empty], true), true);
  assert.equal(EMPTY_PAGE_CAP, 5);
  assert.equal(followEmptyCursor([empty, empty, empty, empty, empty], true), false);
  assert.equal(canScrollForMore([empty, empty, empty, empty, empty], true), false);
  // No cursor: nothing to follow. A page with events: the scroll asks.
  assert.equal(followEmptyCursor([empty], false), false);
  assert.equal(followEmptyCursor([full], true), false);
  assert.equal(canScrollForMore([full], true), true);
  // The screen shows its skeleton, not the empty state, while it follows.
  assert.match(screen, /days\.length === 0 && following\) \{\s*body = <TimelineSkeleton \/>;/);
});

test('every event of the backend local page (user 3, work) gives a row', () => {
  const envelope = JSON.parse(read('v2', 'features', 'home-timeline', 'timeline-work.fixture.json')) as TimelineEnvelope;
  const events = envelope.data.events;
  assert.equal(events.length, 6);
  assert.equal(typeof envelope.data.next_cursor, 'string');
  const now = Date.parse('2026-10-24T00:00:00Z');
  const rows = events.map((e) => timelineRow(e, now));
  assert.ok(rows.every((r) => r !== null));
  const gray = 'TEST DATA Gray Partners LP · Property Acquisition and Lease Review';
  assert.deepEqual(
    rows.map((r) => [r?.title, r?.meta]),
    [
      ['test-data-loose-file.pdf', 'PDF · 636 B · You · TEST DATA loose files only'],
      ['You joined TEST DATA loose files only', 'Work · Private · 1 member'],
      [`Case Timing Researcher joined ${gray}`, 'Work · Private · 2 members'],
      ['You added 4 files', gray],
      ['You created 2 folders', gray],
      [`You joined ${gray}`, 'Work · Private · 2 members'],
    ],
  );
  const files = rows[3]?.card;
  assert.ok(files?.type === 'files');
  assert.equal(files.files.length, 3);
  assert.equal(moreFilesLabel(files.more), 'and 1 more');
  // 23 and 22 October, read on 24 October in UTC: two days.
  const days = timelineDays(events, now, 'UTC');
  assert.deepEqual(days.map((day) => [day.label, day.rows.length]), [['Yesterday', 2], ['22 Oct', 4]]);
});

/* Source pins. */

test('gold is only on Accept', () => {
  // The accent appears once, as the default (primary) Button that says Accept.
  assert.doesNotMatch(screen, /text-primary\b|bg-primary\b|border-primary|ring-primary|primary\//);
  const buttons = screen.match(/<Button[\s\S]*?<\/Button>/g) ?? [];
  assert.equal(buttons.length, 2);
  const [accept, decline] = buttons;
  assert.match(accept, /Accept\s*<\/Button>$/);
  assert.doesNotMatch(accept, /variant=/);
  assert.match(decline, /variant="outline"/);
  assert.match(decline, /Decline\s*<\/Button>$/);
  // Reply is a quiet text button, never the accent.
  assert.match(screen, /const QUIET_BUTTON = cn\(\s*'[^']*text-muted-foreground/);
  // Every lead is grey (or the mark, or a face).
  assert.match(screen, /className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"/);
});

test('one card style, and the hairline inset to the title column between rows only', () => {
  assert.match(screen, /const CARD = 'rounded-2xl border border-border bg-card px-3\.5 py-3';/);
  assert.equal((screen.match(/rounded-2xl/g) ?? []).length, 1);
  assert.match(screen, /not-first:before:left-11 not-first:before:h-px not-first:before:bg-border\/40/);
  // The card sits under the title column, the full width of it.
  assert.match(screen, /<div className="pr-3 pb-2\.5 pl-11">\s*<RowCard card=\{row\.card\} \/>/);
});

test('the clock is read once and only used after hydration', () => {
  assert.match(screen, /const \[clock\] = useState\(\(\) => Date\.now\(\)\);/);
  assert.match(screen, /pages && mounted \? timelineDays\(/);
  // The sentinel is rooted in the shell's scroller.
  assert.match(screen, /rootRef: scrollRootRef,/);
});

test('the Work and Study tabs draw the timeline when signed in', () => {
  for (const [home, type] of [['WorkHome.tsx', 'work'], ['StudyHome.tsx', 'study']]) {
    const source = read('v2', 'shell', 'designs', home);
    assert.match(source, new RegExp(`if \\(signedIn\\) \\{[\\s\\S]*?<HomeTimeline type="${type}" />`), home);
  }
  const fallback = read('v2', 'shell', 'designs', 'HomeFallback.tsx');
  assert.match(fallback, /<TimelineHeading type=\{tab\} \/>\s*<TimelineSkeleton \/>/);
});

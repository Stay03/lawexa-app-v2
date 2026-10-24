import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lastSeenKey, parseLastSeen } from './last-seen';
import {
  EMPTY_PAGE_CAP,
  FILES_CARD_LIMIT,
  canScrollForMore,
  chatKey,
  emptyPagesInARow,
  fileFacts,
  filesCard,
  followEmptyCursor,
  membersLine,
  moreFilesLabel,
  newestAt,
  newSinceRowKey,
  shortName,
  spaceFacts,
  timelineDays,
  timelineRow,
  type TimelineRow,
} from './row-model';
import type { TimelineActor, TimelineEnvelope, TimelineEvent, TimelineFileItem, TimelineSpace } from './types';

/* Events shaped like Backend's timeline (the local page in
 * `timeline-work.fixture.json`, 24 October 2026, and the fields Backend
 * confirmed on 25 October), with the mock's own people and Spaces
 * (`timeline-final/mocks3.html`). */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const screen = read('v2', 'features', 'home-timeline', 'HomeTimeline.tsx');
const states = read('v2', 'features', 'home-timeline', 'states.tsx');

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
const banner = person(4, 'Banner');
const you = person(9, 'Bola Test', { is_you: true });
const lawexa: TimelineActor = { id: null, name: 'Lawexa', avatar: null, kind: 'ai', is_you: false };

const space = (name: string, extra: Partial<TimelineSpace> = {}): TimelineSpace => ({
  uuid: `uuid-${name.replace(/\s+/g, '-').toLowerCase()}`,
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

const file = (id: number, name: string, mime: string, pages: number | null = null): TimelineFileItem => ({
  id,
  name,
  kind: 'document',
  mime_type: mime,
  size_bytes: 1024,
  url: `https://demo.lawexa.com/spaces/x?tab=files&file=${id}`,
  page_count: pages,
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

const row = (fields: Partial<TimelineEvent> & Pick<TimelineEvent, 'kind'>, messages = 1) => {
  const built = timelineRow(event(fields), NOW, messages);
  assert.ok(built, `a ${fields.kind} event draws a row`);
  return built;
};

/** The grey line as the reader sees it. */
const line = (r: TimelineRow) => {
  if (!r.meta.space) return r.meta.rest;
  return r.meta.rest ? `${r.meta.space.name} · ${r.meta.rest}` : r.meta.space.name;
};

/* ── Fix 6: who did what, first names ─────────────────────────────────────── */

test('who: "You" for the reader, a first name, a one-word name whole, "Someone" for no account', () => {
  assert.equal(shortName(you), 'You');
  assert.equal(shortName(kemi), 'Kemi');
  assert.equal(shortName(banner), 'Banner');
  assert.equal(shortName(person(5, '  Case  Timing Researcher ')), 'Case');
  assert.equal(shortName(null), 'Someone');
  assert.equal(shortName(lawexa), 'Lawexa');
});

/* ── Fixes 3, 6, 7: titles and grey lines ─────────────────────────────────── */

test('one file: "<who> added <file>", the Space then its type and pages', () => {
  const r = row({ kind: 'files_added', items: [file(1, 'Record of appeal.pdf', PDF, 4)] });
  assert.equal(r.title, 'Tunde added Record of appeal.pdf');
  assert.equal(line(r), 'Adeyemi appeal · PDF · 4 pages');
  assert.deepEqual(r.meta.space, { name: 'Adeyemi appeal', href: '/spaces/uuid-adeyemi-appeal' });
  assert.equal(r.time, '12m');
  assert.equal(r.card, null);
});

test('pages, not bytes; the type alone when the pages are unknown', () => {
  assert.equal(fileFacts(file(1, 'a.pdf', PDF, 1)), 'PDF · 1 page');
  assert.equal(fileFacts(file(1, 'a.pdf', PDF, 12)), 'PDF · 12 pages');
  assert.equal(fileFacts(file(1, 'Deed.docx', DOCX, null)), 'Word');
  assert.equal(fileFacts({ name: 'Deed.docx', mime_type: DOCX }), 'Word');
  assert.equal(fileFacts(file(1, 'a.pdf', PDF, 0)), 'PDF');
  const r = row({ kind: 'files_added', items: [file(1, 'Record of appeal.pdf', PDF, null)] });
  assert.doesNotMatch(line(r), /\b(B|KB|MB)\b/);
});

test('several files: "<who> added N files", the Space alone, the files card with type and pages', () => {
  const items = [
    file(1, 'SPA v3 (signed).pdf', PDF, 18),
    file(2, 'Disclosure letter.pdf', PDF, 3),
    file(3, 'Board minutes, 14 October.docx', DOCX),
  ];
  const r = row({ kind: 'files_added', actor: kemi, space: gray, count: 3, items });
  assert.equal(r.title, 'Kemi added 3 files');
  assert.equal(line(r), 'Gray Partners');
  assert.deepEqual(r.card, {
    type: 'files',
    files: [
      { key: '1', name: 'SPA v3 (signed).pdf', icon: 'document', size: 'PDF · 18 pages' },
      { key: '2', name: 'Disclosure letter.pdf', icon: 'document', size: 'PDF · 3 pages' },
      { key: '3', name: 'Board minutes, 14 October.docx', icon: 'document', size: 'Word' },
    ],
    more: 0,
  });
});

test('the files card lists three, then "and N more" against the whole count', () => {
  const five = [1, 2, 3, 4, 5].map((id) => file(id, `File ${id}.pdf`, PDF));
  const card = filesCard(five, 12);
  assert.equal(FILES_CARD_LIMIT, 3);
  assert.ok(card.type === 'files');
  assert.deepEqual(card.files.map((f) => f.name), ['File 1.pdf', 'File 2.pdf', 'File 3.pdf']);
  assert.equal(card.more, 9);
  assert.equal(moreFilesLabel(card.more), 'and 9 more');
  const three = filesCard(five.slice(0, 3), 3);
  assert.ok(three.type === 'files');
  assert.equal(moreFilesLabel(three.more), '');
  const four = filesCard(five.slice(0, 4), 4);
  assert.ok(four.type === 'files');
  assert.equal(moreFilesLabel(four.more), 'and 1 more');
});

test('an image, a video and a recording keep their own icons inside the files card', () => {
  const items: TimelineFileItem[] = [
    { ...file(1, 'Site.jpg', 'image/jpeg'), kind: 'image' },
    { ...file(2, 'Site visit.mp4', 'video/mp4'), kind: 'video' },
    { ...file(3, 'Hearing.mp3', 'audio/mpeg'), kind: 'audio' },
  ];
  const card = filesCard(items, 3);
  assert.ok(card.type === 'files');
  assert.deepEqual(card.files.map((f) => [f.icon, f.size]), [['image', 'Image'], ['video', 'Video'], ['audio', 'Audio']]);
  assert.match(screen, /video: Film,\s*audio: Music,/);
});

test('a folder: "<who> made <folder>", the Space then its count; by uuid', () => {
  const r = row({
    kind: 'folder_created',
    actor: ada,
    space: lease,
    items: [{ id: 'f-uuid', name: 'Title documents', url: 'https://demo.lawexa.com/folders/f-uuid', item_count: 3 }],
  });
  assert.equal(r.title, 'Ada made Title documents');
  assert.equal(line(r), 'Ikoyi lease · Folder · 3 items');
  assert.equal(r.href, '/folders/f-uuid');
});

test('several folders: "You made 2 folders", listed in the files card', () => {
  const r = row({
    kind: 'folder_created',
    actor: you,
    space: lease,
    count: 2,
    items: [
      { id: 'f-1', name: 'Disputes', url: '', item_count: 1 },
      { id: 'f-2', name: 'Leases', url: '', item_count: 4 },
    ],
  });
  assert.equal(r.title, 'You made 2 folders');
  assert.equal(line(r), 'Ikoyi lease');
  assert.equal(r.href, '/spaces/uuid-ikoyi-lease?tab=folders');
  assert.deepEqual(r.card, {
    type: 'files',
    files: [
      { key: 'f-1', name: 'Disputes', icon: 'folder', size: '1 item' },
      { key: 'f-2', name: 'Leases', icon: 'folder', size: '4 items' },
    ],
    more: 0,
  });
});

test('a chat started: "<who> started a chat", the Space then the question (or the title)', () => {
  const r = row({ kind: 'chat_started', actor: banner, items: [{ id: 'c-1', title: 'Fair hearing points', url: '' }] });
  assert.equal(r.title, 'Banner started a chat');
  assert.equal(line(r), 'Adeyemi appeal · Fair hearing points');
  assert.equal(r.href, '/c/c-1');
  const asked = row({
    kind: 'chat_started',
    items: [{ id: 'c-1', title: 'Fair hearing', url: '', question: 'Was the hearing fair?' }],
  });
  assert.equal(line(asked), 'Adeyemi appeal · Was the hearing fair?');
});

test('Lawexa answered: the mark, whom it answered, the question then the start of the answer', () => {
  const r = row({
    kind: 'lawexa_answered',
    actor: lawexa,
    space: gray,
    asked_by: kemi,
    items: [
      {
        id: 'c-2',
        title: 'Completion checklist',
        url: '',
        question: 'Can completion wait for the Governor’s consent?',
        answer_preview: 'Yes, but only if the contract says so…',
      },
    ],
  });
  assert.equal(r.title, 'Lawexa answered Kemi');
  assert.equal(line(r), 'Gray Partners');
  assert.deepEqual(r.lead, { type: 'lawexa' });
  assert.deepEqual(r.card, {
    type: 'chat',
    question: 'Can completion wait for the Governor’s consent?',
    answer: 'Yes, but only if the contract says so…',
    href: '/c/c-2',
  });
  // No question or answer from the server: the chat's title, and no answer line.
  const bare = row({
    kind: 'lawexa_answered',
    actor: lawexa,
    asked_by: you,
    items: [{ id: 'c-3', title: 'Completion checklist', url: '', question: null, answer_preview: null }],
  });
  assert.equal(bare.title, 'Lawexa answered you');
  assert.deepEqual(bare.card, { type: 'chat', question: 'Completion checklist', answer: null, href: '/c/c-3' });
  const nobody = row({ kind: 'lawexa_answered', actor: lawexa, asked_by: null, items: [{ id: 'c', title: 'Q', url: '' }] });
  assert.equal(nobody.title, 'Lawexa answered');
});

test('someone joined: "<who> joined", the Space then its members', () => {
  const r = row({ kind: 'member_joined', actor: kemi, space: lease });
  assert.equal(r.title, 'Kemi joined');
  assert.equal(line(r), 'Ikoyi lease · 4 members');
  assert.equal(r.href, '/spaces/uuid-ikoyi-lease?tab=people');
});

test('a reply or mention: "<who> replied to you", the Space then the chat, the words in a quote card', () => {
  const r = row({
    kind: 'reply',
    actor: banner,
    space: gray,
    conversation: { uuid: 'c-9', title: 'Completion checklist' },
    excerpt: 'Can you confirm the escrow date before Friday?',
  });
  assert.equal(r.title, 'Banner replied to you');
  assert.equal(line(r), 'Gray Partners · Completion checklist');
  assert.deepEqual(r.card, { type: 'quote', text: 'Can you confirm the escrow date before Friday?', replyHref: '/c/c-9' });
  const mention = row({ kind: 'mention', actor: ada, conversation: { uuid: 'c-1', title: 'Fair hearing points' }, excerpt: '  ' });
  assert.equal(mention.title, 'Ada mentioned you');
  assert.equal(mention.card, null);
});

test('an invitation: "<who> invited you to a Space", who is in it, no Space link, the Space named on the card', () => {
  const r = row({
    kind: 'invite',
    space: lekki,
    needs_action: true,
    action: { type: 'accept', target: { type: 'space_invite', id: 41 } },
    members_preview: ['Ada Okafor', 'Kemi Bello'],
  });
  assert.equal(r.title, 'Tunde invited you to a Space');
  // The reader is not in it yet: no link to a page that would refuse them.
  assert.equal(r.meta.space, null);
  assert.equal(line(r), 'Ada Okafor, Kemi Bello and 2 others are in it');
  assert.equal(r.href, null);
  assert.deepEqual(r.card, { type: 'invite', spaceName: 'Lekki land', facts: 'Work · Private · 4 members', invitationId: 41 });
  const stringId = row({ kind: 'invite', needs_action: true, action: { type: 'accept', target: { type: 'space_invite', id: '41' } } });
  assert.ok(stringId.card?.type === 'invite');
  assert.equal(stringId.card.invitationId, 41);
  const answered = row({ kind: 'invite', needs_action: false, action: { type: 'accept', target: { type: 'space_invite', id: 41 } } });
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
  assert.equal(join.title, 'Ada asked to join');
  assert.equal(line(join), 'Ikoyi lease · Work · Private · 4 members');
  assert.equal(join.href, '/spaces/uuid-ikoyi-lease?tab=people');
  assert.equal(join.card, null);
  const role = row({ kind: 'role_request', actor: kemi, space: lease, needs_action: true });
  assert.equal(role.title, 'Kemi asked for a new role');
  assert.equal(role.card, null);
});

/* ── Fix 3: the Space name first, never the part that is cut ──────────────── */

test('every row of a Space the reader is in starts its grey line with that Space, linked', () => {
  const rows = [
    row({ kind: 'files_added', items: [file(1, 'a.pdf', PDF)] }),
    row({ kind: 'folder_created', items: [{ id: 'f', name: 'F', url: '', item_count: 1 }] }),
    row({ kind: 'chat_started', items: [{ id: 'c', title: 'T', url: '' }] }),
    row({ kind: 'lawexa_answered', actor: lawexa, items: [{ id: 'c', title: 'T', url: '' }] }),
    row({ kind: 'member_joined' }),
    row({ kind: 'reply', conversation: { uuid: 'c', title: 'T' } }),
    row({ kind: 'join_request' }),
    row({ kind: 'role_request' }),
  ];
  for (const r of rows) assert.deepEqual(r.meta.space, { name: 'Adeyemi appeal', href: '/spaces/uuid-adeyemi-appeal' }, r.title);
  // An invitation is to a Space the reader is not in yet: no link (see the invitation's own test).
  assert.equal(row({ kind: 'invite' }).meta.space, null);
  assert.match(screen, /if \(!meta\.space\) return <span className="mt-0\.5 block truncate text-xs text-muted-foreground">\{meta\.rest\}<\/span>;/);
  // The Space keeps its width and its own link; only the rest truncates.
  assert.match(screen, /href=\{meta\.space\.href\}[\s\S]*?className="relative z-10 max-w-full shrink-0 truncate/);
  assert.match(screen, /<span className="min-w-0 truncate">\s*\{'\\u00a0·\\u00a0'\}\s*\{meta\.rest\}/);
});

/* ── Fix 4: one kind of mark ──────────────────────────────────────────────── */

test('the mark is the person’s initials, Lawexa’s mark, or "?" for no account; never a line icon', () => {
  assert.deepEqual(row({ kind: 'files_added', actor: kemi, items: [file(1, 'a.pdf', PDF)] }).lead, {
    type: 'person',
    name: 'Kemi Bello',
    avatar: null,
  });
  assert.equal(row({ kind: 'folder_created', actor: ada, items: [{ id: 'f', name: 'F', url: '', item_count: 1 }] }).lead.type, 'person');
  assert.equal(row({ kind: 'invite', actor: tunde }).lead.type, 'person');
  assert.deepEqual(row({ kind: 'member_joined', actor: null }).lead, { type: 'unknown' });
  assert.equal(row({ kind: 'member_joined', actor: null }).title, 'Someone joined');
  assert.deepEqual(row({ kind: 'lawexa_answered', actor: lawexa, items: [{ id: 'c', title: 'T', url: '' }] }).lead, { type: 'lawexa' });
  // The Lead draws MemberAvatar, the "?" circle, or the mark: no lucide icon.
  const lead = screen.slice(screen.indexOf('function Lead('), screen.indexOf('function MetaLine('));
  assert.match(lead, /lead\.type === 'unknown' \? \{ name: '\?', avatar_url: null \}/);
  assert.match(lead, /<MemberAvatar user=\{user\} className=\{INITIALS_20\} \/>/);
  assert.match(lead, /<LogoMark className="size-5 shrink-0" alt="" \/>/);
  assert.doesNotMatch(lead, /ICONS\[|<Icon\b/);
});

test('every face is the same neutral grey with muted letters, never a colour per person (Stay, 24 October 2026)', () => {
  assert.match(screen, /\[&_\[data-slot=avatar-fallback\]\]:bg-secondary /);
  assert.match(screen, /\[&_\[data-slot=avatar-fallback\]\]:text-muted-foreground';/);
  assert.doesNotMatch(screen, /memberStyle|member-bg|member-ink|PERSON_TINT/);
  assert.equal('tint' in row({ kind: 'files_added', actor: kemi, items: [file(1, 'a.pdf', PDF)] }).lead, false);
});

/* ── Fix 1: one row per chat per day ──────────────────────────────────────── */

test('a chat’s events of one day are one row: the newest, with the server’s "N new messages"', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  const events = [
    event({
      kind: 'lawexa_answered',
      id: 'answered',
      at: '2026-10-24T11:00:00Z',
      actor: lawexa,
      asked_by: banner,
      new_messages: 4,
      items: [{ id: 'c-1', title: 'Completion', url: '', question: 'When?', answer_preview: 'Friday.' }],
    }),
    event({ kind: 'member_joined', id: 'joined', at: '2026-10-24T10:30:00Z', actor: kemi }),
    event({
      kind: 'chat_started',
      id: 'started',
      at: '2026-10-24T10:00:00Z',
      actor: banner,
      new_messages: 4,
      items: [{ id: 'c-1', title: 'Completion', url: '' }],
    }),
    // The same chat the day before: its own row.
    event({
      kind: 'chat_started',
      id: 'yesterday',
      at: '2026-10-23T10:00:00Z',
      actor: banner,
      new_messages: 1,
      items: [{ id: 'c-1', title: 'Completion', url: '' }],
    }),
  ];
  const days = timelineDays(events, now, 'UTC');
  assert.deepEqual(days.map((day) => [day.label, day.rows.map((r) => r.key)]), [
    ['Today', ['answered', 'joined']],
    ['Yesterday', ['yesterday']],
  ]);
  const chat = days[0].rows[0];
  assert.equal(chat.title, 'Lawexa answered Banner');
  assert.equal(line(chat), 'Adeyemi appeal · 4 new messages');
  assert.deepEqual(chat.card, { type: 'chat', question: 'When?', answer: 'Friday.', href: '/c/c-1' });
  // One message says what it is about, not a count.
  assert.equal(line(days[1].rows[0]), 'Adeyemi appeal · Completion');
});

test('one event can stand for several messages; without new_messages the events are counted', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  const alone = timelineDays(
    [event({ kind: 'chat_started', id: 's', at: '2026-10-24T09:00:00Z', new_messages: 3, items: [{ id: 'c', title: 'T', url: '' }] })],
    now,
    'UTC',
  );
  assert.equal(line(alone[0].rows[0]), 'Adeyemi appeal · 3 new messages');
  // A reply carries no new_messages: the newest event draws, the events are counted.
  const days = timelineDays(
    [
      event({ kind: 'chat_started', id: 'older', at: '2026-10-24T09:00:00Z', items: [{ id: 'c-1', title: 'T', url: '' }] }),
      event({ kind: 'reply', id: 'newer', at: '2026-10-24T11:00:00Z', actor: kemi, conversation: { uuid: 'c-1', title: 'T' }, excerpt: 'Hi' }),
    ],
    now,
    'UTC',
  );
  assert.deepEqual(days[0].rows.map((r) => [r.key, r.title, line(r)]), [['newer', 'Kemi replied to you', 'Adeyemi appeal · 2 new messages']]);
});

test('the chat is keyed on conversation.uuid, else items[0].id (the conversation uuid)', () => {
  assert.equal(chatKey(event({ kind: 'reply', conversation: { uuid: 'c-9', title: 'T' } })), 'c-9');
  assert.equal(chatKey(event({ kind: 'mention', conversation: { uuid: 'c-9', title: 'T' } })), 'c-9');
  assert.equal(chatKey(event({ kind: 'chat_started', items: [{ id: 'c-1', title: 'T', url: '' }] })), 'c-1');
  assert.equal(chatKey(event({ kind: 'lawexa_answered', items: [{ id: 'c-1', title: 'T', url: '' }] })), 'c-1');
  assert.equal(chatKey(event({ kind: 'files_added', items: [file(1, 'a.pdf', PDF)] })), null);
  assert.equal(chatKey(event({ kind: 'reply' })), null);
});

/* ── Fix 8: new since your last visit ─────────────────────────────────────── */

test('the "new since" line goes before the first row older than the last visit', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  const days = timelineDays(
    [
      event({ kind: 'member_joined', id: 'a', at: '2026-10-24T11:00:00Z' }),
      event({ kind: 'member_joined', id: 'b', at: '2026-10-24T09:00:00Z' }),
      event({ kind: 'member_joined', id: 'c', at: '2026-10-23T09:00:00Z' }),
    ],
    now,
    'UTC',
  );
  assert.equal(newSinceRowKey(days, Date.parse('2026-10-24T10:00:00Z')), 'b');
  assert.equal(newSinceRowKey(days, Date.parse('2026-10-23T12:00:00Z')), 'c');
  // First visit, everything new, or nothing new: no line.
  assert.equal(newSinceRowKey(days, null), null);
  assert.equal(newSinceRowKey(days, Date.parse('2026-10-01T00:00:00Z')), null);
  assert.equal(newSinceRowKey(days, Date.parse('2026-10-24T11:30:00Z')), null);
  assert.equal(newestAt(days), Date.parse('2026-10-24T11:00:00Z'));
  assert.equal(newestAt([]), null);
});

test('last seen is stored per tab, and a bad value reads as never', () => {
  assert.equal(lastSeenKey('work'), 'lawexa:v2:home-timeline:last-seen:work');
  assert.equal(lastSeenKey('study'), 'lawexa:v2:home-timeline:last-seen:study');
  assert.equal(parseLastSeen('1761300000000'), 1761300000000);
  assert.equal(parseLastSeen(null), null);
  assert.equal(parseLastSeen('soon'), null);
  assert.equal(parseLastSeen('0'), null);
  const store = read('v2', 'features', 'home-timeline', 'last-seen.ts');
  // Every storage access is inside a try.
  assert.equal((store.match(/window\.localStorage/g) ?? []).length, 3);
  assert.equal((store.match(/try \{/g) ?? []).length, 2);
});

test('the line is read once, written on leaving or after a while, and is not gold', () => {
  assert.match(screen, /const \[lastSeen\] = useState\(\(\) => readLastSeen\(type\)\);/);
  assert.match(screen, /window\.addEventListener\('pagehide', write\);/);
  assert.match(screen, /window\.setTimeout\(write, SEEN_AFTER_MS\)/);
  assert.match(screen, /return \(\) => \{[\s\S]*?write\(\);\s*\};/);
  const divider = screen.slice(screen.indexOf('function NewSinceLine('), screen.indexOf('function NewSinceRow('));
  assert.match(divider, /text-\[11px\] leading-4 text-muted-foreground/);
  assert.match(divider, /h-px flex-1 bg-border/);
  assert.doesNotMatch(divider, /primary|rounded-full/);
});

/* ── Fixes 2 and 9: no big heading; the empty tab says what shows there ───── */

test('the heading is for screen readers only; the list starts at the top', () => {
  assert.match(states, /<h1 className="sr-only">What&rsquo;s happening in your/);
  assert.doesNotMatch(states + screen, /mt-\[42px\]/);
});

test('an empty tab says what shows there and offers a quiet way to its Spaces', () => {
  assert.match(states, /Files, folders, chats and people from your \{label\} Spaces show here as they happen\./);
  assert.match(states, /<Button asChild variant="outline"[^>]*>\s*<Link href=\{`\/spaces\?type=\$\{type\}`\}>Go to your \{label\} Spaces<\/Link>/);
  // `/spaces?type=` is the Spaces list's own filter.
  assert.match(read('v2', 'features', 'spaces', 'model.ts'), /case 'study':\s*return raw;/);
});

/* ── The rest of the model ───────────────────────────────────────────────── */

test('a kind this screen does not know, or an event missing its item, draws nothing', () => {
  assert.equal(timelineRow(event({ kind: 'poll_closed' as TimelineEvent['kind'] }), NOW), null);
  assert.equal(timelineRow(event({ kind: 'chat_started', items: [] }), NOW), null);
  assert.equal(timelineRow(event({ kind: 'reply' }), NOW), null);
});

test('no time until the clock is known', () => {
  assert.equal(timelineRow(event({ kind: 'member_joined' }), null)?.time, '');
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
  assert.deepEqual(
    timelineDays(events, now, 'Africa/Lagos').map((day) => [day.label, day.rows.map((r) => r.key)]),
    [['Today', ['a', 'b']], ['Yesterday', ['c']], ['20 Oct', ['d']], ['31 Dec 2025', ['e']]],
  );
  assert.deepEqual(
    timelineDays(events, now, 'UTC').map((day) => [day.label, day.rows.map((r) => r.key)]),
    [['Today', ['a']], ['Yesterday', ['b', 'c']], ['20 Oct', ['d']], ['31 Dec 2025', ['e']]],
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
  assert.equal(followEmptyCursor([empty], false), false);
  assert.equal(followEmptyCursor([full], true), false);
  assert.equal(canScrollForMore([full], true), true);
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
  const grayLp = 'TEST DATA Gray Partners LP · Property Acquisition and Lease Review';
  assert.deepEqual(
    rows.map((r) => (r ? [r.title, line(r)] : null)),
    [
      ['You added test-data-loose-file.pdf', 'TEST DATA loose files only · PDF'],
      ['You joined', 'TEST DATA loose files only · 1 member'],
      ['Case joined', `${grayLp} · 2 members`],
      ['You added 4 files', grayLp],
      ['You made 2 folders', grayLp],
      ['You joined', `${grayLp} · 2 members`],
    ],
  );
  const files = rows[3]?.card;
  assert.ok(files?.type === 'files');
  assert.equal(files.files.length, 3);
  assert.equal(moreFilesLabel(files.more), 'and 1 more');
  const days = timelineDays(events, now, 'UTC');
  assert.deepEqual(days.map((day) => [day.label, day.rows.length]), [['Yesterday', 2], ['22 Oct', 4]]);
});

/* ── Source pins ─────────────────────────────────────────────────────────── */

test('gold is only on Accept', () => {
  assert.doesNotMatch(screen + states, /text-primary\b|bg-primary\b|border-primary|ring-primary|primary\//);
  const buttons = screen.match(/<Button[\s\S]*?<\/Button>/g) ?? [];
  assert.equal(buttons.length, 2);
  const [accept, decline] = buttons;
  assert.match(accept, /Accept\s*<\/Button>$/);
  assert.doesNotMatch(accept, /variant=/);
  assert.match(decline, /variant="outline"/);
  // Every Button in the timeline's states is outline or ghost.
  for (const button of states.match(/<Button\b[^>]*>/g) ?? []) assert.match(button, /variant="(outline|ghost)"/);
  assert.match(screen, /const QUIET_BUTTON = cn\(\s*'[^']*text-muted-foreground/);
});

test('one card style, and the hairline inset to the title column between rows only', () => {
  assert.match(screen, /const CARD = 'rounded-2xl border border-border bg-card px-3\.5 py-3';/);
  assert.equal((screen.match(/rounded-2xl/g) ?? []).length, 1);
  assert.match(screen, /not-first:before:left-11 not-first:before:h-px not-first:before:bg-border\/40/);
  assert.match(screen, /<div className="pr-3 pb-2\.5 pl-11">\s*<RowCard card=\{row\.card\} \/>/);
});

test('the clock is read once and only used after hydration', () => {
  assert.match(screen, /const \[clock\] = useState\(\(\) => Date\.now\(\)\);/);
  assert.match(screen, /pages && mounted \? timelineDays\(/);
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

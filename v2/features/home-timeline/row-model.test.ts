import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lastSeenKey, parseLastSeen } from './last-seen';
import {
  EMPTY_PAGE_CAP,
  activityTime,
  canScrollForMore,
  chatKey,
  emptyPagesInARow,
  followEmptyCursor,
  membersLine,
  newestAt,
  newSinceRowKey,
  sentenceText,
  shortName,
  timelineDays,
  timelineRow,
  todayUpdates,
  updatesLabel,
} from './row-model';
import type { TimelineActor, TimelineEnvelope, TimelineEvent, TimelineFileItem, TimelineSpace } from './types';

/* Events shaped like Backend's timeline (the local page in
 * `timeline-work.fixture.json`, 24 October 2026, and the fields Backend
 * confirmed on 25 October), with the mock's own people and Spaces. The rows
 * are the "Activity" style of Stay's four pictures (24 October 2026). */

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
  const built = timelineRow(event(fields), NOW, messages, 'UTC');
  assert.ok(built, `a ${fields.kind} event draws a row`);
  return built;
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

/* ── One sentence per row (Stay, 24 October 2026) ─────────────────────────── */

test('one file: "<who> added <file> to <Space>", the file badge, opening the Space', () => {
  const r = row({ kind: 'files_added', items: [file(1, 'Record of appeal.pdf', PDF, 4)] });
  assert.deepEqual(r.sentence, { actor: 'Tunde', verb: 'added', object: 'Record of appeal.pdf', place: { word: 'to', name: 'Adeyemi appeal' } });
  assert.equal(r.title, 'Tunde added Record of appeal.pdf to Adeyemi appeal');
  assert.equal(r.badge, 'file');
  assert.equal(r.detail, null);
  assert.equal(r.href, '/spaces/uuid-adeyemi-appeal');
  assert.equal(r.time, '12 min ago');
});

test('several files: "<who> added 3 files to <Space>"', () => {
  const items = [file(1, 'a.pdf', PDF, 18), file(2, 'b.pdf', PDF, 3), file(3, 'c.pdf', PDF)];
  const r = row({ kind: 'files_added', actor: kemi, space: gray, count: 3, items });
  assert.equal(r.title, 'Kemi added 3 files to Gray Partners');
  assert.equal(r.sentence.object, '3 files');
});

test('a folder: "<who> made <folder> in <Space>", by uuid; several folders open the Space’s folders', () => {
  const one = row({
    kind: 'folder_created',
    actor: ada,
    space: lease,
    items: [{ id: 'f-uuid', name: 'Title documents', url: 'https://demo.lawexa.com/folders/f-uuid', item_count: 3 }],
  });
  assert.equal(one.title, 'Ada made Title documents in Ikoyi lease');
  assert.equal(one.badge, 'folder');
  assert.equal(one.href, '/folders/f-uuid');
  const two = row({
    kind: 'folder_created',
    actor: you,
    space: lease,
    count: 2,
    items: [
      { id: 'f-1', name: 'Disputes', url: '', item_count: 1 },
      { id: 'f-2', name: 'Leases', url: '', item_count: 4 },
    ],
  });
  assert.equal(two.title, 'You made 2 folders in Ikoyi lease');
  assert.equal(two.href, '/spaces/uuid-ikoyi-lease?tab=folders');
});

test('a chat started: "<who> started a chat in <Space>", the question (or the title) as its second line', () => {
  const r = row({ kind: 'chat_started', actor: banner, items: [{ id: 'c-1', title: 'Fair hearing points', url: '' }] });
  assert.equal(r.title, 'Banner started a chat in Adeyemi appeal');
  assert.equal(r.badge, 'chat');
  assert.equal(r.detail, 'Fair hearing points');
  assert.equal(r.href, '/c/c-1');
  const asked = row({ kind: 'chat_started', items: [{ id: 'c-1', title: 'Fair hearing', url: '', question: 'Was the hearing fair?' }] });
  assert.equal(asked.detail, 'Was the hearing fair?');
});

test('Lawexa answered: its mark and no badge, whom it answered, the question as the second line', () => {
  const r = row({
    kind: 'lawexa_answered',
    actor: lawexa,
    space: gray,
    asked_by: kemi,
    items: [{ id: 'c-2', title: 'Completion checklist', url: '', question: 'Can completion wait for the Governor’s consent?', answer_preview: 'Yes…' }],
  });
  assert.equal(r.title, 'Lawexa answered Kemi in Gray Partners');
  assert.deepEqual(r.lead, { type: 'lawexa' });
  assert.equal(r.badge, null);
  assert.equal(r.detail, 'Can completion wait for the Governor’s consent?');
  assert.equal(r.href, '/c/c-2');
  const bare = row({ kind: 'lawexa_answered', actor: lawexa, asked_by: you, items: [{ id: 'c-3', title: 'Completion checklist', url: '', question: null }] });
  assert.equal(bare.title, 'Lawexa answered you in Adeyemi appeal');
  assert.equal(bare.detail, 'Completion checklist');
  const nobody = row({ kind: 'lawexa_answered', actor: lawexa, asked_by: null, items: [{ id: 'c', title: 'Q', url: '' }] });
  assert.equal(nobody.title, 'Lawexa answered in Adeyemi appeal');
});

test('someone joined: "<who> joined <Space>", the Space bold, opening its people', () => {
  const r = row({ kind: 'member_joined', actor: kemi, space: lease });
  assert.equal(r.title, 'Kemi joined Ikoyi lease');
  assert.deepEqual(r.sentence, { actor: 'Kemi', verb: 'joined', object: 'Ikoyi lease', place: null });
  assert.equal(r.badge, 'join');
  assert.equal(r.href, '/spaces/uuid-ikoyi-lease?tab=people');
});

test('a reply or mention: "<who> replied to you in <Space>", the words as the second line, and Reply', () => {
  const r = row({
    kind: 'reply',
    actor: banner,
    space: gray,
    conversation: { uuid: 'c-9', title: 'Completion checklist' },
    excerpt: 'Can you confirm the escrow date before Friday?',
  });
  assert.equal(r.title, 'Banner replied to you in Gray Partners');
  assert.equal(r.badge, 'reply');
  assert.equal(r.detail, 'Can you confirm the escrow date before Friday?');
  assert.equal(r.replyHref, '/c/c-9');
  assert.equal(r.href, '/c/c-9');
  // No words: the chat's title says what it is about.
  const mention = row({ kind: 'mention', actor: ada, conversation: { uuid: 'c-1', title: 'Fair hearing points' }, excerpt: '  ' });
  assert.equal(mention.title, 'Ada mentioned you in Adeyemi appeal');
  assert.equal(mention.badge, 'mention');
  assert.equal(mention.detail, 'Fair hearing points');
});

test('an invitation: "<who> invited you to <Space>", who is in it, Accept and Decline, and no link', () => {
  const r = row({
    kind: 'invite',
    space: lekki,
    needs_action: true,
    action: { type: 'accept', target: { type: 'space_invite', id: 41 } },
    members_preview: ['Ada Okafor', 'Kemi Bello'],
  });
  assert.equal(r.title, 'Tunde invited you to Lekki land');
  assert.equal(r.badge, 'invite');
  assert.equal(r.detail, 'Ada Okafor, Kemi Bello and 2 others are in it');
  // The reader is not in it yet: no link to a page that would refuse them.
  assert.equal(r.href, null);
  assert.deepEqual(r.invite, { invitationId: 41 });
  const stringId = row({ kind: 'invite', needs_action: true, action: { type: 'accept', target: { type: 'space_invite', id: '41' } } });
  assert.deepEqual(stringId.invite, { invitationId: 41 });
  const answered = row({ kind: 'invite', needs_action: false, action: { type: 'accept', target: { type: 'space_invite', id: 41 } } });
  assert.deepEqual(answered.invite, { invitationId: null });
});

test('who is in it, at every count', () => {
  assert.equal(membersLine(['Ada Okafor', 'Kemi Bello'], 4), 'Ada Okafor, Kemi Bello and 2 others are in it');
  assert.equal(membersLine(['Ada Okafor', 'Kemi Bello'], 3), 'Ada Okafor, Kemi Bello and 1 other are in it');
  assert.equal(membersLine(['Ada Okafor', 'Kemi Bello'], 2), 'Ada Okafor and Kemi Bello are in it');
  assert.equal(membersLine(['Ada Okafor'], 1), 'Ada Okafor is in it');
  assert.equal(membersLine([], 1), '1 person is in it');
  assert.equal(membersLine([], 5), '5 people are in it');
});

test('a join request and a role request open the Space’s people', () => {
  const join = row({ kind: 'join_request', actor: ada, space: lease, needs_action: true });
  assert.equal(join.title, 'Ada asked to join Ikoyi lease');
  assert.equal(join.href, '/spaces/uuid-ikoyi-lease?tab=people');
  const role = row({ kind: 'role_request', actor: kemi, space: lease, needs_action: true });
  assert.equal(role.title, 'Kemi asked for a new role in Ikoyi lease');
  assert.equal(role.badge, 'request');
});

test('the sentence reads as plain words for the row’s label', () => {
  assert.equal(sentenceText({ actor: 'Case', verb: 'added', object: '3 files', place: { word: 'to', name: 'Okonkwo & Partners' } }), 'Case added 3 files to Okonkwo & Partners');
  assert.equal(sentenceText({ actor: 'Kemi', verb: 'started a chat', object: null, place: { word: 'in', name: 'X' } }), 'Kemi started a chat in X');
});

/* ── The time on the right ───────────────────────────────────────────────── */

test('the time: just now, minutes and hours ago today, then the day words', () => {
  assert.equal(activityTime(at(0), NOW, 'UTC'), 'Just now');
  assert.equal(activityTime(at(12), NOW, 'UTC'), '12 min ago');
  assert.equal(activityTime(at(60), NOW, 'UTC'), '1 hour ago');
  assert.equal(activityTime(at(180), NOW, 'UTC'), '3 hours ago');
  assert.equal(activityTime('2026-10-23T20:00:00Z', NOW, 'UTC'), 'Yesterday');
  assert.equal(activityTime('2026-10-21T09:00:00Z', NOW, 'UTC'), '21 Oct');
  assert.equal(activityTime('2025-12-31T09:00:00Z', NOW, 'UTC'), '31 Dec 2025');
  assert.equal(activityTime(at(5), null, 'UTC'), '');
  assert.equal(activityTime('not a date', NOW, 'UTC'), '');
});

/* ── The mark: photo, initials or Lawexa, with a badge ───────────────────── */

test('the mark is the person (photo or initials), Lawexa’s mark, or "?" for no account', () => {
  assert.deepEqual(row({ kind: 'files_added', actor: kemi, items: [file(1, 'a.pdf', PDF)] }).lead, { type: 'person', name: 'Kemi Bello', avatar: null });
  const photo = person(7, 'Ngozi Eze', { avatar: 'https://cdn.example/ngozi.png' });
  assert.deepEqual(row({ kind: 'member_joined', actor: photo }).lead, { type: 'person', name: 'Ngozi Eze', avatar: 'https://cdn.example/ngozi.png' });
  assert.deepEqual(row({ kind: 'member_joined', actor: null }).lead, { type: 'unknown' });
  assert.equal(row({ kind: 'member_joined', actor: null }).title, 'Someone joined Adeyemi appeal');
  const lead = screen.slice(screen.indexOf('function Lead('), screen.indexOf('function Sentence('));
  assert.match(lead, /lead\.type === 'unknown' \? \{ name: '\?', avatar_url: null \} : \{ name: lead\.name, avatar_url: lead\.avatar \}/);
  assert.match(lead, /<LogoMark className="size-\[18px\] md:size-5" alt="" \/>/);
  // The badge sits on the avatar's lower right corner: 18px on a phone, 20px on a computer, the icon at full contrast.
  assert.match(lead, /absolute -right-1 -bottom-1 flex size-\[18px\] items-center justify-center rounded-full bg-background ring-1 ring-border md:-right-1\.5 md:-bottom-1\.5 md:size-5/);
  assert.match(lead, /<Icon className="size-2\.5 text-foreground md:size-3" \/>/);
  // The avatar is 32px on a phone, 36px on a computer.
  assert.match(screen, /const AVATAR =\s*'size-8 md:size-9 /);
  // No line joins the avatars (Stay, 24 October 2026: "remove the vertical line on the avatars").
  assert.doesNotMatch(screen, /\bw-px\b|joined=/);
});

test('initials are one neutral grey with muted letters, never a colour per person (Stay, 24 October 2026)', () => {
  assert.match(screen, /\[&_\[data-slot=avatar-fallback\]\]:bg-secondary /);
  assert.match(screen, /\[&_\[data-slot=avatar-fallback\]\]:text-muted-foreground';/);
  assert.doesNotMatch(screen, /memberStyle|member-bg|member-ink|PERSON_TINT/);
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
  assert.equal(chat.title, 'Lawexa answered Banner in Adeyemi appeal');
  assert.equal(chat.detail, 'When? · 4 new messages');
  // One message says what it is about, not a count.
  assert.equal(days[1].rows[0].detail, 'Completion');
});

test('one event can stand for several messages; without new_messages the events are counted', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  const alone = timelineDays(
    [event({ kind: 'chat_started', id: 's', at: '2026-10-24T09:00:00Z', new_messages: 3, items: [{ id: 'c', title: 'T', url: '' }] })],
    now,
    'UTC',
  );
  assert.equal(alone[0].rows[0].detail, 'T · 3 new messages');
  // A reply carries no new_messages: the newest event draws, the events are counted.
  const days = timelineDays(
    [
      event({ kind: 'chat_started', id: 'older', at: '2026-10-24T09:00:00Z', items: [{ id: 'c-1', title: 'T', url: '' }] }),
      event({ kind: 'reply', id: 'newer', at: '2026-10-24T11:00:00Z', actor: kemi, conversation: { uuid: 'c-1', title: 'T' }, excerpt: 'Hi' }),
    ],
    now,
    'UTC',
  );
  assert.deepEqual(days[0].rows.map((r) => [r.key, r.title, r.detail]), [['newer', 'Kemi replied to you in Adeyemi appeal', 'Hi · 2 new messages']]);
});

test('the chat is keyed on conversation.uuid, else items[0].id (the conversation uuid)', () => {
  assert.equal(chatKey(event({ kind: 'reply', conversation: { uuid: 'c-9', title: 'T' } })), 'c-9');
  assert.equal(chatKey(event({ kind: 'mention', conversation: { uuid: 'c-9', title: 'T' } })), 'c-9');
  assert.equal(chatKey(event({ kind: 'chat_started', items: [{ id: 'c-1', title: 'T', url: '' }] })), 'c-1');
  assert.equal(chatKey(event({ kind: 'lawexa_answered', items: [{ id: 'c-1', title: 'T', url: '' }] })), 'c-1');
  assert.equal(chatKey(event({ kind: 'files_added', items: [file(1, 'a.pdf', PDF)] })), null);
  assert.equal(chatKey(event({ kind: 'reply' })), null);
});

/* ── Fix 8: before your last visit ────────────────────────────────────────── */

test('the last-visit line goes before the first row older than the last visit', () => {
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

test('the line names the rows below it, in the day labels’ dress (the techlead, 24 October 2026)', () => {
  assert.match(screen, /const NEW_SINCE_WORDS = 'Before your last visit';/);
  assert.match(screen, /<CentredLabel as="span" label=\{NEW_SINCE_WORDS\} \/>/);
  // On a day boundary it joins the day's label: "YESTERDAY · BEFORE YOUR LAST VISIT", never two lines stacked.
  assert.match(screen, /<CentredLabel label=\{lineAboveDay \? `\$\{day\.label\} · \$\{NEW_SINCE_WORDS\}` : day\.label\} \/>/);
  assert.doesNotMatch(screen, /'New since your last visit'/);
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
  const label = screen.slice(screen.indexOf('function CentredLabel('), screen.indexOf('const NEW_SINCE_WORDS'));
  assert.match(label, /text-\[11px\] font-medium tracking-\[0\.08em\] text-muted-foreground uppercase/);
  assert.match(label, /h-px flex-1 bg-border/);
  assert.doesNotMatch(label, /primary/);
});

/* ── The header and the empty tab ────────────────────────────────────────── */

test('the header: "Activity", what the tab shows, and today’s "N updates"', () => {
  // 22px on a phone with the grey line and the count on one line under it; 24px on a computer.
  assert.match(states, /<h1 className="col-start-1 row-start-1 text-\[22px\] leading-tight font-bold tracking-tight text-foreground md:text-2xl">\s*Activity\s*<\/h1>/);
  assert.match(states, /col-start-2 row-start-2 shrink-0 rounded-full bg-secondary/);
  assert.match(states, /What&rsquo;s happening in your \{type === 'study' \? 'Study' : 'Work'\} Spaces/);
  assert.match(states, /\{updates > 0 \? \(/);
  assert.match(screen, /<TimelineHeading type=\{type\} updates=\{todayUpdates\(days\)\} \/>/);
  assert.equal(updatesLabel(1), '1 update');
  assert.equal(updatesLabel(5), '5 updates');
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
  assert.equal(todayUpdates(days), 2);
  assert.equal(todayUpdates(days.slice(1)), 0);
  assert.equal(todayUpdates([]), 0);
});

test('an empty tab keeps the header, says what shows there and offers a quiet way to its Spaces', () => {
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
  // The time on the right follows the same midnight.
  // 23:30 UTC is today in Lagos, nine and a half hours before 09:00 UTC.
  assert.equal(timelineDays(events, now, 'Africa/Lagos')[0].rows[1].time, '9 hours ago');
  assert.equal(timelineDays(events, now, 'UTC')[1].rows[0].time, 'Yesterday');
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
  const rows = events.map((e) => timelineRow(e, now, 1, 'UTC'));
  assert.ok(rows.every((r) => r !== null));
  const grayLp = 'TEST DATA Gray Partners LP · Property Acquisition and Lease Review';
  assert.deepEqual(
    rows.map((r) => r?.title),
    [
      'You added test-data-loose-file.pdf to TEST DATA loose files only',
      'You joined TEST DATA loose files only',
      `Case joined ${grayLp}`,
      `You added 4 files to ${grayLp}`,
      `You made 2 folders in ${grayLp}`,
      `You joined ${grayLp}`,
    ],
  );
  const days = timelineDays(events, now, 'UTC');
  assert.deepEqual(days.map((day) => [day.label, day.rows.length]), [['Yesterday', 2], ['22 Oct', 4]]);
});

/* ── Source pins ─────────────────────────────────────────────────────────── */

test('gold is only on Accept; Decline and Reply are quiet', () => {
  assert.doesNotMatch(screen + states, /text-primary\b|bg-primary\b|border-primary|ring-primary|primary\//);
  const buttons = screen.match(/<Button[\s\S]*?<\/Button>/g) ?? [];
  assert.equal(buttons.length, 2);
  const [accept, decline] = buttons;
  assert.match(accept, /Accept\s*<\/Button>$/);
  assert.doesNotMatch(accept, /variant=/);
  assert.match(decline, /variant="ghost"/);
  // Every Button in the timeline's states is outline or ghost.
  for (const button of states.match(/<Button\b[^>]*>/g) ?? []) assert.match(button, /variant="(outline|ghost)"/);
  assert.match(screen, /const QUIET_LINK = cn\(\s*'[^']*text-muted-foreground/);
});

test('no boxed cards: a row is the avatar, the sentence, one muted line and the time', () => {
  assert.doesNotMatch(screen, /rounded-2xl|bg-card|function RowCard|ChevronRight/);
  // One line on a phone, two at most on a computer.
  assert.match(screen, /<p className="min-w-0 flex-1 truncate text-sm leading-5 md:line-clamp-2 md:whitespace-normal" title=\{row\.title\}>/);
  // The muted line where it carries meaning is the computer's only.
  assert.match(screen, /<p className="mt-0\.5 hidden truncate text-\[13px\] leading-5 text-muted-foreground md:block">\{row\.detail\}<\/p>/);
  // The whole row opens its target; Reply and the invitation's buttons sit above the stretched link.
  assert.match(screen, /after:absolute after:inset-0 after:rounded-xl/);
  assert.match(screen, /const QUIET_LINK = cn\(\s*'v2-interactive relative z-10/);
  assert.match(screen, /<span className=\{cn\('relative z-10 flex gap-1\.5', className\)\}>/);
});

test('on a phone a row is two lines: the short sentence, then the Space and a short time (Stay, 24 October 2026: "Mobile is too cluttered")', () => {
  const r = row({ kind: 'reply', actor: banner, space: gray, conversation: { uuid: 'c-9', title: 'T' }, excerpt: 'Hi' });
  assert.equal(r.shortTime, '12m');
  assert.equal(activityTime(at(0), NOW, 'UTC', true), 'now');
  assert.equal(activityTime(at(180), NOW, 'UTC', true), '3h');
  assert.equal(activityTime('2026-10-23T20:00:00Z', NOW, 'UTC', true), 'Yesterday');
  assert.equal(activityTime('2026-10-21T09:00:00Z', NOW, 'UTC', true), '21 Oct');
  // The Space leaves the sentence on a phone and heads the second line.
  assert.match(screen, /<span className="hidden text-muted-foreground md:inline">\s*\{' '\}\s*\{sentence\.place\.word\} \{sentence\.place\.name\}/);
  // A long Space name ends in "…"; the time beside it never does.
  assert.match(screen, /\{place \? <span className="min-w-0 truncate">\{place\}<\/span> : null\}/);
  assert.match(screen, /\{row\.shortTime \? <span className="shrink-0 tabular-nums">\{row\.shortTime\}<\/span> : null\}/);
  assert.match(screen, /<div className="mt-px flex min-w-0 items-center gap-2 md:hidden">/);
  // No Reply link and no long time on a phone; an invitation's answer sits at the second line's right.
  assert.match(screen, /<div className="mt-1 hidden md:block">\s*<Link href=\{row\.replyHref\}/);
  assert.match(screen, /hidden shrink-0 pt-px text-xs whitespace-nowrap text-muted-foreground tabular-nums md:block/);
  assert.match(screen, /<InviteActions id=\{invitationId\} className="shrink-0" \/>/);
  assert.match(screen, /<InviteActions id=\{invitationId\} className="mt-2 hidden md:flex" \/>/);
});

test('the clock is read once and only used after hydration', () => {
  assert.match(screen, /const \[clock\] = useState\(\(\) => Date\.now\(\)\);/);
  assert.match(screen, /pages && mounted \? timelineDays\(/);
  assert.match(screen, /rootRef: scrollRootRef,/);
});

test('the Work and Study tabs draw the timeline when signed in; the fallback draws the same header', () => {
  for (const [home, type] of [['WorkHome.tsx', 'work'], ['StudyHome.tsx', 'study']]) {
    const source = read('v2', 'shell', 'designs', home);
    assert.match(source, new RegExp(`if \\(signedIn\\) \\{\\s*return <TimelineHome tab="${type}" role=\\{role\\} />;`), home);
  }
  const fallback = read('v2', 'shell', 'designs', 'HomeFallback.tsx');
  assert.match(fallback, /<TimelineHeading type=\{tab\} \/>\s*<TimelineSkeleton \/>/);
});

/* Stay, 24 October 2026, on the timeline's push ask: "Yeah add it". The
 * signed-in Work and Study tabs keep the Chat tab's box at their foot: the
 * same composer and send, no prompt chips, docked in flow so the last row
 * scrolls above it. The fallback holds the box's place. */
test('the timeline tabs dock the chat box at their foot, in flow, with no prompts', () => {
  const home = read('v2', 'shell', 'designs', 'TimelineHome.tsx');
  assert.match(home, /<HomeTimeline type=\{tab\} \/>\s*<div className=\{TIMELINE_COMPOSER_DOCK\}>\s*<div aria-hidden className=\{TIMELINE_DOCK_FADE\} \/>\s*<HomeComposer/);
  assert.match(home, /signedIn\s*role=\{role\}\s*confidential=\{confidential\}/);
  assert.doesNotMatch(home, /HomePrompts/);
  const frame = read('v2', 'shell', 'designs', 'home-frame.ts');
  assert.match(frame, /export const HOME_SURFACE_TIMELINE =\s*'mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pt-5 sm:pt-6';/);
  // Sticky, never fixed: the dock takes its own height after the rows.
  assert.match(frame, /export const TIMELINE_COMPOSER_DOCK = 'sticky bottom-0 z-10 -mx-4 mt-auto px-4 pt-8 pb-3 md:pb-6';/);
  // Solid behind the pill and the box; only the top band, the dock's pt-8, fades.
  assert.match(frame, /bg-\[linear-gradient\(to_top,var\(--background\)_calc\(100%-2rem\),transparent\)\]/);
  const fallback = read('v2', 'shell', 'designs', 'HomeFallback.tsx');
  assert.match(fallback, /<TimelineSkeleton \/>\s*\{\/\*[^*]*\*\/\}\s*<div className=\{TIMELINE_COMPOSER_DOCK\}>\s*<ComposerShape \/>/);
});

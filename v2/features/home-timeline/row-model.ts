import { askedDate, dayKey } from '@/v2/features/activity/model';
import { folderHref } from '@/v2/features/folders/folder-row-model';
import type { TimelineActor, TimelineEvent, TimelineEventKind, TimelineSpace } from './types';

/**
 * row-model — the timeline's events as the rows the home draws, in the
 * "Activity" style of Stay's four pictures (24 October 2026: "It's too raw,
 * basically and empty. Use these for inspiration and make it simple but pop").
 *
 * ── THE ROW IS ONE SENTENCE ────────────────────────────────────────────────
 * Who in bold, what they did in grey, what they did it to in bold, then the
 * Space in grey: "Banner replied to you in Okafor & Co", "Case added 3 files
 * to Okonkwo & Partners" (`TimelineSentence`). The time sits on the right
 * ("12 min ago", "Yesterday"). A second, muted line only where it carries
 * meaning: the words someone wrote to you, or the question a chat is about.
 * No boxed cards. The avatar is the person's photo, else their initials on one
 * neutral grey (no coloured tiles), with a small round badge for what
 * happened (`TimelineBadge`); Lawexa is its mark.
 *
 * The actions stay, lighter: an invitation's Accept (the only gold) and
 * Decline, and a quiet Reply on what someone wrote to you. The rest of the row
 * opens its target.
 *
 * ── ONE ROW PER CHAT PER DAY ───────────────────────────────────────────────
 * A chat's started, answered, reply and mention events of one day are one
 * row: the newest of them, and "N new messages" on its grey line when there
 * were several (the server's `new_messages`). See {@link chatKey} for the
 * fields it groups on.
 *
 * Pure: the clock (`now`) and the time zone are passed in, so no date is read
 * in render and the day split is testable across a midnight.
 */

/** The avatar: a person (photo or initials), Lawexa's mark, or "?" for a deleted account. */
export type TimelineLead =
  | { type: 'lawexa' }
  | { type: 'person'; name: string; avatar: string | null }
  | { type: 'unknown' };

/** The small round icon on the avatar's corner: what happened. Lawexa's own rows carry none. */
export type TimelineBadge = 'file' | 'folder' | 'chat' | 'reply' | 'mention' | 'join' | 'invite' | 'request';

/**
 * The row as one sentence: `actor` and `object` bold, `verb` and `place`
 * grey. "Banner" "replied to you" — "in" "Okafor & Co".
 */
export interface TimelineSentence {
  actor: string;
  verb: string;
  object: string | null;
  /** The Space at the end ("in Okafor & Co", "to Okonkwo & Partners"); null when the object is the Space. */
  place: { word: 'in' | 'to'; name: string } | null;
}

export interface TimelineRow {
  key: string;
  lead: TimelineLead;
  badge: TimelineBadge | null;
  sentence: TimelineSentence;
  /** The sentence as plain words, for the row's label and a cut-off title. */
  title: string;
  /** The muted second line: what someone wrote, or the chat's question, with "3 new messages"; else null. */
  detail: string | null;
  /** "12 min ago", "Yesterday", "21 Oct"; '' until the clock is known. */
  time: string;
  /** When it happened (epoch ms), for the "Before your last visit" line. */
  atMs: number;
  /** Where the row opens; null for an invitation (its Space would refuse the reader until they accept). */
  href: string | null;
  /** Reply's address on what someone wrote to you; else null. */
  replyHref: string | null;
  /** An invitation: its member-row id for Accept and Decline, or null when the event carries no usable one. */
  invite: { invitationId: number | null } | null;
}

const KINDS: readonly TimelineEventKind[] = [
  'files_added',
  'folder_created',
  'chat_started',
  'lawexa_answered',
  'member_joined',
  'reply',
  'mention',
  'invite',
  'join_request',
  'role_request',
];

/**
 * Who, in a title: "You" for the reader, the first name of a name with a
 * space in it, the whole name otherwise, "Someone" for a deleted account.
 */
export function shortName(actor: TimelineActor | null | undefined): string {
  if (!actor) return 'Someone';
  if (actor.is_you) return 'You';
  const name = actor.name.trim();
  if (!name) return actor.kind === 'ai' ? 'Lawexa' : 'Someone';
  return name.split(/\s+/)[0];
}

/** The same person as the object of a sentence: "you" for the reader. */
function shortObject(actor: TimelineActor): string {
  return actor.is_you ? 'you' : shortName(actor);
}

/** The row's mark for whoever did it. */
export function leadFor(actor: TimelineActor | null): TimelineLead {
  if (!actor) return { type: 'unknown' };
  if (actor.kind === 'ai') return { type: 'lawexa' };
  return { type: 'person', name: actor.name, avatar: actor.avatar };
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * "Ada Okafor, Kemi Bello and 2 others are in it": who is already in the
 * Space an invitation is for. The names are the preview the server sends;
 * everyone else in the Space is counted.
 */
export function membersLine(names: readonly string[], memberCount: number): string {
  const shown = names.filter((name) => name.trim() !== '');
  const others = Math.max(0, memberCount - shown.length);
  if (shown.length === 0) {
    return `${memberCount} ${memberCount === 1 ? 'person is' : 'people are'} in it`;
  }
  const rest = others === 1 ? '1 other' : `${others} others`;
  if (others > 0) return `${shown.join(', ')} and ${rest} are in it`;
  if (shown.length === 1) return `${shown[0]} is in it`;
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]} are in it`;
}

/** "3 new messages": what a chat row of several events adds to its grey line. */
export function newMessagesLabel(count: number): string {
  return plural(count, 'new message', 'new messages');
}

function chatHref(id: number | string): string {
  return `/c/${encodeURIComponent(String(id))}`;
}

export function spaceHref(space: TimelineSpace): string {
  return `/spaces/${encodeURIComponent(space.uuid)}`;
}

function peopleHref(space: TimelineSpace): string {
  return `${spaceHref(space)}?tab=people`;
}

function foldersHref(space: TimelineSpace): string {
  return `${spaceHref(space)}?tab=folders`;
}

/** A space invitation's member-row id, the key the accept and decline routes take. */
export function invitationId(event: TimelineEvent): number | null {
  const target = event.action?.target;
  if (!target || target.type !== 'space_invite') return null;
  const id = target.id;
  if (typeof id === 'number') return Number.isInteger(id) && id > 0 ? id : null;
  return /^\d+$/.test(id) ? Number(id) : null;
}

/**
 * The chat an event belongs to, or null for an event that is not about a chat.
 * Keyed on `conversation.uuid` when the event carries one (reply, mention),
 * else on `items[0].id` (chat_started, lawexa_answered). Both are the chat's
 * uuid, the `/c/{uuid}` address.
 */
export function chatKey(event: TimelineEvent): string | null {
  switch (event.kind) {
    case 'reply':
    case 'mention':
      return event.conversation?.uuid ?? null;
    case 'chat_started':
    case 'lawexa_answered': {
      const id = event.conversation?.uuid ?? event.items[0]?.id;
      return id === undefined || id === null || id === '' ? null : String(id);
    }
    default:
      return null;
  }
}

/** The non-empty text, trimmed, or null. */
function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * One event as its row, or null for a kind this screen does not know yet.
 * `messages` is how many of the chat's messages of the day this row stands
 * for (see {@link timelineDays}); above one, the second line says so.
 */
export function timelineRow(
  event: TimelineEvent,
  now: number | null,
  messages = 1,
  timeZone?: string,
): TimelineRow | null {
  if (!KINDS.includes(event.kind)) return null;
  const atMs = Date.parse(event.at);
  const who = shortName(event.actor);
  const inSpace = { word: 'in', name: event.space.name } as const;
  const toSpace = { word: 'to', name: event.space.name } as const;
  /** The row from its sentence and the rest; the title is the sentence in plain words. */
  const build = (
    sentence: TimelineSentence,
    fields: Pick<TimelineRow, 'badge' | 'detail' | 'href'> & Partial<Pick<TimelineRow, 'lead' | 'replyHref' | 'invite'>>,
  ): TimelineRow => ({
    key: event.id,
    lead: fields.lead ?? leadFor(event.actor),
    badge: fields.badge,
    sentence,
    title: sentenceText(sentence),
    detail: fields.detail,
    time: activityTime(event.at, now, timeZone),
    atMs: Number.isNaN(atMs) ? 0 : atMs,
    href: fields.href,
    replyHref: fields.replyHref ?? null,
    invite: fields.invite ?? null,
  });
  /** A chat row's second line: its words, then "3 new messages" when it stands for several. */
  const chatDetail = (words: string | null): string | null =>
    [words, messages > 1 ? newMessagesLabel(messages) : null].filter(Boolean).join(' · ') || null;

  switch (event.kind) {
    case 'files_added': {
      const first = event.items[0];
      if (!first) return null;
      const object = event.count <= 1 ? first.name : plural(event.count, 'file', 'files');
      return build({ actor: who, verb: 'added', object, place: toSpace }, { badge: 'file', detail: null, href: spaceHref(event.space) });
    }
    case 'folder_created': {
      const folder = event.items[0];
      if (!folder) return null;
      // Several folders made in one hour are one row (the server groups by the hour).
      const several = event.count > 1;
      return build(
        { actor: who, verb: 'made', object: several ? plural(event.count, 'folder', 'folders') : folder.name, place: inSpace },
        // `url` is absolute (the server's own host); the folder's uuid is the address.
        { badge: 'folder', detail: null, href: several ? foldersHref(event.space) : folderHref(folder.id) },
      );
    }
    case 'chat_started': {
      const chat = event.items[0];
      if (!chat) return null;
      return build(
        { actor: who, verb: 'started a chat', object: null, place: inSpace },
        { badge: 'chat', detail: chatDetail(text(chat.question) ?? chat.title), href: chatHref(chat.id) },
      );
    }
    case 'lawexa_answered': {
      const chat = event.items[0];
      if (!chat) return null;
      const asker = event.asked_by;
      return build(
        { actor: 'Lawexa', verb: 'answered', object: asker ? shortObject(asker) : null, place: inSpace },
        { lead: { type: 'lawexa' }, badge: null, detail: chatDetail(text(chat.question) ?? chat.title), href: chatHref(chat.id) },
      );
    }
    case 'member_joined':
      return build({ actor: who, verb: 'joined', object: event.space.name, place: null }, { badge: 'join', detail: null, href: peopleHref(event.space) });
    case 'reply':
    case 'mention': {
      const conversation = event.conversation;
      if (!conversation) return null;
      const href = chatHref(conversation.uuid);
      const reply = event.kind === 'reply';
      return build(
        { actor: who, verb: reply ? 'replied to you' : 'mentioned you', object: null, place: inSpace },
        { badge: reply ? 'reply' : 'mention', detail: chatDetail(text(event.excerpt) ?? conversation.title), href, replyHref: href },
      );
    }
    case 'invite':
      // The reader is not in the Space yet, so the row opens nothing: its answer is Accept or Decline.
      return build(
        { actor: who, verb: 'invited you to', object: event.space.name, place: null },
        {
          badge: 'invite',
          detail: membersLine(event.members_preview ?? [], event.space.member_count),
          href: null,
          invite: { invitationId: event.needs_action && event.action?.type === 'accept' ? invitationId(event) : null },
        },
      );
    case 'join_request':
      return build({ actor: who, verb: 'asked to join', object: event.space.name, place: null }, { badge: 'join', detail: null, href: peopleHref(event.space) });
    case 'role_request':
      return build({ actor: who, verb: 'asked for a new role in', object: event.space.name, place: null }, { badge: 'request', detail: null, href: peopleHref(event.space) });
  }
}

/** The sentence in plain words: "Banner replied to you in Okafor & Co". */
export function sentenceText(sentence: TimelineSentence): string {
  return [sentence.actor, sentence.verb, sentence.object, sentence.place ? `${sentence.place.word} ${sentence.place.name}` : null]
    .filter(Boolean)
    .join(' ');
}

/**
 * The time on the right: "Just now", "12 min ago" and "3 hours ago" today,
 * then "Yesterday", "21 Oct", "31 Dec 2025" (the day words of the headings);
 * '' until the clock is known.
 */
export function activityTime(at: string, now: number | null, timeZone?: string): string {
  if (now === null) return '';
  const time = Date.parse(at);
  const day = dayKey(at, timeZone);
  const today = dayKey(now, timeZone);
  if (Number.isNaN(time) || day === null || today === null) return '';
  if (day !== today) return askedDate(day, today);
  const minutes = Math.max(0, Math.floor((now - time) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
}

/** One day of the timeline: its heading and its rows, newest first. */
export interface TimelineDay {
  /** `YYYY-MM-DD` in the viewer's time zone. */
  key: string;
  /** "Today", "Yesterday", "21 Oct", "31 Dec 2025". */
  label: string;
  rows: TimelineRow[];
}

/**
 * The events cut into days, in the viewer's time zone, with the activity
 * page's day words. The list arrives newest first, so a day is one run of
 * events; an event seen twice (a page boundary moved under a new event) is
 * drawn once, and an event with an unreadable time is left out.
 *
 * A chat's events of one day (same {@link chatKey}, same day) are one row: the
 * newest event draws it, at the place of the first of them in the list. The
 * messages it stands for are the server's `new_messages` (the chat's turns
 * that UTC day; the largest any of its events carries), and only when no
 * event carries it, the number of its events.
 */
export function timelineDays(
  events: readonly TimelineEvent[],
  now: number,
  timeZone?: string,
): TimelineDay[] {
  const todayKey = dayKey(now, timeZone);
  if (todayKey === null) return [];

  // Pass 1: the events once each, with their day, and each chat-day's newest
  // event and its message count.
  const seen = new Set<string>();
  const dated: { event: TimelineEvent; day: string; chat: string | null }[] = [];
  const chats = new Map<string, { newest: TimelineEvent; events: number; server: number | null }>();
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const day = dayKey(event.at, timeZone);
    if (day === null) continue;
    const key = chatKey(event);
    const chat = key === null ? null : `${key}|${day}`;
    dated.push({ event, day, chat });
    if (chat === null) continue;
    const group = chats.get(chat);
    const server = serverMessages(event);
    if (!group) chats.set(chat, { newest: event, events: 1, server });
    else {
      group.events += 1;
      if (server !== null) group.server = Math.max(group.server ?? 0, server);
      if (Date.parse(event.at) > Date.parse(group.newest.at)) group.newest = event;
    }
  }

  // Pass 2: the rows, a chat-day once, where it first appears.
  const drawn = new Set<string>();
  const days: TimelineDay[] = [];
  for (const { event, day, chat } of dated) {
    let row: TimelineRow | null;
    if (chat === null) row = timelineRow(event, now, 1, timeZone);
    else {
      if (drawn.has(chat)) continue;
      drawn.add(chat);
      const group = chats.get(chat);
      row = group ? timelineRow(group.newest, now, group.server ?? group.events, timeZone) : null;
    }
    if (row === null) continue;
    const last = days[days.length - 1];
    if (last && last.key === day) last.rows.push(row);
    else days.push({ key: day, label: askedDate(day, todayKey), rows: [row] });
  }
  return days;
}

/** The server's count of a chat's turns that day, or null when it sends none. */
function serverMessages(event: TimelineEvent): number | null {
  const value = event.new_messages;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Where the "New since your last visit" line goes: the key of the first row
 * older than the last visit, when at least one newer row is above it. Null on
 * a first visit (no last visit stored), and when every loaded row is new or
 * none is.
 */
export function newSinceRowKey(days: readonly TimelineDay[], lastSeen: number | null): string | null {
  if (lastSeen === null) return null;
  let anyNew = false;
  for (const day of days) {
    for (const row of day.rows) {
      if (row.atMs > lastSeen) anyNew = true;
      else return anyNew ? row.key : null;
    }
  }
  return null;
}

/** The header's "N updates": how many rows today has (the first day, when it is today). */
export function todayUpdates(days: readonly TimelineDay[]): number {
  const first = days[0];
  return first && first.label === 'Today' ? first.rows.length : 0;
}

/** "1 update", "5 updates". */
export function updatesLabel(count: number): string {
  return plural(count, 'update', 'updates');
}

/** The newest moment on the list (epoch ms), what "seen" is written as; null when empty. */
export function newestAt(days: readonly TimelineDay[]): number | null {
  let newest: number | null = null;
  for (const day of days) for (const row of day.rows) if (newest === null || row.atMs > newest) newest = row.atMs;
  return newest;
}

/** Empty pages followed in a row before the screen stops and shows what it has. */
export const EMPTY_PAGE_CAP = 5;

/** How many pages at the end of the list came back with no events. */
export function emptyPagesInARow(pages: readonly { events: readonly unknown[] }[]): number {
  let empty = 0;
  for (let index = pages.length - 1; index >= 0 && pages[index].events.length === 0; index -= 1) {
    empty += 1;
  }
  return empty;
}

/**
 * Whether to ask for the next page without waiting for a scroll. A page can
 * come back empty and still carry a cursor (the server filters after it reads),
 * so an empty last page is followed at once, up to {@link EMPTY_PAGE_CAP} of
 * them in a row; after that the screen shows what there is.
 */
export function followEmptyCursor(
  pages: readonly { events: readonly unknown[] }[],
  hasNextPage: boolean,
): boolean {
  const empty = emptyPagesInARow(pages);
  return hasNextPage && empty > 0 && empty < EMPTY_PAGE_CAP;
}

/** Whether scrolling may still load more: not once the empty pages hit the cap. */
export function canScrollForMore(
  pages: readonly { events: readonly unknown[] }[],
  hasNextPage: boolean,
): boolean {
  return hasNextPage && emptyPagesInARow(pages) < EMPTY_PAGE_CAP;
}

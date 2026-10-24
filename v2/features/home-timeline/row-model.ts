import { askedDate, dayKey } from '@/v2/features/activity/model';
import { folderHref } from '@/v2/features/folders/folder-row-model';
import { fileTypeLabel } from '@/v2/features/spaces/content-model';
import { formatRelativeTime } from '@/v2/shell/designs/modules/meta';
import type {
  TimelineActor,
  TimelineEvent,
  TimelineEventKind,
  TimelineFileItem,
  TimelineFolderItem,
  TimelineSpace,
} from './types';

/**
 * row-model — the timeline's events as the rows the home draws (Stay said yes
 * to the design, 24 October 2026; the mock is
 * `journeys/results/timeline-final/mocks3.html`; the nine fixes after Stay's
 * "criticize the ui/ux design", 25 October 2026, are below).
 *
 * ── THE ROW ────────────────────────────────────────────────────────────────
 * A 20px lead, a title that says who did what ("Kemi added 3 files"), one grey
 * line, the time on the title's baseline. The lead is ONE kind of mark: the
 * person's initials on one neutral grey, the same for everyone (no coloured
 * tiles, Stay, 24 October 2026), or Lawexa's mark; a deleted account is a "?"
 * on the same grey. The grey line STARTS with the Space's name,
 * which links to the Space and is never the part that is cut.
 *
 * Under a row there is at most one card, and it is one of four: the words
 * someone wrote to you with a Reply, an invitation with Accept and Decline, a
 * chat Lawexa answered (the question, then the first line of the answer), or
 * the files or folders someone added.
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

/** The grey icon of a line inside the files card. */
export type TimelineIcon = 'document' | 'image' | 'video' | 'audio' | 'folder';

/** The row's one mark: a person's initials, Lawexa's mark, or "?" for a deleted account. */
export type TimelineLead =
  | { type: 'lawexa' }
  | { type: 'person'; name: string; avatar: string | null }
  | { type: 'unknown' };

/** One line inside the files card: a file, or a folder of a several-folder row. */
export interface TimelineFileLine {
  key: string;
  name: string;
  icon: TimelineIcon;
  /** The fact on the right: a file's "PDF · 4 pages", a folder's "3 items". */
  size: string | null;
}

export type TimelineCard =
  | { type: 'quote'; text: string; replyHref: string }
  | {
      type: 'invite';
      spaceName: string;
      /** "Work · Private · 4 members". */
      facts: string;
      /** The invitation's member-row id, the accept and decline routes' key; null
       *  when the event carries no usable one, and then there are no buttons. */
      invitationId: number | null;
    }
  | {
      type: 'chat';
      /** The question, on one line; the chat's title when the server sends none. */
      question: string;
      /** The first line of the answer; null when the server sends none. */
      answer: string | null;
      href: string;
    }
  | { type: 'files'; files: TimelineFileLine[]; more: number };

/** The grey line: the Space first (a link, never cut), then the rest (cut first). */
export interface TimelineMeta {
  /** `null` on an invitation: the reader is not in that Space yet, so its page
   *  would refuse them, and its name is on the card (techlead, 24 October 2026). */
  space: { name: string; href: string } | null;
  /** What follows the Space's name; '' for nothing. */
  rest: string;
}

export interface TimelineRow {
  key: string;
  lead: TimelineLead;
  title: string;
  meta: TimelineMeta;
  /** "12m"; '' until the clock is known. */
  time: string;
  /** When it happened (epoch ms), for the "new since your last visit" line. */
  atMs: number;
  /** Where the row opens; null for a row that only carries its card (an invitation). */
  href: string | null;
  card: TimelineCard | null;
}

/** The files card lists this many, then says how many more there are. */
export const FILES_CARD_LIMIT = 3;

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

/** "Work · Private · 4 members": what a Space is, in one line. */
export function spaceFacts(space: TimelineSpace): string {
  const type = space.type === 'study' ? 'Study' : 'Work';
  const visibility = space.visibility === 'public' ? 'Public' : 'Private';
  return `${type} · ${visibility} · ${plural(space.member_count, 'member', 'members')}`;
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

function fileIcon(file: TimelineFileItem): TimelineIcon {
  if (file.kind === 'image') return 'image';
  if (file.kind === 'video') return 'video';
  if (file.kind === 'audio') return 'audio';
  return 'document';
}

/** "PDF · 4 pages": a file's type and its pages, or the type alone when the pages are unknown. */
export function fileFacts(file: Pick<TimelineFileItem, 'name' | 'mime_type' | 'page_count'>): string {
  const type = fileTypeLabel({ mime_type: file.mime_type, original_name: file.name });
  const pages = file.page_count;
  return typeof pages === 'number' && Number.isInteger(pages) && pages > 0
    ? `${type} · ${plural(pages, 'page', 'pages')}`
    : type;
}

/**
 * The files card: up to {@link FILES_CARD_LIMIT} files, then "and N more"
 * counted against the event's `count` (the server sends five at most, and
 * the count covers them all).
 */
export function filesCard(files: readonly TimelineFileItem[], count: number): TimelineCard {
  const shown = files.slice(0, FILES_CARD_LIMIT);
  return {
    type: 'files',
    files: shown.map((file) => ({
      key: String(file.id),
      name: file.name,
      icon: fileIcon(file),
      size: fileFacts(file),
    })),
    more: Math.max(0, Math.max(count, files.length) - shown.length),
  };
}

/** "3 items": a folder's items and subfolders together, as the server counts them. */
export function folderItemsLabel(count: number): string {
  return plural(count, 'item', 'items');
}

/** The several-folder row's card: the files card's lines, with folders in them. */
export function foldersCard(folders: readonly TimelineFolderItem[], count: number): TimelineCard {
  const shown = folders.slice(0, FILES_CARD_LIMIT);
  return {
    type: 'files',
    files: shown.map((folder) => ({
      key: folder.id,
      name: folder.name,
      icon: 'folder',
      size: folderItemsLabel(folder.item_count),
    })),
    more: Math.max(0, Math.max(count, folders.length) - shown.length),
  };
}

/** "and 2 more", or '' when the card lists every file. */
export function moreFilesLabel(more: number): string {
  return more > 0 ? `and ${more} more` : '';
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
 * for (see {@link timelineDays}); above one, the grey line says so.
 */
export function timelineRow(event: TimelineEvent, now: number | null, messages = 1): TimelineRow | null {
  if (!KINDS.includes(event.kind)) return null;
  const atMs = Date.parse(event.at);
  const who = shortName(event.actor);
  const space = { name: event.space.name, href: spaceHref(event.space) };
  const meta = (rest: string): TimelineMeta => ({ space, rest: messages > 1 ? newMessagesLabel(messages) : rest });
  const base = {
    key: event.id,
    time: formatRelativeTime(event.at, now),
    atMs: Number.isNaN(atMs) ? 0 : atMs,
    lead: leadFor(event.actor),
  };

  switch (event.kind) {
    case 'files_added': {
      const first = event.items[0];
      if (!first) return null;
      if (event.count <= 1) {
        return {
          ...base,
          title: `${who} added ${first.name}`,
          meta: meta(fileFacts(first)),
          href: spaceHref(event.space),
          card: null,
        };
      }
      return {
        ...base,
        title: `${who} added ${event.count} files`,
        meta: meta(''),
        href: spaceHref(event.space),
        card: filesCard(event.items, event.count),
      };
    }
    case 'folder_created': {
      const folder = event.items[0];
      if (!folder) return null;
      // Several folders made in one hour are one row (the server groups by
      // the hour): it names how many, and the files card lists them.
      if (event.count > 1) {
        return {
          ...base,
          title: `${who} made ${event.count} folders`,
          meta: meta(''),
          href: foldersHref(event.space),
          card: foldersCard(event.items, event.count),
        };
      }
      return {
        ...base,
        title: `${who} made ${folder.name}`,
        meta: meta(`Folder · ${folderItemsLabel(folder.item_count)}`),
        // `url` is absolute (the server's own host); the folder's uuid is the address.
        href: folderHref(folder.id),
        card: null,
      };
    }
    case 'chat_started': {
      const chat = event.items[0];
      if (!chat) return null;
      return {
        ...base,
        title: `${who} started a chat`,
        meta: meta(text(chat.question) ?? chat.title),
        href: chatHref(chat.id),
        card: null,
      };
    }
    case 'lawexa_answered': {
      const chat = event.items[0];
      if (!chat) return null;
      const asker = event.asked_by;
      return {
        ...base,
        lead: { type: 'lawexa' },
        title: asker ? `Lawexa answered ${shortObject(asker)}` : 'Lawexa answered',
        meta: meta(''),
        href: chatHref(chat.id),
        card: {
          type: 'chat',
          question: text(chat.question) ?? chat.title,
          answer: text(chat.answer_preview),
          href: chatHref(chat.id),
        },
      };
    }
    case 'member_joined':
      return {
        ...base,
        title: `${who} joined`,
        meta: meta(plural(event.space.member_count, 'member', 'members')),
        href: peopleHref(event.space),
        card: null,
      };
    case 'reply':
    case 'mention': {
      const conversation = event.conversation;
      if (!conversation) return null;
      const href = chatHref(conversation.uuid);
      const excerpt = text(event.excerpt);
      return {
        ...base,
        title: `${who} ${event.kind === 'reply' ? 'replied to you' : 'mentioned you'}`,
        meta: meta(conversation.title),
        href,
        card: excerpt ? { type: 'quote', text: excerpt, replyHref: href } : null,
      };
    }
    case 'invite':
      return {
        ...base,
        // The Space is named once, on the card; the grey line says who is in it.
        title: `${who} invited you to a Space`,
        meta: { space: null, rest: membersLine(event.members_preview ?? [], event.space.member_count) },
        href: null,
        card: {
          type: 'invite',
          spaceName: event.space.name,
          facts: spaceFacts(event.space),
          invitationId: event.needs_action && event.action?.type === 'accept' ? invitationId(event) : null,
        },
      };
    case 'join_request':
      return {
        ...base,
        title: `${who} asked to join`,
        meta: meta(spaceFacts(event.space)),
        href: peopleHref(event.space),
        card: null,
      };
    case 'role_request':
      return {
        ...base,
        title: `${who} asked for a new role`,
        meta: meta(spaceFacts(event.space)),
        href: peopleHref(event.space),
        card: null,
      };
  }
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
    if (chat === null) row = timelineRow(event, now);
    else {
      if (drawn.has(chat)) continue;
      drawn.add(chat);
      const group = chats.get(chat);
      row = group ? timelineRow(group.newest, now, group.server ?? group.events) : null;
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

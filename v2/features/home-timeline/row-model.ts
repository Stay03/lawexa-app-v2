import { askedDate, dayKey } from '@/v2/features/activity/model';
import { folderHref } from '@/v2/features/folders/folder-row-model';
import { fileSize } from '@/v2/features/folders/item-row-model';
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
 * row-model — one timeline event as the ONE row the home draws for it (Stay
 * said yes to the design, 24 October 2026; the mock is
 * `journeys/results/timeline-final/mocks3.html`).
 *
 * EVERY EVENT IS ONE ROW: a 20px lead (a grey icon, Lawexa's mark, or the
 * person's face), the title, one grey meta line, the time on the title's
 * baseline. Under a row there is at most one card, and it is one of four: the
 * words someone wrote to you with a Reply, an invitation with Accept and
 * Decline, a chat Lawexa answered, or the files someone added.
 *
 * Pure: the clock (`now`) and the time zone are passed in, so no date is read
 * in render and the day split is testable across a midnight.
 */

/** The grey icon a row leads with; the screen maps each to its lucide icon. */
export type TimelineIcon =
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'files'
  | 'folder'
  | 'chat'
  | 'invite'
  | 'joined'
  | 'join-request'
  | 'role-request'
  /** A person with no account any more ("Someone"). */
  | 'person';

export type TimelineLead =
  | { type: 'icon'; icon: TimelineIcon }
  | { type: 'lawexa' }
  | { type: 'person'; name: string; avatar: string | null; tint: number };

/** One line inside the files card: a file, or a folder of a several-folder row. */
export interface TimelineFileLine {
  key: string;
  name: string;
  icon: TimelineIcon;
  /** The fact on the right: a file's "1.2 MB", a folder's "3 items"; null when unreadable. */
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
  | { type: 'chat'; title: string; meta: string; href: string }
  | { type: 'files'; files: TimelineFileLine[]; more: number };

export interface TimelineRow {
  key: string;
  lead: TimelineLead;
  title: string;
  meta: string;
  /** "12m"; '' until the clock is known. */
  time: string;
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

/** The palette slots of `member-colour.ts`; the face's tint is picked from them. */
const TINTS = 8;

/** "You" for the reader, the name for anyone else, "Someone" for a deleted account. */
export function actorLabel(actor: TimelineActor | null | undefined): string {
  if (!actor) return 'Someone';
  if (actor.is_you) return 'You';
  return actor.name.trim() || (actor.kind === 'ai' ? 'Lawexa' : 'Someone');
}

/** A stable palette slot for a person, from their id, so a face keeps its tint. */
export function tintIndex(id: number | string | null): number {
  if (id === null) return 0;
  if (typeof id === 'number' && Number.isFinite(id)) return Math.abs(Math.trunc(id)) % TINTS;
  let hash = 0;
  for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % TINTS;
}

function leadFor(actor: TimelineActor | null): TimelineLead {
  // A deleted account has no face: a grey person, like every other grey lead.
  if (!actor) return { type: 'icon', icon: 'person' };
  if (actor.kind === 'ai') return { type: 'lawexa' };
  return { type: 'person', name: actor.name, avatar: actor.avatar, tint: tintIndex(actor.id) };
}

/** "Work · Private · 4 members": what a Space is, in one line. */
export function spaceFacts(space: TimelineSpace): string {
  const type = space.type === 'study' ? 'Study' : 'Work';
  const visibility = space.visibility === 'public' ? 'Public' : 'Private';
  const members = `${space.member_count} ${space.member_count === 1 ? 'member' : 'members'}`;
  return `${type} · ${visibility} · ${members}`;
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

/** "PDF · 4.8 MB": a file's type and size, as the Space list prints them. */
function fileFacts(file: TimelineFileItem): string {
  const type = fileTypeLabel({ mime_type: file.mime_type, original_name: file.name });
  const size = fileSize(file.size_bytes);
  return size ? `${type} · ${size}` : type;
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
      size: fileSize(file.size_bytes),
    })),
    more: Math.max(0, Math.max(count, files.length) - shown.length),
  };
}

/** "3 items": a folder's items and subfolders together, as the server counts them. */
export function folderItemsLabel(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
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

function chatHref(id: number | string): string {
  return `/c/${encodeURIComponent(String(id))}`;
}

function spaceHref(space: TimelineSpace): string {
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

/** One event as its row, or null for a kind this screen does not know yet. */
export function timelineRow(event: TimelineEvent, now: number | null): TimelineRow | null {
  if (!KINDS.includes(event.kind)) return null;
  const actor = actorLabel(event.actor);
  const space = event.space.name;
  const base = { key: event.id, time: formatRelativeTime(event.at, now) };

  switch (event.kind) {
    case 'files_added': {
      const first = event.items[0];
      if (!first) return null;
      if (event.count <= 1) {
        return {
          ...base,
          lead: { type: 'icon', icon: fileIcon(first) },
          title: first.name,
          meta: `${fileFacts(first)} · ${actor} · ${space}`,
          href: spaceHref(event.space),
          card: null,
        };
      }
      return {
        ...base,
        lead: { type: 'icon', icon: 'files' },
        // The Space is the grey line, so the title does not say it twice.
        title: `${actor} added ${event.count} files`,
        meta: space,
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
          lead: { type: 'icon', icon: 'folder' },
          title: `${actor} created ${event.count} folders`,
          meta: space,
          href: foldersHref(event.space),
          card: foldersCard(event.items, event.count),
        };
      }
      return {
        ...base,
        lead: { type: 'icon', icon: 'folder' },
        title: folder.name,
        meta: `${folderItemsLabel(folder.item_count)} · ${actor} · ${space}`,
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
        lead: { type: 'icon', icon: 'chat' },
        title: chat.title,
        meta: `${actor} · ${space}`,
        href: chatHref(chat.id),
        card: null,
      };
    }
    case 'lawexa_answered': {
      const chat = event.items[0];
      if (!chat) return null;
      const asker = event.asked_by;
      const answered = asker ? (asker.is_you ? 'you' : asker.name) : null;
      return {
        ...base,
        lead: { type: 'lawexa' },
        title: answered ? `Lawexa answered ${answered}` : 'Lawexa answered',
        meta: space,
        href: chatHref(chat.id),
        card: {
          type: 'chat',
          title: chat.title,
          meta: asker ? `${actorLabel(asker)} asked` : space,
          href: chatHref(chat.id),
        },
      };
    }
    case 'member_joined':
      return {
        ...base,
        lead: { type: 'icon', icon: 'joined' },
        title: `${actor} joined ${space}`,
        meta: spaceFacts(event.space),
        href: peopleHref(event.space),
        card: null,
      };
    case 'reply':
    case 'mention': {
      const conversation = event.conversation;
      if (!conversation) return null;
      const href = chatHref(conversation.uuid);
      const text = event.excerpt?.trim() ?? '';
      return {
        ...base,
        lead: leadFor(event.actor),
        title: `${actor} ${event.kind === 'reply' ? 'replied to you' : 'mentioned you'}`,
        meta: `${conversation.title} · ${space}`,
        href,
        card: text ? { type: 'quote', text, replyHref: href } : null,
      };
    }
    case 'invite':
      return {
        ...base,
        lead: { type: 'icon', icon: 'invite' },
        title: `${actor} invited you to a Space`,
        meta: membersLine(event.members_preview ?? [], event.space.member_count),
        href: null,
        card: {
          type: 'invite',
          spaceName: space,
          facts: spaceFacts(event.space),
          invitationId: event.needs_action && event.action?.type === 'accept' ? invitationId(event) : null,
        },
      };
    case 'join_request':
      return {
        ...base,
        lead: { type: 'icon', icon: 'join-request' },
        title: `${actor} asked to join ${space}`,
        meta: spaceFacts(event.space),
        href: peopleHref(event.space),
        card: null,
      };
    case 'role_request':
      return {
        ...base,
        lead: { type: 'icon', icon: 'role-request' },
        title: `${actor} asked for a new role in ${space}`,
        meta: spaceFacts(event.space),
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
 */
export function timelineDays(
  events: readonly TimelineEvent[],
  now: number,
  timeZone?: string,
): TimelineDay[] {
  const todayKey = dayKey(now, timeZone);
  if (todayKey === null) return [];
  const seen = new Set<string>();
  const days: TimelineDay[] = [];
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const key = dayKey(event.at, timeZone);
    const row = key === null ? null : timelineRow(event, now);
    if (key === null || row === null) continue;
    const last = days[days.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else days.push({ key, label: askedDate(key, todayKey), rows: [row] });
  }
  return days;
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

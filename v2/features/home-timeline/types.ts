/**
 * The wire shape of `GET /api/home/timeline`, as Backend's local server sends
 * it (read 24 October 2026, `timeline-work.fixture.json`). Every field the
 * screen cannot do without is checked again in `row-model.ts` before a row is
 * drawn.
 *
 * What the server does that the first agreement did not say: a deleted
 * account's event has no actor (`null`); Lawexa with no agent has a null id
 * and the name "Lawexa"; rows are grouped by UTC clock hour under a stable id
 * (`files_added:{space}:{actor}:{YYYYMMDDHH}`); a page can be empty and still
 * carry a cursor; links in `url` are absolute.
 */

/** Which home tab the timeline is for: the Work Spaces or the Study Spaces. */
export type TimelineType = 'work' | 'study';

/** Who did it. `ai` is Lawexa (its `name` is the agent's, or "Lawexa" with a
 *  null id when there is no agent); `is_you` reads "You". */
export interface TimelineActor {
  id: number | string | null;
  name: string;
  avatar: string | null;
  kind: 'user' | 'ai';
  is_you: boolean;
}

/** The Space it happened in. */
export interface TimelineSpace {
  uuid: string;
  name: string;
  type: 'work' | 'study';
  visibility: 'private' | 'public';
  member_count: number;
}

/** One file of a `files_added` event. `url` is an absolute link to the file in its Space. */
export interface TimelineFileItem {
  id: number | string;
  name: string;
  kind: 'document' | 'image' | 'video' | 'audio';
  mime_type: string;
  size_bytes: number;
  url: string;
}

/** A folder of a `folder_created` event: `id` is the folder's uuid, `url` an
 *  absolute link, `item_count` its items and subfolders together. */
export interface TimelineFolderItem {
  id: string;
  name: string;
  url: string;
  item_count: number;
}

/** The chat of a `chat_started` or `lawexa_answered` event. */
export interface TimelineChatItem {
  id: number | string;
  title: string;
  url: string;
}

/** What the reader can do about an event, and on what. `target.id` is the
 *  `space_members` row id the accept / approve routes take. */
export interface TimelineAction {
  type: 'reply' | 'accept' | 'review';
  target: {
    type: 'conversation' | 'space_invite' | 'join_request' | 'role_request';
    id: number | string;
  };
}

export type TimelineEventKind =
  | 'files_added'
  | 'folder_created'
  | 'chat_started'
  | 'lawexa_answered'
  | 'member_joined'
  | 'reply'
  | 'mention'
  | 'invite'
  | 'join_request'
  | 'role_request';

interface TimelineEventBase {
  id: string;
  /** ISO time the event happened (the latest, for a grouped row). */
  at: string;
  /** `null` for a deleted account. */
  actor: TimelineActor | null;
  /** For an invitation, a Space the reader may not be in yet. */
  space: TimelineSpace;
  /** How many things the event covers; `items` carries at most five of them. */
  count: number;
  needs_action?: boolean;
  excerpt?: string | null;
  action?: TimelineAction;
  conversation?: { uuid: string; title: string };
  /** On `lawexa_answered`: whose question Lawexa answered. */
  asked_by?: TimelineActor | null;
  /** On `invite`: up to two names of people already in the Space, never the reader's. */
  members_preview?: string[];
}

export type TimelineEvent =
  | (TimelineEventBase & { kind: 'files_added'; items: TimelineFileItem[] })
  | (TimelineEventBase & { kind: 'folder_created'; items: TimelineFolderItem[] })
  | (TimelineEventBase & { kind: 'chat_started' | 'lawexa_answered'; items: TimelineChatItem[] })
  | (TimelineEventBase & {
      kind: 'member_joined' | 'reply' | 'mention' | 'invite' | 'join_request' | 'role_request';
      items: readonly unknown[];
    });

/** One page of the timeline. */
export interface TimelinePage {
  events: TimelineEvent[];
  next_cursor: string | null;
}

/** The envelope; `success` and `message` are not read. */
export interface TimelineEnvelope {
  success?: boolean;
  message?: string;
  data: TimelinePage;
}

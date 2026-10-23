/**
 * The wire shape of `GET /api/home/timeline` (agreed with Backend, 24 October
 * 2026; not live yet). Typed from the agreed contract, not from a measured
 * page, so every field the screen cannot do without is checked again in
 * `row-model.ts` before a row is drawn.
 */

/** Which home tab the timeline is for: the Work Spaces or the Study Spaces. */
export type TimelineType = 'work' | 'study';

/** Who did it. `ai` is Lawexa (its `name` is the agent's); `is_you` reads "You". */
export interface TimelineActor {
  id: number | string;
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

/** One file of a `files_added` event. */
export interface TimelineFileItem {
  id: number | string;
  name: string;
  kind: 'document' | 'image' | 'media';
  mime_type: string;
  size_bytes: number;
  url: string;
}

/** The folder of a `folder_created` event. */
export interface TimelineFolderItem {
  id: number | string;
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

/** What the reader can do about an event, and on what. */
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
  /** ISO time the event happened. */
  at: string;
  actor: TimelineActor;
  space: TimelineSpace;
  /** How many things the event covers; `items` carries at most five of them. */
  count: number;
  needs_action?: true;
  excerpt?: string | null;
  action?: TimelineAction;
  conversation?: { uuid: string; title: string };
  /** On `lawexa_answered`: whose question Lawexa answered. */
  asked_by?: TimelineActor;
  /** On `invite`: the names of some of the people already in the Space. */
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

export interface TimelineEnvelope {
  data: TimelinePage;
}

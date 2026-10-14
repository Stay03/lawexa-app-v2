import type { MessageMention } from '@/types/chat';
import type { Member, MessageMetadata } from '@/types/collab';
import {
  buildMentionOptions,
  untaggableSentence,
  type MentionCandidate,
  type MentionOptions,
} from '@/v2/features/channels/model';

/**
 * mention-options — the pure rules of tagging people in a space chat (Stay, 14
 * October 2026; the techlead's contract of the same day). The channel feed's
 * rules (channels/model.ts), with a space chat's differences:
 *
 *  - The people offered are the space's active members, Viewers included (a
 *    Viewer reads the chat, so a question can be for them).
 *  - Lawexa is not offered: in a space chat every question already goes to it.
 *  - A member with no username cannot be tagged (the channel rule); the picker
 *    names them in one line instead of leaving them out without a word.
 *
 * The server parses the typed text itself (the `@handle`s), so the picker only
 * helps the reader type a handle that exists; it sends no list of its own.
 */

/** How many people the picker lists at once. */
export const MAX_MENTION_SUGGESTIONS = 6;

/** Who the `@` picker offers in a space chat, and who it explains instead. */
export function spaceMentionOptions(members: readonly Member[]): MentionOptions {
  const options = buildMentionOptions(members);
  return { candidates: options.candidates.filter((candidate) => candidate.user !== null), untaggable: options.untaggable };
}

/** An `@` being typed: the text after it, and where the `@` is. */
export interface MentionQuery {
  query: string;
  start: number;
}

/**
 * The `@token` the caret is at the end of, or null: an `@` at the start of the
 * text or after a space, then handle characters up to the caret. "a@b.com" is
 * an e-mail address, not a tag, so the `@` must follow a space.
 */
export function mentionQueryAt(value: string, caret: number): MentionQuery | null {
  const match = value.slice(0, caret).match(/(?:^|\s)@([a-z0-9._]*)$/i);
  if (!match) return null;
  return { query: match[1].toLowerCase(), start: caret - match[1].length - 1 };
}

/** The people whose handle or name holds the query, at most {@link MAX_MENTION_SUGGESTIONS}. */
export function mentionSuggestions(options: MentionOptions, query: string): MentionCandidate[] {
  return options.candidates
    .filter((candidate) => candidate.handle.includes(query) || candidate.name.toLowerCase().includes(query))
    .slice(0, MAX_MENTION_SUGGESTIONS);
}

/** The picker's line for the people the query names who have no handle ('' when none). */
export function untaggableFor(options: MentionOptions, query: string): string {
  return untaggableSentence(options.untaggable.filter((name) => name.toLowerCase().includes(query)));
}

/** The text with the typed `@query` replaced by `@handle `, and where the caret goes. */
export function applyMention(
  value: string,
  mention: MentionQuery,
  handle: string,
): { value: string; caret: number } {
  const before = value.slice(0, mention.start);
  const after = value.slice(mention.start + 1 + mention.query.length);
  // One space after the handle, unless the text already has one there.
  const inserted = /^\s/.test(after) ? `@${handle}` : `@${handle} `;
  return { value: before + inserted + after, caret: (before + inserted).length };
}

/**
 * The writer's line under their own question when `@`s tagged nobody. A hint,
 * not a failure: the question went, and ordinary text holds `@`s.
 */
export function spaceUnmatchedSentence(handles: readonly string[]): string {
  const unique = [...new Set(handles)];
  if (unique.length === 0) return '';
  const named = unique.map((handle) => `@${handle}`);
  const list =
    named.length === 1
      ? named[0]
      : named.length <= 3
        ? `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`
        : `${named.slice(0, 3).join(', ')} and ${named.length - 3} ${named.length - 3 === 1 ? 'other' : 'others'}`;
  return `${list} didn't match anyone in this space.`;
}

/**
 * The tags in a form the channel's text parser reads (lib/utils/collab.ts
 * `parseMessageContent`). Only entries with a uuid make chips: a reader outside
 * the space gets names only, and the server has already written those `@handle`s
 * as plain names in the text, so there is nothing to mark.
 */
export function mentionMetadata(mentions: readonly MessageMention[] | undefined): MessageMetadata | null {
  const tagged = (mentions ?? []).filter((mention): mention is MessageMention & { uuid: string } => !!mention.uuid);
  if (tagged.length === 0) return null;
  return {
    mentions: tagged.map((mention) => ({ uuid: mention.uuid, name: mention.name, username: mention.username ?? null })),
    lawexa_mentioned: false,
  };
}

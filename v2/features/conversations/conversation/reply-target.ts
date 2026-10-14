import type { MessageReplyTo } from '@/types/chat';
import type { DraftCodec } from './draft-store';
import { savedMessageId } from './markdown/export-target';
import { UNNAMED_ASKER } from './space-turn';

/**
 * reply-target — the pure rules of a reply in a space chat (Stay, 14 October
 * 2026: "replies should be like how whatsapp replies are"; techlead's contract
 * of the same day). No JSX and no hooks, so the rows, the composer and the
 * tests read the same answers.
 *
 * A reader replies to a saved question or a saved Lawexa answer. The turn
 * names it by its saved id (`reply_to_message_id`); the server sends the quote
 * back on the row as `reply_to`, and the row this client draws carries the same
 * quote until the server's copy replaces it.
 */

/** How much of the target the client keeps for its own quote (the server sends 200). */
export const REPLY_PREVIEW_CHARS = 200;

/** The fields of a transcript row these rules read. */
export interface ReplyableRow {
  id: string;
  role: string;
  content: string;
  isStreaming?: boolean;
  /** The server id an answer this client streamed was saved under (answer-id.ts). */
  savedId?: number;
  /** Set on handover, narration and error rows; a plain answer has none. */
  messageType?: string;
  author?: MessageReplyTo['author'];
}

/** A row's saved id: `msg_{id}` from history, or the id stamped on a streamed answer. */
export function savedIdOf(row: Pick<ReplyableRow, 'id' | 'savedId'>): number | null {
  return row.savedId ?? savedMessageId(row.id);
}

/**
 * The quote a reply to this row carries, or null when it cannot be replied to:
 * a row not saved yet (no server id), one still streaming, a step, a handover,
 * an error, or a row with no words. The server refuses the same targets.
 */
export function replyTargetOf(row: ReplyableRow): MessageReplyTo | null {
  if (row.role !== 'user' && row.role !== 'assistant') return null;
  if (row.role === 'assistant' && row.messageType) return null;
  if (row.isStreaming) return null;
  const id = savedIdOf(row);
  if (id === null) return null;
  const text = row.content.trim();
  if (text === '') return null;
  return {
    id,
    role: row.role,
    // A question's writer as the reader was shown it; an answer is Lawexa's.
    author: row.role === 'user' ? (row.author ?? null) : null,
    preview: text.slice(0, REPLY_PREVIEW_CHARS),
    is_unavailable: false,
  };
}

/** Who the quote names: "Lawexa", "You", the writer, or "Someone" when withheld. */
export function replyAuthorLabel(replyTo: MessageReplyTo, viewerId: number | null): string {
  if (replyTo.role === 'assistant') return 'Lawexa';
  const author = replyTo.author;
  if (author === null) return UNNAMED_ASKER;
  if (viewerId !== null && author.id === viewerId) return 'You';
  return author.name;
}

/** The quote's one line: the preview without markdown marks, tags or line breaks. */
export function replySnippet(replyTo: MessageReplyTo): string {
  if (replyTo.is_unavailable || replyTo.preview === null) return '';
  return replyTo.preview
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|`)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The sentence a quote shows for a target that has been deleted. */
export const REPLY_UNAVAILABLE = 'Message unavailable';

function isReplyTo(value: unknown): value is MessageReplyTo {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const author = v.author;
  return (
    typeof v.id === 'number' &&
    (v.role === 'user' || v.role === 'assistant') &&
    (author === null ||
      (typeof author === 'object' && author !== null && typeof (author as Record<string, unknown>).id === 'number' && typeof (author as Record<string, unknown>).name === 'string')) &&
    (v.preview === null || typeof v.preview === 'string') &&
    typeof v.is_unavailable === 'boolean'
  );
}

/** The staged reply, kept with the chat's draft: a reload keeps it, another chat has its own. */
export const REPLY_DRAFT: DraftCodec<MessageReplyTo | null> = {
  empty: null,
  decode: (raw) => {
    try {
      const value: unknown = JSON.parse(raw);
      return isReplyTo(value) ? value : null;
    } catch {
      return null;
    }
  },
  encode: (value) => (value === null ? null : JSON.stringify(value)),
};

import { countDrafts } from './draft-blocks';

/**
 * draft-ordinals — where each of a chat's drafts sits, so a card and the side
 * panel name the same draft (`?side=draft:N`, side-panel-value.ts).
 *
 * A draft's ordinal is its place among every draft in the transcript, counted
 * in order through the assistant answers. A message's OFFSET is how many drafts
 * come before it, so its own drafts are offset, offset + 1, … . The answer
 * still streaming is the transcript's last and its text is not in `content`
 * yet, so it takes the count of everything saved before it, which is the
 * offset it will keep once saved.
 */

export interface DraftSourceMessage {
  id: string;
  role: string;
  content: string;
}

/** Each assistant message's offset, by id. */
export function draftOffsets(messages: readonly DraftSourceMessage[]): Map<string, number> {
  const offsets = new Map<string, number>();
  let seen = 0;
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    offsets.set(message.id, seen);
    seen += countDrafts(message.content);
  }
  return offsets;
}

/**
 * Which message holds draft `ordinal`, and its place inside that message.
 * `null` when the saved answers hold fewer drafts: then it is the streaming
 * answer's, at `ordinal − total`.
 */
export function locateDraft(
  messages: readonly DraftSourceMessage[],
  ordinal: number,
): { messageId: string; index: number } | { streamingIndex: number } {
  let seen = 0;
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    const count = countDrafts(message.content);
    if (ordinal < seen + count) return { messageId: message.id, index: ordinal - seen };
    seen += count;
  }
  return { streamingIndex: ordinal - seen };
}

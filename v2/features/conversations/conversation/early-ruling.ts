import type { QueryClient } from '@tanstack/react-query';

import type { ConversationData } from '@/types/chat';
import { listedConversation, spaceOfListedChat } from '../cache';
import { conversationsQueries } from '../queries';
import { canSendIn, viewOnlyReason, type ViewOnlyReason } from './space-turn';

/**
 * What a chat's message box needs to know before the chat's screen has mounted
 * (message box B, Stay, 17 October 2026): whose chat it is, whether the reader
 * may send, why not, and the chat's space. Read from what this device already
 * holds, in the order the controller trusts it: the chat's cached record, else
 * the row of a cached list the chat was tapped from (`listedConversation`). The
 * shell's dock reads it in the tap, so the real box is there in the tap's first
 * frame; once the screen publishes its own ruling (`route-composer.ts`), that
 * one wins.
 *
 * A chat the reader has just started (the home's box, a space's box) is in no
 * list yet but its placeholder row, which says nothing (owner 0). The box that
 * started it seeds the answer it knows for certain (`seedEarlyRuling`: the
 * reader owns it and may send), so the new chat's box is real from the move's
 * first frame instead of a skeleton.
 *
 * `null` when nothing knows the chat: a cold open from a pasted link or a
 * reload, where the box waits as its skeleton, as it always has.
 *
 * Pure: a read of the query cache, no hooks, so it runs under node:test.
 */
export interface EarlyRuling {
  ownerId: number;
  canSend: boolean;
  viewOnlyReason: ViewOnlyReason;
  spaceUuid: string | null;
  isConfidential: boolean;
}

/** The rulings seeded by a create, by conversation id. Module memory: a tab
 *  starts a handful of chats at most, and a seed is only read until the
 *  chat's record is cached. */
const seeded = new Map<string, EarlyRuling>();

/** A chat the reader just created: theirs, and they may send in it. */
export function seedEarlyRuling(conversationId: string, ruling: EarlyRuling): void {
  seeded.set(conversationId, ruling);
}

export function earlyRuling(
  queryClient: QueryClient,
  conversationId: string,
  viewerId: number | null,
): EarlyRuling | null {
  const detail = queryClient.getQueryData<ConversationData>(
    conversationsQueries.detail({ conversationId, viewerId }).queryKey,
  );
  if (detail && detail.user_id > 0) {
    // The record is the answer from here on; the seed is not needed again.
    seeded.delete(conversationId);
    const isOwner = viewerId !== null && detail.user_id === viewerId;
    return {
      ownerId: detail.user_id,
      canSend: canSendIn(detail, isOwner),
      viewOnlyReason: viewOnlyReason(detail),
      spaceUuid: detail.space?.uuid ?? null,
      isConfidential: Boolean(detail.is_confidential),
    };
  }
  const seed = seeded.get(conversationId);
  if (seed) return seed;
  const row = listedConversation(queryClient, conversationId);
  if (!row) return null;
  const isOwner = viewerId !== null && row.user_id === viewerId;
  return {
    ownerId: row.user_id,
    canSend: row.can_send ?? isOwner,
    // A list row carries no space role, so a reader who may not send reads it
    // as a shared chat until the record says Viewer (the controller's rule).
    viewOnlyReason: 'shared',
    spaceUuid: row.space?.uuid ?? spaceOfListedChat(queryClient, conversationId),
    isConfidential: Boolean(row.is_confidential),
  };
}

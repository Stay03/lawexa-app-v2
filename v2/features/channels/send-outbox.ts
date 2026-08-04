import { useSyncExternalStore } from 'react';

import type { Message } from '@/types/collab';

/**
 * send-outbox — the tiny external store carrying each optimistic message's
 * SEND STATE (`sending` → gone on success, `failed` until retried or
 * discarded) AND the optimistic row itself. Phase-5 W2; the send-state
 * ladder is foundation-standards §5 ("optimistic insert → sending (subtle) →
 * sent (nothing) → failed (red icon + Retry inline, never silently
 * dropped)") + design-research DIRECTION 9 (2026-08-04).
 *
 * WHY A STORE BESIDE THE QUERY CACHE, HOLDING THE FULL ROW. The optimistic
 * row is written into the message cache too (ordering + the scroll contract
 * read one list) — but the cache is REFETCHABLE state: the room's join-time
 * reconcile and the spine's reconnect invalidation replace pages wholesale,
 * and server pages cannot contain a row the server never accepted. If the
 * cache were the only home, any background refetch would silently drop an
 * unsent message — the exact failure the ladder bans. So this store is the
 * row's durable home while unacknowledged: the feed merges outbox rows that
 * a refetch evicted back into the transcript, and only success (or an
 * explicit Discard) removes them.
 *
 * SNAPSHOT CONTRACT (Zustand-selector lesson, memory note): per-uuid entries
 * are immutable and replaced only when THAT entry changes; the per-channel
 * row arrays are rebuilt ONLY inside mutations. Both `useSendState` and
 * `useOutboxMessages` therefore return referentially-stable snapshots, so a
 * store notify re-renders only the subscribers whose slice actually moved.
 */

export type SendStatus = 'sending' | 'failed';

export interface OutboxEntry {
  readonly status: SendStatus;
  /** What to re-POST on retry. */
  readonly content: string;
  readonly replyToUuid: string | null;
  readonly channelUuid: string;
  /** The optimistic row (uuid = the `local-` id) — the feed's merge source. */
  readonly message: Message;
}

const NO_MESSAGES: readonly Message[] = [];

const entries = new Map<string, OutboxEntry>();
/** Per-channel row arrays, rebuilt eagerly on every mutation so reads are
 *  stable references between notifies. */
const channelRows = new Map<string, readonly Message[]>();
const listeners = new Set<() => void>();

function rebuildChannelRows(): void {
  channelRows.clear();
  for (const entry of entries.values()) {
    const existing = channelRows.get(entry.channelUuid);
    channelRows.set(
      entry.channelUuid,
      existing ? [...existing, entry.message] : [entry.message],
    );
  }
}

function notify(): void {
  rebuildChannelRows();
  for (const listener of listeners) listener();
}

export function outboxSet(localUuid: string, entry: OutboxEntry): void {
  entries.set(localUuid, entry);
  notify();
}

export function outboxMarkFailed(localUuid: string): void {
  const current = entries.get(localUuid);
  if (!current || current.status === 'failed') return;
  entries.set(localUuid, { ...current, status: 'failed' });
  notify();
}

export function outboxMarkSending(localUuid: string): void {
  const current = entries.get(localUuid);
  if (!current || current.status === 'sending') return;
  entries.set(localUuid, { ...current, status: 'sending' });
  notify();
}

/** Success or discard — the entry (and its row's overlay) is gone. */
export function outboxRemove(localUuid: string): void {
  if (!entries.delete(localUuid)) return;
  notify();
}

export function outboxGet(localUuid: string): OutboxEntry | undefined {
  return entries.get(localUuid);
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/**
 * A row's send state: `null` for every real (server-acknowledged) message.
 * Subscribed per row — the snapshot is that row's entry object, so only rows
 * whose delivery state moved re-render on a store change.
 */
export function useSendState(messageUuid: string): OutboxEntry | null {
  return useSyncExternalStore(
    subscribe,
    () => entries.get(messageUuid) ?? null,
    () => null,
  );
}

/**
 * Every unacknowledged optimistic row for one channel, in send order — the
 * feed merges these back in whenever a refetch evicted them from the cache.
 * Stable reference between store mutations; frozen-empty when none.
 */
export function useOutboxMessages(channelUuid: string): readonly Message[] {
  return useSyncExternalStore(
    subscribe,
    () => channelRows.get(channelUuid) ?? NO_MESSAGES,
    () => NO_MESSAGES,
  );
}

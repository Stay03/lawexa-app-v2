import { useSyncExternalStore } from 'react';

/**
 * Conversations the server stopped serving during this visit (deleted, made
 * private or unshared on another device): see gone.ts.
 *
 * WHY A MARK. Once a conversation is gone, the screen drops the transcript it
 * held in memory. Dropping the query alone would make the mounted screen fetch
 * it again (and get 404 again, as a first read). The mark disables that query
 * and keeps "not available" on screen. In memory only: after a reload the first
 * read answers 404 and the mount flow shows "not available" on its own.
 */
const gone = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markGoneOnServer(conversationId: string): void {
  if (gone.has(conversationId)) return;
  gone.add(conversationId);
  for (const listener of listeners) listener();
}

export function isGoneMark(conversationId: string): boolean {
  return gone.has(conversationId);
}

/** Whether this conversation is marked gone. The server snapshot is `false`. */
export function useGoneMark(conversationId: string): boolean {
  return useSyncExternalStore(subscribe, () => gone.has(conversationId), () => false);
}

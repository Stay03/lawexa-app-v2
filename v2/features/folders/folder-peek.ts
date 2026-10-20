import { useSyncExternalStore } from 'react';
import type { FolderRowModel } from './folder-row-model';

/**
 * What a tapped folder row already knows, kept for the folder page's first
 * frame (speed step 5, 17 October 2026; the case page's `case-peek.ts`
 * pattern).
 *
 * The folder header is built from the same row model the list draws, so the
 * row's tile colour and name are exactly what the header will show. The
 * loading screen draws them while the folder loads, and the page publishes the
 * name to the bar (a phone's title) before its own read answers. The counts
 * line is left to the folder: it depends on the tab and on rows withheld.
 */
export type FolderPeek = Pick<FolderRowModel, 'uuid' | 'name' | 'hasName'>;

let last: FolderPeek | null = null;
const listeners = new Set<() => void>();

export function rememberFolderPeek(row: FolderPeek): void {
  last = { uuid: row.uuid, name: row.name, hasName: row.hasName };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The last tapped row's facts when they are for `uuid`, else null. */
export function folderPeekFor(uuid: string | undefined): FolderPeek | null {
  return uuid !== undefined && last?.uuid === uuid ? last : null;
}

/** The tapped row's facts for `uuid`, or null. Null on the server and while
 *  hydrating, so a server-rendered skeleton never disagrees with the client. */
export function useFolderPeek(uuid: string | undefined): FolderPeek | null {
  return useSyncExternalStore(subscribe, () => folderPeekFor(uuid), () => null);
}

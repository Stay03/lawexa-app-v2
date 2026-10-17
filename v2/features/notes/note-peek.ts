import { useSyncExternalStore } from 'react';
import type { NoteRowModel } from './note-row-model';

/**
 * What a tapped note row already knows, kept for the reader's first frame
 * (speed step 5, 17 October 2026; the case page's `case-peek.ts` pattern).
 *
 * The row holds the note's name (with the "Untitled" fallback the masthead
 * uses) and its author, so the loading screen draws them in the masthead's own
 * type while the note loads. "Updated" and the draft mark are left to the note:
 * list rows often carry only the creation date, and no status at all.
 */
export type NotePeek = Pick<NoteRowModel, 'slug' | 'title' | 'hasTitle' | 'author'>;

let last: NotePeek | null = null;
const listeners = new Set<() => void>();

export function rememberNotePeek(row: NotePeek): void {
  last = { slug: row.slug, title: row.title, hasTitle: row.hasTitle, author: row.author };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The last tapped row's facts when they are for `slug`, else null. */
export function notePeekFor(slug: string | undefined): NotePeek | null {
  return slug !== undefined && last?.slug === slug ? last : null;
}

/** The tapped row's facts for `slug`, or null. Null on the server and while
 *  hydrating, so a server-rendered skeleton never disagrees with the client. */
export function useNotePeek(slug: string | undefined): NotePeek | null {
  return useSyncExternalStore(subscribe, () => notePeekFor(slug), () => null);
}

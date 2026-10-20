import { useSyncExternalStore } from 'react';
import type { CaseRowModel } from './case-row-model';

/**
 * What a tapped case row already knows, kept for the case screen's first frame
 * (speed step 4, 17 October 2026: opening a case the first time).
 *
 * A first open used to show a bare skeleton until the case read answered,
 * though the row the reader tapped already held the case's name, court, date
 * and flag. The row puts them here on the tap, and the loading screen draws
 * them in the masthead's own type while the rest of the case loads, so the
 * title is on screen before any request has answered.
 *
 * ONE ENTRY, the last tap: the loading screen only ever needs the case being
 * opened, and a slug that does not match draws the plain skeleton. Only the
 * row's own facts are kept, nothing the case read could contradict on arrival
 * except a correction to the same words.
 */
export type CasePeek = Pick<
  CaseRowModel,
  | 'id'
  | 'slug'
  | 'title'
  | 'rawTitle'
  | 'court'
  | 'countryCode'
  | 'countryName'
  | 'judgmentDate'
  | 'fullCitation'
  | 'topic'
  | 'isVerified'
  | 'isBookmarked'
  | 'bookmarksCount'
>;

let last: CasePeek | null = null;
const listeners = new Set<() => void>();

export function rememberCasePeek(row: CasePeek): void {
  last = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    rawTitle: row.rawTitle,
    court: row.court,
    countryCode: row.countryCode,
    countryName: row.countryName,
    judgmentDate: row.judgmentDate,
    fullCitation: row.fullCitation,
    topic: row.topic,
    isVerified: row.isVerified,
    isBookmarked: row.isBookmarked,
    bookmarksCount: row.bookmarksCount,
  };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The last tapped row's facts when they are for `slug`, else null. */
export function casePeekFor(slug: string | undefined): CasePeek | null {
  return slug !== undefined && last?.slug === slug ? last : null;
}

/** The tapped row's facts for `slug`, or null. Null on the server and while
 *  hydrating, so a server-rendered skeleton never disagrees with the client. */
export function useCasePeek(slug: string | undefined): CasePeek | null {
  return useSyncExternalStore(subscribe, () => casePeekFor(slug), () => null);
}

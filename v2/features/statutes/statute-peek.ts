import { useSyncExternalStore } from 'react';
import type { StatuteRowModel } from './statute-row-model';

/**
 * What a tapped statute row already knows, kept for the reader's first frame
 * (speed step 5, 17 October 2026; the case page's `case-peek.ts` pattern).
 *
 * The row holds the masthead's name, designation, flag, country and year, so
 * the loading screen draws them in the masthead's own type while the statute
 * loads, and the title is on screen before any request has answered. One
 * entry, the last tap; a slug that does not match draws the plain skeleton.
 * The status badge is left to the statute: the row and the header word a
 * missing status label differently.
 */
export type StatutePeek = Pick<
  StatuteRowModel,
  'slug' | 'title' | 'shortTitle' | 'countryCode' | 'countryName' | 'year'
>;

let last: StatutePeek | null = null;
const listeners = new Set<() => void>();

export function rememberStatutePeek(row: StatutePeek): void {
  last = {
    slug: row.slug,
    title: row.title,
    shortTitle: row.shortTitle,
    countryCode: row.countryCode,
    countryName: row.countryName,
    year: row.year,
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
export function statutePeekFor(slug: string | undefined): StatutePeek | null {
  return slug !== undefined && last?.slug === slug ? last : null;
}

/** The tapped row's facts for `slug`, or null. Null on the server and while
 *  hydrating, so a server-rendered skeleton never disagrees with the client. */
export function useStatutePeek(slug: string | undefined): StatutePeek | null {
  return useSyncExternalStore(subscribe, () => statutePeekFor(slug), () => null);
}

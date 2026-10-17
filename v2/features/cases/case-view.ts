import { casesApi } from '@/lib/api/cases';

/**
 * One view per case open, whoever read the case (speed step 4, 17 October 2026).
 *
 * The API counts a view on an ordinary read and none on a read ahead of the
 * open (`X-Lawexa-Prefetch`, a mouse resting on a search row). Once the case
 * page reuses that read, the open makes no read of its own, so nothing would
 * count it. So the read ahead marks the case here, and the case page, drawing
 * from it, sends one view (`POST /cases/{slug}/view`) and takes the mark: the
 * next draw of the same answer sends none. An ordinary read clears the mark,
 * because it already counted the view.
 *
 * Keyed like the case entry: the slug and the search term (`searchTermOf`), so
 * the view carries the same search attribution as the read would have.
 */
const readAhead = new Set<string>();

const keyOf = (slug: string, searchTerm: string | undefined): string =>
  `${slug}\u0000${searchTerm ?? ''}`;

/** A read ahead of the open answered: the open has no view yet. */
export function noteReadAhead(slug: string, searchTerm: string | undefined): void {
  readAhead.add(keyOf(slug, searchTerm));
}

/** An ordinary read answered: it counted the view itself. */
export function noteCountedRead(slug: string, searchTerm: string | undefined): void {
  readAhead.delete(keyOf(slug, searchTerm));
}

/**
 * The case page drew this case. True once, when it drew an answer read ahead
 * of the open that no view has counted yet; the caller then sends the view.
 */
export function takeUncountedOpen(slug: string, searchTerm: string | undefined): boolean {
  return readAhead.delete(keyOf(slug, searchTerm));
}

/** The case page drew `slug`: count the open if its read did not. Failures
 *  are dropped, because the reader already has the case on screen. */
export function countOpen(slug: string, searchTerm: string | undefined): void {
  if (!takeUncountedOpen(slug, searchTerm)) return;
  void casesApi.recordView(slug, searchTerm).catch(() => undefined);
}

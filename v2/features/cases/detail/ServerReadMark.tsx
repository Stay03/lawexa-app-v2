'use client';

import { useLayoutEffect } from 'react';

import { noteReadAhead } from '../case-view';
import { searchTermOf } from '../queries';

/**
 * The server read this case for the page's first HTML, as a read ahead (it
 * counted no view; `server.ts`). Marked before the screen's effects run (a
 * layout effect), so the screen drawing it sends the open's one view from the
 * browser, with where the visit came from (`case-view.ts`, `view-signals.ts`).
 * Rendered only when the server's read is in the page.
 */
export function ServerReadMark({ slug, searchQuery }: { slug: string; searchQuery?: string }) {
  useLayoutEffect(() => {
    noteReadAhead(slug, searchTermOf(searchQuery));
  }, [slug, searchQuery]);
  return null;
}

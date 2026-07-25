'use client';

import { useUrlSearch, type UrlSearch } from '@/v2/runtime/use-url-search';

/**
 * The `/conversations` search box.
 *
 * The implementation — a URL-synced, 300ms-debounced draft with a consumed
 * self-write queue — moved to `v2/runtime/use-url-search.ts` when the cases list
 * needed the same box, and it carries the full account of the two race failures
 * that shaped it. Nothing about it was conversations-specific except the query
 * key, so this stayed as the named entry point rather than being deleted:
 * call sites read `useConversationsSearch()` and remain untouched.
 */
export type ConversationsSearch = UrlSearch;

export function useConversationsSearch(): ConversationsSearch {
  return useUrlSearch('search');
}

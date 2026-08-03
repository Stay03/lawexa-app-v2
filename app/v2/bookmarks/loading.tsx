import { BookmarksFallback } from '@/v2/features/bookmarks/list/BookmarksScreen';

/**
 * Route-level loading boundary for `/bookmarks` — the SAME component as the
 * page's own Suspense fallback, so route boundary → Suspense fallback → live
 * list is one continuous shape and nothing moves at either hand-off (the
 * cases / radars route convention). The fallback is `aria-hidden` + `inert`
 * and pulses nothing that is not genuinely in flight; it owns those rules
 * itself, in `BookmarksScreen`, so this file cannot drift from it.
 */
export default function BookmarksLoading() {
  return <BookmarksFallback />;
}

import { NotesFallback } from '@/v2/features/notes/library/NotesScreen';

/**
 * Route-level loading boundary for `/notes` — the SAME component as the page's
 * own Suspense fallback, so route boundary → Suspense fallback → live list is
 * one continuous shape and nothing moves at either hand-off (the cases /
 * statutes library convention).
 *
 * It lives in the `(library)` ROUTE GROUP, beside the list page, so it wraps
 * that page and nothing else. The segment boundary one level up
 * (`app/v2/notes/loading.tsx`) is shaped for the note DOCUMENT, because that
 * is what the children navigated into `/notes` actually are. Do not
 * "simplify" the two files back into one — see `app/v2/loading.tsx` for the
 * full rule and the two bugs it exists to prevent.
 */
export default function NotesLoading() {
  return <NotesFallback />;
}

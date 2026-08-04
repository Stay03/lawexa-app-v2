import { FoldersFallback } from '@/v2/features/folders/list/FoldersScreen';

/**
 * Route-level loading boundary for `/folders` — the SAME component as the
 * page's own Suspense fallback, so route boundary → Suspense fallback → live
 * list is one continuous shape and nothing moves at either hand-off (the
 * cases / statutes / notes library convention).
 *
 * It lives in the `(library)` ROUTE GROUP, beside the list page, so it wraps
 * that page and nothing else. The segment boundary one level up
 * (`app/v2/folders/loading.tsx`) is shaped for a FOLDER PAGE, because that is
 * what the children navigated into `/folders` actually are. Do not "simplify"
 * the two files back into one — see `app/v2/loading.tsx` for the full rule and
 * the two bugs it exists to prevent.
 */
export default function FoldersLoading() {
  return <FoldersFallback />;
}
